import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { db, now } from '../db.js';
import { clearSession, publicUser, requireAuth, setSession, type UserRow } from '../auth.js';
import { adminIds, notify } from '../notify.js';
import { fail, parse } from '../util.js';

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.' },
});

const phone = z
  .string()
  .trim()
  .regex(/^(\+62|62|0)8[0-9]{7,12}$/, 'Nomor WhatsApp tidak valid (contoh: 081234567890).');
const pn = z.string().trim().regex(/^[0-9]{5,12}$/, 'PN berupa 5–12 digit angka.');
const name = z.string().trim().min(3, 'Nama minimal 3 karakter.').max(80);
const email = z.string().trim().toLowerCase().email('Format email tidak valid.');
const password = z.string().min(8, 'Password minimal 8 karakter.').max(72);

const unitExists = db.prepare('SELECT id FROM units WHERE id = ? AND active = 1');

const registerSchema = z.object({
  name,
  pn,
  email,
  phone,
  unitId: z.coerce.number().int().positive('Pilih unit kerja.'),
  password,
});

authRouter.post('/register', limiter, (req, res) => {
  const data = parse(registerSchema, req.body);
  if (!unitExists.get(data.unitId)) fail(400, 'Unit kerja tidak ditemukan.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(data.email)) fail(409, 'Email sudah terdaftar.');
  if (db.prepare('SELECT 1 FROM users WHERE pn = ?').get(data.pn)) fail(409, 'PN sudah terdaftar.');

  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO users (role, name, email, pn, phone, unit_id, password_hash, status, created_at, updated_at)
       VALUES ('employee', ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
    .run(data.name, data.email, data.pn, data.phone, data.unitId, bcrypt.hashSync(data.password, 10), ts, ts);
  const id = Number(info.lastInsertRowid);

  notify(adminIds(), {
    type: 'account.pending',
    title: 'Akun baru menunggu verifikasi',
    body: `${data.name} (PN ${data.pn}) mendaftar dan menunggu verifikasi.`,
    link: '/admin/akun?status=pending',
  });

  setSession(res, id);
  res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow) });
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Isi email atau PN.'),
  password: z.string().min(1, 'Isi password.'),
});

authRouter.post('/login', limiter, (req, res) => {
  const { identifier, password: pw } = parse(loginSchema, req.body);
  const user = db.prepare('SELECT * FROM users WHERE email = ? OR pn = ?').get(identifier.toLowerCase(), identifier) as
    | UserRow
    | undefined;
  if (!user || !bcrypt.compareSync(pw, user.password_hash)) fail(401, 'Email/PN atau password salah.');
  if (user!.status === 'disabled') fail(403, 'Akun ini sedang dinonaktifkan. Hubungi admin.');
  setSession(res, user!.id);
  res.json({ user: publicUser(user!) });
});

authRouter.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

export const AVATAR_TONES = ['sky', 'mint', 'sun', 'peach', 'lilac', 'rose', 'ink'] as const;

const profileSchema = z.object({
  name,
  phone: phone.optional().or(z.literal('')),
  unitId: z.coerce.number().int().positive().optional(),
  title: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(400).optional(),
  avatarTone: z.enum(AVATAR_TONES).optional(),
  statusText: z.string().trim().max(60, 'Status maksimal 60 karakter.').optional(),
});

authRouter.patch('/profile', requireAuth, (req, res) => {
  const u = req.user!;
  const data = parse(profileSchema, req.body);
  if (data.unitId && u.role === 'employee' && !unitExists.get(data.unitId)) fail(400, 'Unit kerja tidak ditemukan.');
  db.prepare(
    `UPDATE users SET name = ?, phone = ?, unit_id = ?, title = ?, bio = ?, avatar_tone = ?, status_text = ?, updated_at = ? WHERE id = ?`,
  ).run(
    data.name,
    data.phone || null,
    u.role === 'employee' ? (data.unitId ?? u.unit_id) : u.unit_id,
    u.role === 'psychologist' ? (data.title ?? u.title) : u.title,
    u.role === 'psychologist' ? (data.bio ?? u.bio) : u.bio,
    data.avatarTone ?? u.avatar_tone,
    data.statusText === undefined ? u.status_text : data.statusText || null,
    now(),
    u.id,
  );
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id) as UserRow) });
});

/** Karyawan yang ditolak memperbaiki data lalu mengajukan verifikasi ulang. */
authRouter.post('/resubmit', requireAuth, (req, res) => {
  const u = req.user!;
  if (u.role !== 'employee' || u.status !== 'rejected') fail(400, 'Akunmu tidak perlu diajukan ulang.');
  const data = parse(registerSchema.omit({ password: true, email: true }), req.body);
  if (!unitExists.get(data.unitId)) fail(400, 'Unit kerja tidak ditemukan.');
  if (db.prepare('SELECT 1 FROM users WHERE pn = ? AND id != ?').get(data.pn, u.id)) fail(409, 'PN sudah terdaftar.');
  db.prepare(
    `UPDATE users SET name = ?, pn = ?, phone = ?, unit_id = ?, status = 'pending', reject_reason = NULL, updated_at = ? WHERE id = ?`,
  ).run(data.name, data.pn, data.phone, data.unitId, now(), u.id);
  notify(adminIds(), {
    type: 'account.pending',
    title: 'Pengajuan ulang verifikasi akun',
    body: `${data.name} (PN ${data.pn}) memperbaiki data dan mengajukan verifikasi ulang.`,
    link: '/admin/akun?status=pending',
  });
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id) as UserRow) });
});

authRouter.post('/password', requireAuth, (req, res) => {
  const { current, next } = parse(z.object({ current: z.string(), next: password }), req.body);
  if (!bcrypt.compareSync(current, req.user!.password_hash)) fail(400, 'Password lama tidak cocok.');
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    bcrypt.hashSync(next, 10),
    now(),
    req.user!.id,
  );
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Foto profil: dikirim sebagai data URL (sudah dipotong & diperkecil di browser).

export const AVATAR_DIR = path.join(path.dirname(config.databasePath), 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

function removeAvatarFile(url: string | null) {
  if (!url?.startsWith('/avatars/')) return;
  fs.rm(path.join(AVATAR_DIR, path.basename(url)), { force: true }, () => {});
}

authRouter.post('/avatar', requireAuth, express.json({ limit: '1mb' }), (req, res) => {
  const { image } = parse(z.object({ image: z.string() }), req.body);
  const m = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!m) fail(400, 'Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.');
  const buf = Buffer.from(m![2], 'base64');
  if (buf.length > 400 * 1024) fail(400, 'Ukuran foto terlalu besar (maks. 400 KB setelah dipotong).');
  const ext = m![1] === 'jpeg' ? 'jpg' : m![1];
  const file = `${req.user!.id}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(AVATAR_DIR, file), buf);
  removeAvatarFile(req.user!.avatar_url);
  db.prepare('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?').run(`/avatars/${file}`, now(), req.user!.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as UserRow) });
});

authRouter.delete('/avatar', requireAuth, (req, res) => {
  removeAvatarFile(req.user!.avatar_url);
  db.prepare('UPDATE users SET avatar_url = NULL, updated_at = ? WHERE id = ?').run(now(), req.user!.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as UserRow) });
});

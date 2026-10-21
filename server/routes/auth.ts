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
import { fail, parse } from '../util.js';
import { SERVICE_CONFIG } from '../serviceConfig.js';

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.' },
});

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+62|62|0)8[0-9]{7,12}$/, 'Nomor WhatsApp tidak valid (contoh: 081234567890).');
const name = z.string().trim().min(3, 'Nama minimal 3 karakter.').max(80);
export const passwordSchema = z.string().min(8, 'Password minimal 8 karakter.').max(72);

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Isi PN atau email.'),
  password: z.string().min(1, 'Isi password.'),
});

authRouter.post('/login', limiter, (req, res) => {
  const { identifier, password: pw } = parse(loginSchema, req.body);
  const user = db.prepare('SELECT * FROM users WHERE email = ? OR pn = ?').get(identifier.toLowerCase(), identifier) as
    | UserRow
    | undefined;
  // PN divalidasi terhadap master data pekerja (tidak ada pendaftaran mandiri).
  if (!user || !bcrypt.compareSync(pw, user.password_hash)) fail(401, 'PN/email atau password salah.');
  if (user!.status !== 'verified') fail(403, 'Akun ini sedang tidak aktif. Hubungi admin Teman Cerita.');
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

const optionalText = (max: number) => z.string().trim().max(max).optional();

const profileSchema = z.object({
  name,
  phone: phoneSchema.optional().or(z.literal('')),
  nickname: optionalText(40),
  title: optionalText(80),
  bio: optionalText(600),
  specialization: optionalText(120),
  approach: optionalText(160),
  languages: optionalText(80),
  meetingUrl: z.string().trim().regex(/^https?:\/\/\S+$/, 'Tautan Teams harus diawali https://').max(500).optional().or(z.literal('')),
  avatarTone: z.enum(AVATAR_TONES).optional(),
  statusText: z.string().trim().max(60, 'Status maksimal 60 karakter.').optional(),
});

authRouter.patch('/profile', requireAuth, (req, res) => {
  const u = req.user!;
  const d = parse(profileSchema, req.body);
  const psych = u.role === 'psychologist';
  // Unit, band, region, dsb. berasal dari master data dan hanya diubah admin.
  const keep = <T>(v: T | undefined, old: T) => (v === undefined ? old : v);
  db.prepare(
    `UPDATE users SET name=?, phone=?, nickname=?, title=?, bio=?, specialization=?, approach=?, languages=?, meeting_url=?,
       avatar_tone=?, status_text=?, updated_at=? WHERE id=?`,
  ).run(
    d.name,
    d.phone || null,
    u.role === 'employee' ? keep(d.nickname, u.nickname) || null : u.nickname,
    psych ? keep(d.title, u.title) || null : u.title,
    psych ? keep(d.bio, u.bio) || null : u.bio,
    psych ? keep(d.specialization, u.specialization) || null : u.specialization,
    psych ? keep(d.approach, u.approach) || null : u.approach,
    psych ? keep(d.languages, u.languages) || null : u.languages,
    psych ? keep(d.meetingUrl, u.meeting_url) || null : u.meeting_url,
    d.avatarTone ?? u.avatar_tone,
    d.statusText === undefined ? u.status_text : d.statusText || null,
    now(),
    u.id,
  );
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id) as UserRow) });
});

authRouter.post('/password', requireAuth, (req, res) => {
  const { current, next } = parse(z.object({ current: z.string(), next: passwordSchema }), req.body);
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
  if (buf.length > SERVICE_CONFIG.avatarMaxKB * 1024) fail(400, `Ukuran foto maksimal ${SERVICE_CONFIG.avatarMaxKB} KB.`);
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

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, now } from '../db.js';
import { publicUser, requireRole, type UserRow } from '../auth.js';
import { notify } from '../notify.js';
import { publish } from '../events.js';
import { findConflicts } from './tickets.js';
import { fail, intParam, parse } from '../util.js';

export const adminRouter = Router();
adminRouter.use(requireRole('admin'));

const getUser = (id: number) => db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;

/** Angka kecil untuk badge di sidebar admin. */
adminRouter.get('/overview', (_req, res) => {
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  res.json({
    pendingAccounts: one(`SELECT COUNT(*) n FROM users WHERE role='employee' AND status='pending'`),
    pendingTickets: one(`SELECT COUNT(*) n FROM tickets WHERE status='pending'`),
    rescheduleRequests: one(`SELECT COUNT(*) n FROM tickets WHERE status='reschedule_requested'`),
    urgentPending: one(`SELECT COUNT(*) n FROM tickets WHERE status='pending' AND urgency='high'`),
  });
});

// ---------------------------------------------------------------------------
// Akun

adminRouter.get('/users', (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.role) where.push('u.role = ?'), params.push(q.role);
  if (q.status) where.push('u.status = ?'), params.push(q.status);
  if (q.unit) where.push('u.unit_id = ?'), params.push(Number(q.unit));
  if (q.q) {
    where.push('(u.name LIKE ? OR u.email LIKE ? OR u.pn LIKE ?)');
    params.push(`%${q.q}%`, `%${q.q}%`, `%${q.q}%`);
  }
  const rows = db
    .prepare(
      `SELECT u.*, (SELECT COUNT(*) FROM tickets t WHERE t.employee_id = u.id) AS ticket_count
       FROM users u ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY CASE u.status WHEN 'pending' THEN 0 ELSE 1 END, u.created_at DESC LIMIT 500`,
    )
    .all(...params) as (UserRow & { ticket_count: number })[];
  res.json({ users: rows.map((u) => ({ ...publicUser(u), ticketCount: u.ticket_count })) });
});

adminRouter.post('/users/:id/verify', (req, res) => {
  const u = getUser(intParam(req.params.id));
  if (!u || u.role !== 'employee') return fail(404, 'Akun tidak ditemukan.');
  if (u.status === 'verified') fail(400, 'Akun sudah terverifikasi.');
  db.prepare(`UPDATE users SET status='verified', reject_reason=NULL, verified_at=?, verified_by=?, updated_at=? WHERE id=?`).run(
    now(), req.user!.id, now(), u.id,
  );
  notify(u.id, {
    type: 'account.verified',
    title: 'Akunmu sudah diverifikasi',
    body: 'Sekarang kamu bisa mengajukan sesi konseling kapan pun kamu butuh teman cerita.',
    link: '/',
  });
  publish(u.id, 'account', {});
  res.json({ ok: true });
});

adminRouter.post('/users/:id/reject', (req, res) => {
  const u = getUser(intParam(req.params.id));
  if (!u || u.role !== 'employee') return fail(404, 'Akun tidak ditemukan.');
  const { reason } = parse(z.object({ reason: z.string().trim().min(5, 'Tuliskan alasan penolakan (min. 5 karakter).').max(500) }), req.body);
  db.prepare(`UPDATE users SET status='rejected', reject_reason=?, updated_at=? WHERE id=?`).run(reason, now(), u.id);
  notify(u.id, {
    type: 'account.rejected',
    title: 'Verifikasi akun belum disetujui',
    body: `Alasan: ${reason}. Kamu bisa memperbaiki data lalu mengajukan ulang.`,
    link: '/',
  });
  publish(u.id, 'account', {});
  res.json({ ok: true });
});

adminRouter.post('/users/:id/status', (req, res) => {
  const u = getUser(intParam(req.params.id));
  if (!u) return fail(404, 'Akun tidak ditemukan.');
  if (u.id === req.user!.id) fail(400, 'Kamu tidak bisa menonaktifkan akunmu sendiri.');
  const { active } = parse(z.object({ active: z.boolean() }), req.body);
  if (!active && u.role === 'psychologist') {
    const upcoming = db.prepare(`SELECT COUNT(*) n FROM tickets WHERE psychologist_id = ? AND status IN ('scheduled','reschedule_requested','in_progress')`).get(u.id) as { n: number };
    if (upcoming.n) fail(400, `Psikolog ini masih punya ${upcoming.n} sesi aktif. Alihkan dulu sesinya.`);
  }
  const next = active ? (u.role === 'employee' && !u.verified_at ? 'pending' : 'verified') : 'disabled';
  db.prepare('UPDATE users SET status=?, updated_at=? WHERE id=?').run(next, now(), u.id);
  res.json({ ok: true });
});

const staffSchema = z.object({
  role: z.enum(['psychologist', 'admin']),
  name: z.string().trim().min(3, 'Nama minimal 3 karakter.').max(80),
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
  phone: z.string().trim().max(20).optional().default(''),
  title: z.string().trim().max(80).optional().default(''),
  bio: z.string().trim().max(400).optional().default(''),
  password: z.string().min(8, 'Password minimal 8 karakter.').max(72),
});

adminRouter.post('/staff', (req, res) => {
  const d = parse(staffSchema, req.body);
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(d.email)) fail(409, 'Email sudah terdaftar.');
  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO users (role, name, email, phone, title, bio, password_hash, status, verified_at, verified_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?, 'verified', ?, ?, ?, ?)`,
    )
    .run(d.role, d.name, d.email, d.phone || null, d.title || null, d.bio || null, bcrypt.hashSync(d.password, 10), ts, req.user!.id, ts, ts);
  res.status(201).json({ user: publicUser(getUser(Number(info.lastInsertRowid))!) });
});

adminRouter.patch('/staff/:id', (req, res) => {
  const u = getUser(intParam(req.params.id));
  if (!u || u.role === 'employee') return fail(404, 'Akun tidak ditemukan.');
  const d = parse(staffSchema.omit({ role: true }).extend({ password: z.string().max(72).optional().default('') }), req.body);
  if (db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(d.email, u.id)) fail(409, 'Email sudah dipakai akun lain.');
  if (d.password && d.password.length < 8) fail(400, 'Password minimal 8 karakter.');
  db.prepare(`UPDATE users SET name=?, email=?, phone=?, title=?, bio=?, updated_at=? WHERE id=?`).run(d.name, d.email, d.phone || null, d.title || null, d.bio || null, now(), u.id);
  if (d.password) db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(d.password, 10), u.id);
  res.json({ user: publicUser(getUser(u.id)!) });
});

adminRouter.get('/psychologists', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.title, u.bio, u.status,
        u.avatar_url AS avatarUrl, u.avatar_tone AS avatarTone, u.status_text AS statusText,
        (SELECT COUNT(*) FROM tickets t WHERE t.psychologist_id = u.id AND t.status IN ('scheduled','reschedule_requested','in_progress')) AS active,
        (SELECT COUNT(*) FROM tickets t WHERE t.psychologist_id = u.id AND t.status = 'completed') AS completed,
        (SELECT COUNT(*) FROM tickets t WHERE t.psychologist_id = u.id AND t.status IN ('scheduled','in_progress')
           AND date(t.scheduled_start) BETWEEN date('now') AND date('now', '+7 day')) AS this_week,
        (SELECT ROUND(AVG(r.rating), 2) FROM reviews r JOIN tickets t ON t.id = r.ticket_id WHERE t.psychologist_id = u.id) AS rating
       FROM users u WHERE u.role = 'psychologist' ORDER BY u.status = 'disabled', u.name`,
    )
    .all();
  res.json({ psychologists: rows });
});

adminRouter.get('/conflicts', (req, res) => {
  const q = req.query as Record<string, string>;
  const pid = Number(q.psychologistId);
  if (!pid || !q.start || !q.end) return res.json({ conflicts: [] });
  res.json({
    conflicts: findConflicts(pid, new Date(q.start).toISOString(), new Date(q.end).toISOString(), Number(q.ticketId) || 0),
  });
});

/** Jadwal psikolog pada satu hari — membantu admin memilih jam kosong. */
adminRouter.get('/agenda', (req, res) => {
  const q = req.query as Record<string, string>;
  const pid = Number(q.psychologistId);
  if (!pid || !q.from || !q.to) return res.json({ sessions: [] });
  const sessions = db
    .prepare(
      `SELECT t.id, t.code, t.mode, t.scheduled_start AS start, t.scheduled_end AS end, t.status
       FROM tickets t WHERE t.psychologist_id = ? AND t.status IN ('scheduled','reschedule_requested','in_progress')
       AND t.scheduled_start >= ? AND t.scheduled_start < ? ORDER BY t.scheduled_start`,
    )
    .all(pid, q.from, q.to);
  res.json({ sessions });
});

// ---------------------------------------------------------------------------
// Unit kerja

adminRouter.get('/units', (_req, res) => {
  const units = db
    .prepare(
      `SELECT u.id, u.name, u.code, u.active,
         (SELECT COUNT(*) FROM users e WHERE e.unit_id = u.id AND e.role = 'employee') AS employees,
         (SELECT COUNT(*) FROM tickets t WHERE t.unit_id = u.id) AS tickets
       FROM units u ORDER BY u.active DESC, u.name`,
    )
    .all();
  res.json({ units });
});

const unitSchema = z.object({
  name: z.string().trim().min(2, 'Nama unit minimal 2 karakter.').max(100),
  code: z.string().trim().max(20).optional().default(''),
  active: z.boolean().optional().default(true),
});

adminRouter.post('/units', (req, res) => {
  const d = parse(unitSchema, req.body);
  if (db.prepare('SELECT 1 FROM units WHERE name = ?').get(d.name)) fail(409, 'Unit dengan nama ini sudah ada.');
  db.prepare('INSERT INTO units (name, code, active, created_at) VALUES (?,?,?,?)').run(d.name, d.code || null, d.active ? 1 : 0, now());
  res.status(201).json({ ok: true });
});

adminRouter.patch('/units/:id', (req, res) => {
  const id = intParam(req.params.id);
  const d = parse(unitSchema, req.body);
  if (db.prepare('SELECT 1 FROM units WHERE name = ? AND id != ?').get(d.name, id)) fail(409, 'Unit dengan nama ini sudah ada.');
  const r = db.prepare('UPDATE units SET name=?, code=?, active=? WHERE id=?').run(d.name, d.code || null, d.active ? 1 : 0, id);
  if (!r.changes) fail(404, 'Unit tidak ditemukan.');
  res.json({ ok: true });
});

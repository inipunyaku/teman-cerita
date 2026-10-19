import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, now, tx } from '../db.js';
import { publicUser, requireRole, type UserRow } from '../auth.js';
import { publish } from '../events.js';
import { passwordSchema } from './auth.js';
import { wibIso, wibToday, addDays } from '../scheduling.js';
import { fail, intParam, parse } from '../util.js';

export const adminRouter = Router();
adminRouter.use(requireRole('admin'));

const getUser = (id: number) => db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;

/** Angka kecil untuk badge di sidebar admin. */
adminRouter.get('/overview', (_req, res) => {
  const one = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...p) as { n: number }).n;
  const today = wibToday();
  res.json({
    awaitingReport: one(`SELECT COUNT(*) n FROM tickets WHERE status = 'awaiting_report'`),
    today: one(
      `SELECT COUNT(*) n FROM tickets WHERE status != 'cancelled' AND scheduled_start >= ? AND scheduled_start < ?`,
      wibIso(today, '00:00'),
      wibIso(addDays(today, 1), '00:00'),
    ),
    upcoming: one(`SELECT COUNT(*) n FROM tickets WHERE status = 'scheduled'`),
  });
});

// ---------------------------------------------------------------------------
// Master data pekerja

const optional = (max: number) => z.string().trim().max(max).optional().default('');
const employeeSchema = z.object({
  pn: z.string().trim().regex(/^[0-9]{5,12}$/, 'PN berupa 5–12 digit angka.'),
  name: z.string().trim().min(3, 'Nama minimal 3 karakter.').max(80),
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
  phone: z.string().trim().regex(/^((\+62|62|0)8[0-9]{7,12})?$/, 'Nomor WhatsApp tidak valid (contoh: 081234567890).').optional().default(''),
  unitId: z.coerce.number().int().positive('Pilih unit kerja.'),
  band: optional(30),
  region: optional(80),
  gender: z.enum(['L', 'P', '']).optional().default(''),
  birthDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Tanggal lahir tidak valid.').optional().default(''),
  password: z.string().max(72).optional().default(''),
});
type EmployeeInput = z.infer<typeof employeeSchema>;

const unitExists = db.prepare('SELECT id FROM units WHERE id = ?');

/** Password awal pekerja bila admin tidak mengisinya: tanggal lahir DDMMYYYY, atau PN. */
const defaultPassword = (d: EmployeeInput) => (d.birthDate ? d.birthDate.split('-').reverse().join('') : d.pn);

function checkEmployee(d: EmployeeInput, id = 0) {
  if (!unitExists.get(d.unitId)) fail(400, 'Unit kerja tidak ditemukan.');
  if (db.prepare('SELECT 1 FROM users WHERE pn = ? AND id != ?').get(d.pn, id)) fail(409, `PN ${d.pn} sudah terdaftar.`);
  if (db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(d.email, id)) fail(409, `Email ${d.email} sudah dipakai akun lain.`);
  if (d.password && d.password.length < 8) fail(400, 'Password minimal 8 karakter.');
}

function insertEmployee(d: EmployeeInput, adminId: number) {
  const ts = now();
  return Number(
    db
      .prepare(
        `INSERT INTO users (role, name, email, pn, phone, unit_id, band, region, gender, birth_date, password_hash, status, verified_at, verified_by, created_at, updated_at)
         VALUES ('employee', ?,?,?,?,?,?,?,?,?,?, 'verified', ?, ?, ?, ?)`,
      )
      .run(
        d.name, d.email, d.pn, d.phone || null, d.unitId, d.band || null, d.region || null, d.gender || null, d.birthDate || null,
        bcrypt.hashSync(d.password || defaultPassword(d), 10), ts, adminId, ts, ts,
      ).lastInsertRowid,
  );
}

adminRouter.get('/employees', (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const where = [`u.role = 'employee'`];
  const params: unknown[] = [];
  if (q.status === 'active') where.push(`u.status = 'verified'`);
  else if (q.status === 'disabled') where.push(`u.status != 'verified'`);
  if (q.unit) where.push('u.unit_id = ?'), params.push(Number(q.unit));
  if (q.q) {
    where.push('(u.name LIKE ? OR u.email LIKE ? OR u.pn LIKE ? OR u.nickname LIKE ?)');
    params.push(...Array(4).fill(`%${q.q}%`));
  }
  const rows = db
    .prepare(
      `SELECT u.*, (SELECT COUNT(*) FROM tickets t WHERE t.employee_id = u.id AND t.status != 'cancelled') AS ticket_count
       FROM users u WHERE ${where.join(' AND ')} ORDER BY u.name LIMIT 1000`,
    )
    .all(...params) as (UserRow & { ticket_count: number })[];
  res.json({ users: rows.map((u) => ({ ...publicUser(u), ticketCount: u.ticket_count })) });
});

adminRouter.post('/employees', (req, res) => {
  const d = parse(employeeSchema, req.body);
  checkEmployee(d);
  const id = insertEmployee(d, req.user!.id);
  res.status(201).json({ user: publicUser(getUser(id)!) });
});

adminRouter.patch('/employees/:id', (req, res) => {
  const u = getUser(intParam(req.params.id));
  if (!u || u.role !== 'employee') return fail(404, 'Pekerja tidak ditemukan.');
  const d = parse(employeeSchema, req.body);
  checkEmployee(d, u.id);
  db.prepare(
    `UPDATE users SET pn=?, name=?, email=?, phone=?, unit_id=?, band=?, region=?, gender=?, birth_date=?, updated_at=? WHERE id=?`,
  ).run(d.pn, d.name, d.email, d.phone || null, d.unitId, d.band || null, d.region || null, d.gender || null, d.birthDate || null, now(), u.id);
  if (d.password) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(d.password, 10), u.id);
  publish(u.id, 'account', {});
  res.json({ user: publicUser(getUser(u.id)!) });
});

/** Impor massal dari CSV (sudah diurai di browser). Baris dengan PN yang sudah ada diperbarui. */
adminRouter.post('/employees/import', (req, res) => {
  const { rows } = parse(
    z.object({ rows: z.array(z.record(z.string(), z.string())).min(1, 'File tidak berisi data.').max(5000, 'Maksimal 5.000 baris per impor.') }),
    req.body,
  );
  const units = db.prepare('SELECT id, name, code FROM units').all() as { id: number; name: string; code: string | null }[];
  const findUnit = (v = '') => {
    const k = v.trim().toLowerCase();
    return units.find((u) => u.name.toLowerCase() === k || u.code?.toLowerCase() === k)?.id;
  };
  const errors: { row: number; error: string }[] = [];
  let created = 0;
  let updated = 0;
  tx(() => {
    rows.forEach((r, i) => {
      const g = (r.jenis_kelamin ?? r.gender ?? '').trim().toUpperCase();
      const result = employeeSchema.safeParse({
        pn: r.pn,
        name: r.nama ?? r.name,
        email: r.email,
        phone: r.no_wa ?? r.phone ?? '',
        unitId: findUnit(r.unit ?? r.unit_kerja) ?? 0,
        band: r.band ?? '',
        region: r.region ?? '',
        gender: g.startsWith('L') ? 'L' : g.startsWith('P') ? 'P' : '',
        birthDate: r.tanggal_lahir ?? r.birth_date ?? '',
        password: '',
      });
      if (!result.success) return errors.push({ row: i + 2, error: result.error.issues[0]?.message ?? 'Data tidak valid.' });
      const d = result.data;
      const existing = db.prepare(`SELECT id FROM users WHERE pn = ? AND role = 'employee'`).get(d.pn) as { id: number } | undefined;
      if (db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(d.email, existing?.id ?? 0)) {
        return errors.push({ row: i + 2, error: `Email ${d.email} sudah dipakai akun lain.` });
      }
      if (existing) {
        db.prepare(`UPDATE users SET name=?, email=?, phone=?, unit_id=?, band=?, region=?, gender=?, birth_date=?, updated_at=? WHERE id=?`).run(
          d.name, d.email, d.phone || null, d.unitId, d.band || null, d.region || null, d.gender || null, d.birthDate || null, now(), existing.id,
        );
        updated++;
      } else {
        if (db.prepare('SELECT 1 FROM users WHERE pn = ?').get(d.pn)) return errors.push({ row: i + 2, error: `PN ${d.pn} dipakai akun staf.` });
        insertEmployee(d, req.user!.id);
        created++;
      }
    });
  });
  res.json({ created, updated, errors });
});

adminRouter.post('/users/:id/status', (req, res) => {
  const u = getUser(intParam(req.params.id));
  if (!u) return fail(404, 'Akun tidak ditemukan.');
  if (u.id === req.user!.id) fail(400, 'Kamu tidak bisa menonaktifkan akunmu sendiri.');
  const { active } = parse(z.object({ active: z.boolean() }), req.body);
  if (!active && u.role === 'psychologist') {
    const upcoming = db.prepare(`SELECT COUNT(*) n FROM tickets WHERE psychologist_id = ? AND status IN ('scheduled','in_progress')`).get(u.id) as { n: number };
    if (upcoming.n) fail(400, `Psikolog ini masih punya ${upcoming.n} sesi akan datang. Pindahkan dulu sesinya.`);
  }
  db.prepare('UPDATE users SET status=?, updated_at=? WHERE id=?').run(active ? 'verified' : 'disabled', now(), u.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Psikolog & admin

const staffSchema = z.object({
  role: z.enum(['psychologist', 'admin']),
  name: z.string().trim().min(3, 'Nama minimal 3 karakter.').max(80),
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
  phone: optional(20),
  title: optional(80),
  bio: optional(600),
  specialization: optional(120),
  approach: optional(160),
  languages: optional(80),
  meetingUrl: z.string().trim().regex(/^(https?:\/\/\S+)?$/, 'Tautan Teams harus diawali https://').max(500).optional().default(''),
  password: passwordSchema,
});

adminRouter.post('/staff', (req, res) => {
  const d = parse(staffSchema, req.body);
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(d.email)) fail(409, 'Email sudah terdaftar.');
  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO users (role, name, email, phone, title, bio, specialization, approach, languages, meeting_url, password_hash, status, verified_at, verified_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?, 'verified', ?, ?, ?, ?)`,
    )
    .run(
      d.role, d.name, d.email, d.phone || null, d.title || null, d.bio || null, d.specialization || null, d.approach || null,
      d.languages || null, d.meetingUrl || null, bcrypt.hashSync(d.password, 10), ts, req.user!.id, ts, ts,
    );
  res.status(201).json({ user: publicUser(getUser(Number(info.lastInsertRowid))!) });
});

adminRouter.patch('/staff/:id', (req, res) => {
  const u = getUser(intParam(req.params.id));
  if (!u || u.role === 'employee') return fail(404, 'Akun tidak ditemukan.');
  const d = parse(staffSchema.omit({ role: true }).extend({ password: z.string().max(72).optional().default('') }), req.body);
  if (db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(d.email, u.id)) fail(409, 'Email sudah dipakai akun lain.');
  if (d.password && d.password.length < 8) fail(400, 'Password minimal 8 karakter.');
  db.prepare(
    `UPDATE users SET name=?, email=?, phone=?, title=?, bio=?, specialization=?, approach=?, languages=?, meeting_url=?, updated_at=? WHERE id=?`,
  ).run(
    d.name, d.email, d.phone || null, d.title || null, d.bio || null, d.specialization || null, d.approach || null,
    d.languages || null, d.meetingUrl || null, now(), u.id,
  );
  if (d.password) db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(d.password, 10), u.id);
  res.json({ user: publicUser(getUser(u.id)!) });
});

adminRouter.get('/admins', (_req, res) => {
  const rows = db.prepare(`SELECT * FROM users WHERE role = 'admin' ORDER BY name`).all() as UserRow[];
  res.json({ users: rows.map(publicUser) });
});

adminRouter.get('/psychologists', (_req, res) => {
  const today = wibToday();
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.title, u.bio, u.specialization, u.approach, u.languages, u.meeting_url AS meetingUrl, u.status,
        u.avatar_url AS avatarUrl, u.avatar_tone AS avatarTone, u.status_text AS statusText,
        (SELECT COUNT(*) FROM tickets t WHERE t.psychologist_id = u.id AND t.status IN ('scheduled','in_progress')) AS upcoming,
        (SELECT COUNT(*) FROM tickets t WHERE t.psychologist_id = u.id AND t.status = 'awaiting_report') AS awaiting,
        (SELECT COUNT(*) FROM tickets t WHERE t.psychologist_id = u.id AND t.status = 'completed') AS completed,
        (SELECT COUNT(*) FROM availability a WHERE a.psychologist_id = u.id AND a.date >= ?) AS openBlocks,
        (SELECT ROUND(AVG(f.score), 1) FROM feedback f JOIN tickets t ON t.id = f.ticket_id WHERE t.psychologist_id = u.id) AS satisfaction
       FROM users u WHERE u.role = 'psychologist' ORDER BY u.status = 'disabled', u.name`,
    )
    .all(today);
  res.json({ psychologists: rows });
});

// ---------------------------------------------------------------------------
// Unit kerja

adminRouter.get('/units', (_req, res) => {
  const units = db
    .prepare(
      `SELECT u.id, u.name, u.code, u.active,
         (SELECT COUNT(*) FROM users e WHERE e.unit_id = u.id AND e.role = 'employee') AS employees,
         (SELECT COUNT(*) FROM tickets t WHERE t.unit_id = u.id AND t.status != 'cancelled') AS tickets
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

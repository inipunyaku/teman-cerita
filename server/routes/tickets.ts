import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { Router, type Request } from 'express';
import { z } from 'zod';
import { db, now, tx } from '../db.js';
import { requireRole, requireVerified, type UserRow } from '../auth.js';
import { publish } from '../events.js';
import { adminIds, formatWhen, notify } from '../notify.js';
import { config } from '../config.js';
import { fail, HttpError, intParam, parse } from '../util.js';
import {
  ACTIVE_STATUSES,
  ATTACHMENT_KIND_LABEL,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_TYPES,
  attachmentExt,
  CHAT_GRACE_DAYS,
  MODE_LABEL,
  REPORT_TOPICS,
  REQUEST_TOPICS,
  SEVERITY_LABEL,
  type Mode,
  type Role,
  type TicketStatus,
} from '../../shared/constants.js';

export const ticketsRouter = Router();

// ---------------------------------------------------------------------------
// Helpers

export interface TicketRow {
  id: number;
  code: string;
  employee_id: number;
  unit_id: number | null;
  psychologist_id: number | null;
  topic: string;
  story: string | null;
  preferred_mode: Mode;
  mode: Mode;
  urgency: string;
  preferred_slots: string;
  status: TicketStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  location: string | null;
  meeting_url: string | null;
  admin_note: string | null;
  cancel_reason: string | null;
  first_scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  employee_name?: string;
  employee_pn?: string;
  employee_phone?: string;
  unit_name?: string | null;
  psychologist_name?: string | null;
  psychologist_title?: string | null;
  employee_avatar?: string | null;
  employee_tone?: string | null;
  employee_status?: string | null;
  psychologist_avatar?: string | null;
  psychologist_tone?: string | null;
  psychologist_status?: string | null;
  severity?: string | null;
  unread?: number;
}

const SELECT = `
  SELECT t.*, e.name AS employee_name, e.pn AS employee_pn, e.phone AS employee_phone, u.name AS unit_name,
         e.avatar_url AS employee_avatar, e.avatar_tone AS employee_tone, e.status_text AS employee_status,
         p.name AS psychologist_name, p.title AS psychologist_title,
         p.avatar_url AS psychologist_avatar, p.avatar_tone AS psychologist_tone, p.status_text AS psychologist_status,
         r.severity AS severity
  FROM tickets t
  JOIN users e ON e.id = t.employee_id
  LEFT JOIN units u ON u.id = t.unit_id
  LEFT JOIN users p ON p.id = t.psychologist_id
  LEFT JOIN reports r ON r.ticket_id = t.id`;

export const linkFor = (role: Role, id: number) =>
  role === 'admin' ? `/admin/tiket/${id}` : role === 'psychologist' ? `/psikolog/sesi/${id}` : `/tiket/${id}`;

function serialize(t: TicketRow, viewer: UserRow) {
  return {
    id: t.id,
    code: t.code,
    status: t.status,
    topic: t.topic,
    story: t.story,
    preferredMode: t.preferred_mode,
    mode: t.mode,
    urgency: t.urgency,
    preferredSlots: JSON.parse(t.preferred_slots || '[]'),
    scheduledStart: t.scheduled_start,
    scheduledEnd: t.scheduled_end,
    location: t.location,
    meetingUrl: t.meeting_url,
    adminNote: t.admin_note,
    cancelReason: t.cancel_reason,
    startedAt: t.started_at,
    completedAt: t.completed_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    employee: {
      id: t.employee_id,
      name: t.employee_name,
      pn: viewer.role === 'employee' ? undefined : t.employee_pn,
      phone: viewer.role === 'employee' ? undefined : t.employee_phone,
      unitName: t.unit_name,
      avatarUrl: t.employee_avatar ?? null,
      avatarTone: t.employee_tone ?? null,
      statusText: t.employee_status ?? null,
    },
    psychologist: t.psychologist_id
      ? {
          id: t.psychologist_id,
          name: t.psychologist_name,
          title: t.psychologist_title,
          avatarUrl: t.psychologist_avatar ?? null,
          avatarTone: t.psychologist_tone ?? null,
          statusText: t.psychologist_status ?? null,
        }
      : null,
    severity: viewer.role === 'employee' ? undefined : (t.severity ?? null),
    unread: t.unread ?? 0,
  };
}

function loadTicket(id: number) {
  return db.prepare(`${SELECT} WHERE t.id = ?`).get(id) as TicketRow | undefined;
}

/** Ambil tiket dan pastikan viewer berhak melihatnya. */
function getAccessible(req: Request) {
  const viewer = req.user!;
  const t = loadTicket(intParam(req.params.id));
  if (!t) return fail(404, 'Tiket tidak ditemukan.');
  if (viewer.role === 'employee' && t.employee_id !== viewer.id) fail(404, 'Tiket tidak ditemukan.');
  if (viewer.role === 'psychologist' && t.psychologist_id !== viewer.id) fail(404, 'Tiket tidak ditemukan.');
  return t;
}

const insertEvent = db.prepare(
  'INSERT INTO ticket_events (ticket_id, actor_id, type, message, created_at) VALUES (?,?,?,?,?)',
);
function logEvent(ticketId: number, actorId: number | null, type: string, message: string) {
  insertEvent.run(ticketId, actorId, type, message, now());
}

/** Kabari semua pihak (yang sedang membuka aplikasi) agar data tiket dimuat ulang. */
function broadcastTicket(t: { id: number; employee_id: number; psychologist_id: number | null }, extra: number[] = []) {
  publish([t.employee_id, ...(t.psychologist_id ? [t.psychologist_id] : []), ...adminIds(), ...extra], 'ticket', {
    id: t.id,
  });
}

function nextCode() {
  const year = new Date().getFullYear();
  const row = db
    .prepare(`SELECT code FROM tickets WHERE code LIKE ? ORDER BY code DESC LIMIT 1`)
    .get(`TC-${year}-%`) as { code: string } | undefined;
  const n = row ? Number(row.code.split('-')[2]) + 1 : 1;
  return `TC-${year}-${String(n).padStart(4, '0')}`;
}

const slotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid.'),
  from: z.string().regex(/^\d{2}:\d{2}$/),
  to: z.string().regex(/^\d{2}:\d{2}$/),
});
const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Waktu tidak valid.');
const modeEnum = z.enum(['chat', 'online', 'offline']);

export function findConflicts(psychologistId: number, start: string, end: string, excludeTicketId?: number) {
  return db
    .prepare(
      `SELECT t.id, t.code, t.scheduled_start, t.scheduled_end, e.name AS employee_name
       FROM tickets t JOIN users e ON e.id = t.employee_id
       WHERE t.psychologist_id = ? AND t.status IN ('scheduled','reschedule_requested','in_progress')
         AND t.id != ? AND t.scheduled_start < ? AND t.scheduled_end > ?`,
    )
    .all(psychologistId, excludeTicketId ?? 0, end, start) as {
    id: number;
    code: string;
    scheduled_start: string;
    scheduled_end: string;
    employee_name: string;
  }[];
}

// ---------------------------------------------------------------------------
// Daftar & detail

ticketsRouter.get('/', requireVerified, (req, res) => {
  const viewer = req.user!;
  const where: string[] = [];
  const params: unknown[] = [];
  if (viewer.role === 'employee') {
    where.push('t.employee_id = ?');
    params.push(viewer.id);
  } else if (viewer.role === 'psychologist') {
    where.push('t.psychologist_id = ?');
    params.push(viewer.id);
  }
  const q = req.query as Record<string, string | undefined>;
  if (q.status === 'active') where.push(`t.status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})`), params.push(...ACTIVE_STATUSES);
  else if (q.status) where.push('t.status = ?'), params.push(q.status);
  if (q.mode) where.push('t.mode = ?'), params.push(q.mode);
  if (q.urgency) where.push('t.urgency = ?'), params.push(q.urgency);
  if (q.unit) where.push('t.unit_id = ?'), params.push(Number(q.unit));
  if (q.psychologist) where.push('t.psychologist_id = ?'), params.push(Number(q.psychologist));
  if (q.from) where.push('t.scheduled_start >= ?'), params.push(q.from);
  if (q.to) where.push('t.scheduled_start < ?'), params.push(q.to);
  if (q.q) {
    where.push('(t.code LIKE ? OR e.name LIKE ? OR e.pn LIKE ?)');
    params.push(`%${q.q}%`, `%${q.q}%`, `%${q.q}%`);
  }
  const order =
    viewer.role === 'admin'
      ? `CASE t.status WHEN 'reschedule_requested' THEN 0 WHEN 'pending' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'scheduled' THEN 3 ELSE 4 END,
         CASE t.urgency WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, t.created_at DESC`
      : viewer.role === 'psychologist'
        ? `CASE WHEN t.status IN ('completed','cancelled') THEN 1 ELSE 0 END, t.scheduled_start ASC`
        : 't.created_at DESC';
  const limit = Math.min(Number(q.limit) || 200, 500);
  const unread =
    viewer.role === 'admin'
      ? '0'
      : '(SELECT COUNT(*) FROM messages m WHERE m.ticket_id = t.id AND m.sender_id != ? AND m.read_at IS NULL)';
  const sql = `${SELECT.replace('FROM tickets t', `, ${unread} AS unread FROM tickets t`)}
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT ${limit}`;
  const rows = db
    .prepare(sql)
    .all(...(viewer.role === 'admin' ? params : [viewer.id, ...params])) as TicketRow[];
  res.json({ tickets: rows.map((t) => serialize(t, viewer)) });
});

ticketsRouter.get('/:id', requireVerified, (req, res) => {
  const viewer = req.user!;
  const t = getAccessible(req);
  const events = db
    .prepare(
      `SELECT ev.id, ev.type, ev.message, ev.created_at AS createdAt, u.name AS actorName, u.role AS actorRole
       FROM ticket_events ev LEFT JOIN users u ON u.id = ev.actor_id WHERE ev.ticket_id = ? ORDER BY ev.id`,
    )
    .all(t.id);
  const reschedules = (
    db.prepare(`SELECT * FROM reschedule_requests WHERE ticket_id = ? ORDER BY id DESC`).all(t.id) as Record<
      string,
      unknown
    >[]
  ).map((r) => ({
    id: r.id,
    reason: r.reason,
    proposedSlots: JSON.parse(String(r.proposed_slots)),
    status: r.status,
    responseNote: r.response_note,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
  }));

  const reportRow = db.prepare('SELECT * FROM reports WHERE ticket_id = ?').get(t.id) as
    | Record<string, string | number | null>
    | undefined;
  const topics = (db.prepare('SELECT topic FROM report_topics WHERE ticket_id = ?').all(t.id) as { topic: string }[]).map(
    (r) => r.topic,
  );
  let report: Record<string, unknown> | null = null;
  if (reportRow) {
    if (viewer.role === 'psychologist') {
      report = {
        severity: reportRow.severity,
        topics,
        summary: reportRow.summary,
        recommendation: reportRow.recommendation,
        noteForEmployee: reportRow.note_for_employee,
        followUp: !!reportRow.follow_up,
        createdAt: reportRow.created_at,
      };
    } else if (viewer.role === 'admin') {
      // Admin hanya melihat metadata untuk statistik — isi sesi tetap rahasia.
      report = { severity: reportRow.severity, topics, followUp: !!reportRow.follow_up, createdAt: reportRow.created_at };
    } else {
      report = { noteForEmployee: reportRow.note_for_employee, followUp: !!reportRow.follow_up };
    }
  }
  const review = db.prepare('SELECT rating, comment, created_at AS createdAt FROM reviews WHERE ticket_id = ?').get(t.id);

  res.json({
    ticket: serialize(t, viewer),
    events,
    reschedules,
    report,
    review: review ?? null,
    chat: chatState(t),
  });
});

// ---------------------------------------------------------------------------
// Karyawan

const createSchema = z.object({
  topic: z.enum(Object.keys(REQUEST_TOPICS) as [string, ...string[]], { message: 'Pilih topik.' }),
  story: z.string().trim().max(2000, 'Cerita maksimal 2000 karakter.').optional().default(''),
  mode: modeEnum,
  urgency: z.enum(['low', 'normal', 'high']),
  // Jadwal ditentukan admin; preferensi waktu opsional (dipertahankan untuk kompatibilitas).
  slots: z.array(slotSchema).max(3).optional().default([]),
});

ticketsRouter.post('/', requireRole('employee'), (req, res) => {
  const u = req.user!;
  const data = parse(createSchema, req.body);
  const active = db
    .prepare(`SELECT code FROM tickets WHERE employee_id = ? AND status IN ('pending','scheduled','reschedule_requested','in_progress')`)
    .get(u.id) as { code: string } | undefined;
  if (active) fail(409, `Kamu masih punya tiket aktif (${active.code}). Selesaikan atau batalkan dulu ya.`);

  const id = tx(() => {
    const ts = now();
    const code = nextCode();
    const info = db
      .prepare(
        `INSERT INTO tickets (code, employee_id, unit_id, topic, story, preferred_mode, mode, urgency, preferred_slots, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?, 'pending', ?, ?)`,
      )
      .run(code, u.id, u.unit_id, data.topic, data.story || null, data.mode, data.mode, data.urgency, JSON.stringify(data.slots), ts, ts);
    const id = Number(info.lastInsertRowid);
    logEvent(id, u.id, 'created', `Permintaan diajukan (${MODE_LABEL[data.mode]}).`);
    return id;
  });
  const t = loadTicket(id)!;
  notify(adminIds(), {
    type: 'ticket.created',
    title: data.urgency === 'high' ? `Permintaan MENDESAK ${t.code}` : `Permintaan baru ${t.code}`,
    body: `${u.name} mengajukan sesi ${MODE_LABEL[data.mode].toLowerCase()} — topik ${REQUEST_TOPICS[data.topic as keyof typeof REQUEST_TOPICS]}.`,
    link: linkFor('admin', id),
    priority: data.urgency === 'high',
  });
  broadcastTicket(t);
  res.status(201).json({ ticket: serialize(t, u) });
});

ticketsRouter.post('/:id/cancel', requireRole('employee', 'admin'), (req, res) => {
  const viewer = req.user!;
  const t = getAccessible(req);
  const { reason } = parse(z.object({ reason: z.string().trim().min(3, 'Tuliskan alasan pembatalan.').max(500) }), req.body);
  if (!['pending', 'scheduled', 'reschedule_requested'].includes(t.status)) fail(400, 'Tiket ini sudah tidak bisa dibatalkan.');
  tx(() => {
    db.prepare(`UPDATE tickets SET status='cancelled', cancel_reason=?, cancelled_by=?, updated_at=? WHERE id=?`).run(reason, viewer.id, now(), t.id);
    db.prepare(`UPDATE reschedule_requests SET status='rejected', response_note='Tiket dibatalkan', decided_at=? WHERE ticket_id=? AND status='pending'`).run(now(), t.id);
    logEvent(t.id, viewer.id, 'cancelled', `Dibatalkan oleh ${viewer.role === 'admin' ? 'admin' : 'karyawan'}: ${reason}`);
  });
  const by = viewer.role === 'admin' ? 'admin' : t.employee_name;
  if (viewer.role === 'admin') {
    notify(t.employee_id, { type: 'ticket.cancelled', title: `Tiket ${t.code} dibatalkan`, body: `Admin membatalkan tiketmu. Alasan: ${reason}`, link: linkFor('employee', t.id) });
  } else {
    notify(adminIds(), { type: 'ticket.cancelled', title: `Tiket ${t.code} dibatalkan`, body: `${by} membatalkan tiket. Alasan: ${reason}`, link: linkFor('admin', t.id) });
  }
  if (t.psychologist_id) {
    notify(t.psychologist_id, { type: 'ticket.cancelled', title: `Sesi ${t.code} dibatalkan`, body: `Sesi pada ${formatWhen(t.scheduled_start)} dibatalkan oleh ${by}.`, link: linkFor('psychologist', t.id) });
  }
  broadcastTicket(t);
  res.json({ ok: true });
});

ticketsRouter.post('/:id/reschedule', requireRole('employee'), (req, res) => {
  const u = req.user!;
  const t = getAccessible(req);
  const data = parse(
    z.object({
      reason: z.string().trim().min(5, 'Ceritakan sedikit alasannya (min. 5 karakter).').max(500),
      slots: z.array(slotSchema).max(3).optional().default([]),
    }),
    req.body,
  );
  if (t.status !== 'scheduled') fail(400, 'Jadwal ulang hanya bisa diajukan untuk sesi yang sudah dijadwalkan.');
  tx(() => {
    db.prepare(`INSERT INTO reschedule_requests (ticket_id, requested_by, reason, proposed_slots, created_at) VALUES (?,?,?,?,?)`).run(t.id, u.id, data.reason, JSON.stringify(data.slots), now());
    db.prepare(`UPDATE tickets SET status='reschedule_requested', updated_at=? WHERE id=?`).run(now(), t.id);
    logEvent(t.id, u.id, 'reschedule_requested', `Mengajukan jadwal ulang: ${data.reason}`);
  });
  notify(adminIds(), { type: 'reschedule.requested', title: `Permintaan jadwal ulang ${t.code}`, body: `${u.name} meminta jadwal ulang. Alasan: ${data.reason}`, link: linkFor('admin', t.id) });
  if (t.psychologist_id) {
    notify(t.psychologist_id, { type: 'reschedule.requested', title: `${t.code}: karyawan minta jadwal ulang`, body: `Jadwal ${formatWhen(t.scheduled_start)} sedang diajukan ulang. Admin akan mengonfirmasi jadwal baru.`, link: linkFor('psychologist', t.id) });
  }
  broadcastTicket(t);
  res.json({ ok: true });
});

ticketsRouter.post('/:id/review', requireRole('employee'), (req, res) => {
  const t = getAccessible(req);
  const data = parse(z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() }), req.body);
  if (t.status !== 'completed') fail(400, 'Ulasan bisa diberikan setelah sesi selesai.');
  if (db.prepare('SELECT 1 FROM reviews WHERE ticket_id = ?').get(t.id)) fail(409, 'Kamu sudah memberi ulasan untuk sesi ini.');
  db.prepare('INSERT INTO reviews (ticket_id, rating, comment, created_at) VALUES (?,?,?,?)').run(t.id, data.rating, data.comment || null, now());
  logEvent(t.id, req.user!.id, 'reviewed', `Memberi ulasan ${data.rating}/5.`);
  broadcastTicket(t);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: penjadwalan

const scheduleSchema = z
  .object({
    psychologistId: z.number().int().positive({ message: 'Pilih psikolog.' }),
    mode: modeEnum,
    start: isoDate,
    end: isoDate,
    location: z.string().trim().max(200).optional().default(''),
    meetingUrl: z.string().trim().max(500).optional().default(''),
    note: z.string().trim().max(500).optional().default(''),
    force: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    if (Date.parse(d.end) <= Date.parse(d.start)) ctx.addIssue({ code: 'custom', path: ['end'], message: 'Jam selesai harus setelah jam mulai.' });
    if (d.mode === 'offline' && !d.location) ctx.addIssue({ code: 'custom', path: ['location'], message: 'Isi lokasi/ruangan untuk sesi tatap muka.' });
    if (d.mode === 'online' && !/^https?:\/\/\S+$/.test(d.meetingUrl)) ctx.addIssue({ code: 'custom', path: ['meetingUrl'], message: 'Isi tautan meeting yang valid (https://...).' });
  });

function checkPsychologist(id: number) {
  const p = db.prepare(`SELECT id, name FROM users WHERE id = ? AND role = 'psychologist' AND status = 'verified'`).get(id) as
    | { id: number; name: string }
    | undefined;
  if (!p) fail(400, 'Psikolog tidak ditemukan atau nonaktif.');
  return p!;
}

function guardConflicts(psychologistId: number, start: string, end: string, ticketId: number, force?: boolean) {
  const conflicts = findConflicts(psychologistId, start, end, ticketId);
  if (conflicts.length && !force) {
    throw Object.assign(new Error('conflict'), { conflicts });
  }
}

ticketsRouter.post('/:id/assign', requireRole('admin'), (req, res) => {
  const admin = req.user!;
  const t = getAccessible(req);
  const d = parse(scheduleSchema, req.body);
  if (!['pending', 'scheduled'].includes(t.status)) fail(400, 'Tiket ini tidak bisa dijadwalkan pada status sekarang.');
  const psych = checkPsychologist(d.psychologistId);
  const start = new Date(d.start).toISOString();
  const end = new Date(d.end).toISOString();
  try {
    guardConflicts(psych.id, start, end, t.id, d.force);
  } catch (e) {
    return res.status(409).json({ error: 'Psikolog sudah punya sesi di waktu tersebut.', code: 'CONFLICT', conflicts: (e as { conflicts: unknown }).conflicts });
  }
  const isReassign = t.status === 'scheduled';
  const prevPsych = t.psychologist_id;
  tx(() => {
    db.prepare(
      `UPDATE tickets SET status='scheduled', psychologist_id=?, mode=?, scheduled_start=?, scheduled_end=?, location=?, meeting_url=?, admin_note=?,
       first_scheduled_at=COALESCE(first_scheduled_at, ?), updated_at=? WHERE id=?`,
    ).run(psych.id, d.mode, start, end, d.mode === 'offline' ? d.location : null, d.mode === 'online' ? d.meetingUrl : null, d.note || null, now(), now(), t.id);
    logEvent(t.id, admin.id, isReassign ? 'rescheduled' : 'scheduled', `${isReassign ? 'Jadwal diperbarui' : 'Dijadwalkan'} dengan ${psych.name} — ${formatWhen(start)} (${MODE_LABEL[d.mode]}).`);
  });
  const where = d.mode === 'offline' ? `Lokasi: ${d.location}.` : d.mode === 'online' ? 'Tautan meeting tersedia di aplikasi.' : 'Sesi berlangsung lewat chat di aplikasi.';
  notify(t.employee_id, {
    type: 'ticket.scheduled',
    title: isReassign ? `Jadwal ${t.code} diperbarui` : `Sesimu sudah dijadwalkan`,
    body: `${MODE_LABEL[d.mode]} bersama ${psych.name}, ${formatWhen(start)}. ${where}`,
    link: linkFor('employee', t.id),
  });
  notify(psych.id, {
    type: 'ticket.assigned',
    title: isReassign && prevPsych === psych.id ? `Jadwal ${t.code} diperbarui` : `Sesi baru: ${t.code}`,
    body: `${MODE_LABEL[d.mode]} dengan ${t.employee_name} (${t.unit_name ?? '-'}), ${formatWhen(start)}.`,
    link: linkFor('psychologist', t.id),
  });
  if (prevPsych && prevPsych !== psych.id) {
    notify(prevPsych, { type: 'ticket.unassigned', title: `Sesi ${t.code} dialihkan`, body: `Sesi ini dialihkan ke psikolog lain oleh admin.`, email: false });
  }
  broadcastTicket(loadTicket(t.id)!, prevPsych ? [prevPsych] : []);
  res.json({ ok: true });
});

ticketsRouter.post('/:id/reschedule/decide', requireRole('admin'), (req, res) => {
  const admin = req.user!;
  const t = getAccessible(req);
  if (t.status !== 'reschedule_requested') fail(400, 'Tidak ada permintaan jadwal ulang yang menunggu.');
  const pendingReq = db.prepare(`SELECT id FROM reschedule_requests WHERE ticket_id = ? AND status='pending' ORDER BY id DESC`).get(t.id) as { id: number } | undefined;
  const approve = req.body?.approve === true;

  if (!approve) {
    const { note } = parse(z.object({ note: z.string().trim().min(3, 'Tuliskan alasan penolakan.').max(500) }), req.body);
    tx(() => {
      if (pendingReq) db.prepare(`UPDATE reschedule_requests SET status='rejected', response_note=?, decided_by=?, decided_at=? WHERE id=?`).run(note, admin.id, now(), pendingReq.id);
      db.prepare(`UPDATE tickets SET status='scheduled', updated_at=? WHERE id=?`).run(now(), t.id);
      logEvent(t.id, admin.id, 'reschedule_rejected', `Jadwal ulang ditolak: ${note}`);
    });
    notify(t.employee_id, { type: 'reschedule.rejected', title: `Jadwal ulang ${t.code} belum bisa disetujui`, body: `Jadwal tetap ${formatWhen(t.scheduled_start)}. Catatan admin: ${note}`, link: linkFor('employee', t.id) });
    if (t.psychologist_id) notify(t.psychologist_id, { type: 'reschedule.rejected', title: `${t.code}: jadwal tetap`, body: `Permintaan jadwal ulang ditolak. Sesi tetap ${formatWhen(t.scheduled_start)}.`, link: linkFor('psychologist', t.id) });
    broadcastTicket(t);
    return res.json({ ok: true });
  }

  const d = parse(scheduleSchema, req.body);
  const psych = checkPsychologist(d.psychologistId);
  const start = new Date(d.start).toISOString();
  const end = new Date(d.end).toISOString();
  try {
    guardConflicts(psych.id, start, end, t.id, d.force);
  } catch (e) {
    return res.status(409).json({ error: 'Psikolog sudah punya sesi di waktu tersebut.', code: 'CONFLICT', conflicts: (e as { conflicts: unknown }).conflicts });
  }
  const prevPsych = t.psychologist_id;
  tx(() => {
    if (pendingReq) db.prepare(`UPDATE reschedule_requests SET status='approved', response_note=?, decided_by=?, decided_at=? WHERE id=?`).run(d.note || null, admin.id, now(), pendingReq.id);
    db.prepare(
      `UPDATE tickets SET status='scheduled', psychologist_id=?, mode=?, scheduled_start=?, scheduled_end=?, location=?, meeting_url=?, admin_note=COALESCE(NULLIF(?, ''), admin_note), updated_at=? WHERE id=?`,
    ).run(psych.id, d.mode, start, end, d.mode === 'offline' ? d.location : null, d.mode === 'online' ? d.meetingUrl : null, d.note, now(), t.id);
    logEvent(t.id, admin.id, 'rescheduled', `Jadwal ulang disetujui — ${formatWhen(start)} dengan ${psych.name}.`);
  });
  notify(t.employee_id, { type: 'reschedule.approved', title: `Jadwal ulang ${t.code} disetujui`, body: `Jadwal barumu: ${formatWhen(start)} bersama ${psych.name} (${MODE_LABEL[d.mode]}).`, link: linkFor('employee', t.id) });
  notify(psych.id, { type: 'reschedule.approved', title: `Jadwal baru ${t.code}`, body: `Sesi dengan ${t.employee_name} dipindah ke ${formatWhen(start)}.`, link: linkFor('psychologist', t.id) });
  if (prevPsych && prevPsych !== psych.id) notify(prevPsych, { type: 'ticket.unassigned', title: `Sesi ${t.code} dialihkan`, body: 'Sesi ini dialihkan ke psikolog lain.', email: false });
  broadcastTicket(loadTicket(t.id)!, prevPsych ? [prevPsych] : []);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Psikolog: sesi & laporan

ticketsRouter.post('/:id/start', requireRole('psychologist'), (req, res) => {
  const p = req.user!;
  const t = getAccessible(req);
  if (t.status !== 'scheduled') fail(400, 'Sesi hanya bisa dimulai dari status Dijadwalkan.');
  tx(() => {
    db.prepare(`UPDATE tickets SET status='in_progress', started_at=?, updated_at=? WHERE id=?`).run(now(), now(), t.id);
    logEvent(t.id, p.id, 'started', 'Sesi dimulai.');
  });
  notify(t.employee_id, {
    type: 'session.started',
    title: 'Sesimu sudah dimulai',
    body: t.mode === 'chat' ? `${p.name} sudah di ruang chat. Yuk mulai cerita.` : t.mode === 'online' ? `${p.name} sudah memulai sesi. Buka tautan meeting di aplikasi.` : `${p.name} sudah siap di ${t.location ?? 'ruang konseling'}.`,
    link: linkFor('employee', t.id),
  });
  broadcastTicket(t);
  res.json({ ok: true });
});

const reportSchema = z.object({
  severity: z.enum(['ringan', 'sedang', 'berat', 'kritis'], { message: 'Pilih tingkat keparahan.' }),
  topics: z.array(z.enum(Object.keys(REPORT_TOPICS) as [string, ...string[]])).min(1, 'Pilih minimal satu topik.'),
  summary: z.string().trim().min(10, 'Ringkasan sesi minimal 10 karakter.').max(5000),
  recommendation: z.string().trim().max(3000).optional().default(''),
  noteForEmployee: z.string().trim().max(1500).optional().default(''),
  followUp: z.boolean(),
});

ticketsRouter.post('/:id/complete', requireRole('psychologist'), (req, res) => {
  const p = req.user!;
  const t = getAccessible(req);
  const d = parse(reportSchema, req.body);
  if (!['scheduled', 'in_progress'].includes(t.status)) fail(400, 'Sesi ini tidak bisa diselesaikan pada status sekarang.');
  tx(() => {
    const ts = now();
    db.prepare(
      `INSERT INTO reports (ticket_id, psychologist_id, severity, summary, recommendation, note_for_employee, follow_up, created_at) VALUES (?,?,?,?,?,?,?,?)`,
    ).run(t.id, p.id, d.severity, d.summary, d.recommendation || null, d.noteForEmployee || null, d.followUp ? 1 : 0, ts);
    const ins = db.prepare('INSERT INTO report_topics (ticket_id, topic) VALUES (?,?)');
    for (const topic of new Set(d.topics)) ins.run(t.id, topic);
    db.prepare(`UPDATE tickets SET status='completed', started_at=COALESCE(started_at, ?), completed_at=?, updated_at=? WHERE id=?`).run(ts, ts, ts, t.id);
    logEvent(t.id, p.id, 'completed', 'Sesi selesai dan laporan diisi.');
  });
  notify(t.employee_id, {
    type: 'session.completed',
    title: 'Terima kasih sudah bercerita',
    body: d.noteForEmployee ? `${p.name} meninggalkan catatan untukmu. Kamu juga bisa memberi ulasan sesi.` : `Sesimu bersama ${p.name} sudah selesai. Kamu bisa memberi ulasan sesi.`,
    link: linkFor('employee', t.id),
  });
  if (d.severity === 'kritis' || d.severity === 'berat') {
    notify(adminIds(), {
      type: 'report.severe',
      title: `${d.severity === 'kritis' ? 'PRIORITAS' : 'Perhatian'}: laporan ${SEVERITY_LABEL[d.severity]} — ${t.code}`,
      body: `${p.name} menandai sesi ${t.code} (${t.unit_name ?? '-'}) dengan keparahan ${SEVERITY_LABEL[d.severity]}${d.followUp ? ' dan membutuhkan sesi lanjutan' : ''}. Ikuti SOP eskalasi.`,
      link: linkFor('admin', t.id),
      priority: d.severity === 'kritis',
      email: d.severity === 'kritis',
    });
  }
  broadcastTicket(t);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Chat

function chatState(t: TicketRow) {
  if (!t.psychologist_id) return { canRead: false, canSend: false, reason: 'Ruang chat terbuka setelah psikolog ditetapkan.' };
  if (t.status === 'cancelled') return { canRead: true, canSend: false, reason: 'Tiket dibatalkan. Chat hanya bisa dibaca.' };
  if (t.status === 'completed') {
    const closesAt = new Date(Date.parse(t.completed_at!) + CHAT_GRACE_DAYS * 864e5);
    if (Date.now() > closesAt.getTime()) return { canRead: true, canSend: false, reason: 'Ruang chat sudah ditutup. Ajukan sesi baru bila perlu.' };
    return { canRead: true, canSend: true, reason: null, closesAt: closesAt.toISOString() };
  }
  return { canRead: true, canSend: true, reason: null };
}

function chatAccess(req: Request) {
  const viewer = req.user!;
  if (viewer.role === 'admin') fail(403, 'Isi chat bersifat rahasia antara karyawan dan psikolog.');
  return getAccessible(req);
}

export const ATTACHMENT_DIR = path.join(path.dirname(config.databasePath), 'attachments');
fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });

interface MessageRow {
  id: number;
  senderId: number;
  body: string;
  readAt: string | null;
  createdAt: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
}

function serializeMessage(ticketId: number, m: MessageRow) {
  const { file_name, file_type, file_size, ...rest } = m;
  const attachment = file_name
    ? {
        name: file_name,
        type: file_type!,
        size: file_size!,
        kind: ATTACHMENT_TYPES[attachmentExt(file_name)]?.kind ?? 'document',
        url: `/api/tickets/${ticketId}/messages/${m.id}/file`,
      }
    : null;
  return { ...rest, ticketId, attachment };
}

const MESSAGE_COLS = 'id, sender_id AS senderId, body, read_at AS readAt, created_at AS createdAt, file_name, file_type, file_size';

ticketsRouter.get('/:id/messages', requireVerified, (req, res) => {
  const t = chatAccess(req);
  const state = chatState(t);
  if (!state.canRead) return res.json({ messages: [], state });
  const rows = db.prepare(`SELECT ${MESSAGE_COLS} FROM messages WHERE ticket_id = ? ORDER BY id`).all(t.id) as MessageRow[];
  res.json({ messages: rows.map((m) => serializeMessage(t.id, m)), state });
});

const chatNoticeExists = db.prepare(`SELECT 1 FROM notifications WHERE user_id = ? AND type = 'chat.message' AND link = ? AND read_at IS NULL`);

function deliverMessage(u: UserRow, t: TicketRow, body: string, file?: { path: string; name: string; type: string; size: number }) {
  const info = db
    .prepare('INSERT INTO messages (ticket_id, sender_id, body, file_path, file_name, file_type, file_size, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(t.id, u.id, body, file?.path ?? null, file?.name ?? null, file?.type ?? null, file?.size ?? null, now());
  const row = db.prepare(`SELECT ${MESSAGE_COLS} FROM messages WHERE id = ?`).get(info.lastInsertRowid) as MessageRow;
  const message = serializeMessage(t.id, row);
  const other = u.id === t.employee_id ? t.psychologist_id! : t.employee_id;
  publish([u.id, other], 'message', message);
  const otherRole: Role = other === t.employee_id ? 'employee' : 'psychologist';
  const link = linkFor(otherRole, t.id);
  if (!chatNoticeExists.get(other, link)) {
    const preview = message.attachment ? `📎 ${ATTACHMENT_KIND_LABEL[message.attachment.kind]}: ${message.attachment.name}` : body;
    notify(other, { type: 'chat.message', title: `Pesan baru dari ${u.name}`, body: preview.length > 90 ? preview.slice(0, 90) + '…' : preview, link, email: false });
  }
  return message;
}

ticketsRouter.post('/:id/messages', requireVerified, (req, res) => {
  const u = req.user!;
  const t = chatAccess(req);
  const state = chatState(t);
  if (!state.canSend) fail(400, state.reason ?? 'Chat tidak tersedia.');
  const { body } = parse(z.object({ body: z.string().trim().min(1, 'Pesan kosong.').max(4000, 'Pesan terlalu panjang.') }), req.body);
  res.status(201).json({ message: deliverMessage(u, t, body) });
});

// Lampiran dikirim sebagai body mentah (bukan base64) supaya batas 2 MB berlaku apa adanya.
const rawUpload = express.raw({ type: () => true, limit: ATTACHMENT_MAX_BYTES });

ticketsRouter.post('/:id/attachments', requireVerified, (req, res, next) => {
  // Cek akses & ukuran sebelum membaca body, supaya unggahan yang ditolak tidak sempat diterima penuh.
  const t = chatAccess(req);
  const state = chatState(t);
  if (!state.canSend) fail(400, state.reason ?? 'Chat tidak tersedia.');
  if (Number(req.headers['content-length'] ?? 0) > ATTACHMENT_MAX_BYTES) fail(413, 'Ukuran file maksimal 2 MB.');
  rawUpload(req, res, (err?: unknown) => {
    if (err) return next((err as { type?: string }).type === 'entity.too.large' ? new HttpError(413, 'Ukuran file maksimal 2 MB.') : err);
    try {
      const u = req.user!;
      let name = '';
      try {
        name = decodeURIComponent(String(req.headers['x-file-name'] ?? ''));
      } catch {
        /* nama tidak valid → ditolak di bawah */
      }
      name = path.basename(name).replace(/[\u0000-\u001f"\\]/g, '').trim().slice(-120);
      const ext = attachmentExt(name);
      const spec = ATTACHMENT_TYPES[ext];
      if (!name || !spec) fail(400, 'Jenis file tidak didukung. Kirim foto (JPG/PNG/WebP/GIF), video (MP4/WebM/MOV), atau dokumen (PDF/Word/Excel/PowerPoint/TXT).');
      const buf = req.body as Buffer;
      if (!Buffer.isBuffer(buf) || buf.length === 0) fail(400, 'File kosong.');
      const stored = `${t.id}-${crypto.randomBytes(12).toString('hex')}.${ext}`;
      fs.writeFileSync(path.join(ATTACHMENT_DIR, stored), buf);
      res.status(201).json({ message: deliverMessage(u, t, '', { path: stored, name, type: spec!.mime, size: buf.length }) });
    } catch (e) {
      next(e);
    }
  });
});

ticketsRouter.get('/:id/messages/:messageId/file', requireVerified, (req, res) => {
  const t = chatAccess(req);
  if (!chatState(t).canRead) fail(404, 'File tidak ditemukan.');
  const m = db
    .prepare('SELECT file_path, file_name, file_type FROM messages WHERE id = ? AND ticket_id = ? AND file_path IS NOT NULL')
    .get(intParam(req.params.messageId), t.id) as { file_path: string; file_name: string; file_type: string } | undefined;
  if (!m) fail(404, 'File tidak ditemukan.');
  const kind = ATTACHMENT_TYPES[attachmentExt(m!.file_name)]?.kind;
  const inline = (kind === 'image' || kind === 'video') && req.query.download === undefined;
  res.setHeader('Content-Type', m!.file_type);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(m!.file_name)}`);
  res.sendFile(path.join(ATTACHMENT_DIR, path.basename(m!.file_path)), { headers: { 'Content-Type': m!.file_type } }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'File tidak ditemukan.' });
  });
});

ticketsRouter.post('/:id/messages/read', requireVerified, (req, res) => {
  const u = req.user!;
  const t = chatAccess(req);
  const changed = db.prepare(`UPDATE messages SET read_at = ? WHERE ticket_id = ? AND sender_id != ? AND read_at IS NULL`).run(now(), t.id, u.id).changes;
  db.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND type = 'chat.message' AND link = ? AND read_at IS NULL`).run(now(), u.id, linkFor(u.role, t.id));
  if (changed) {
    const other = u.id === t.employee_id ? t.psychologist_id : t.employee_id;
    if (other) publish(other, 'read', { ticketId: t.id });
  }
  res.json({ ok: true });
});

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
import { assertSlotEligible, eligibility, reserveSlot, wibToday } from '../scheduling.js';
import { fail, HttpError, intParam, parse, pageParams } from '../util.js';
import {
  ATTACHMENT_KIND_LABEL,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_TYPES,
  attachmentExt,
  CASE_CATEGORIES,
  CHAT_GRACE_DAYS,
  CLIENT_TOPICS,
  COMPLAINT_MIN,
  FEEDBACK_ITEMS,
  MODE_LABEL,
  OUTCOME_LABEL,
  ROOM_PREFIX,
  SCHEDULE,
  SCREENING_ITEMS,
  satisfactionLevel,
  scoreScreening,
  type Mode,
  type Outcome,
  type Role,
  type TicketStatus,
} from '../../shared/constants.js';
import { SERVICE_CONFIG } from '../serviceConfig.js';

export const ticketsRouter = Router();

// ---------------------------------------------------------------------------
// Helpers

export interface TicketRow {
  id: number;
  code: string;
  employee_id: number;
  unit_id: number | null;
  psychologist_id: number;
  status: TicketStatus;
  mode: Mode;
  scheduled_start: string;
  scheduled_end: string;
  room: string | null;
  meeting_url: string | null;
  nickname: string;
  topic: string;
  complaint: string;
  impact: number;
  expectation: string;
  screening: string;
  screening_score: number;
  screening_level: string;
  consent_at: string;
  reschedule_count: number;
  cancel_reason: string | null;
  cancelled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  employee_name: string;
  employee_pn: string | null;
  employee_phone: string | null;
  employee_email: string;
  employee_band: string | null;
  employee_region: string | null;
  employee_gender: string | null;
  employee_birth: string | null;
  employee_avatar: string | null;
  employee_tone: string | null;
  employee_status: string | null;
  unit_name: string | null;
  psychologist_name: string;
  psychologist_title: string | null;
  psychologist_specialization: string | null;
  psychologist_avatar: string | null;
  psychologist_tone: string | null;
  psychologist_status: string | null;
  outcome: Outcome | null;
  category: string | null;
  feedback_score: number | null;
  unread?: number;
}

const SELECT = `
  SELECT t.*, e.name AS employee_name, e.pn AS employee_pn, e.phone AS employee_phone, e.email AS employee_email,
         e.band AS employee_band, e.region AS employee_region, e.gender AS employee_gender, e.birth_date AS employee_birth,
         e.avatar_url AS employee_avatar, e.avatar_tone AS employee_tone, e.status_text AS employee_status, u.name AS unit_name,
         p.name AS psychologist_name, p.title AS psychologist_title, p.specialization AS psychologist_specialization,
         p.avatar_url AS psychologist_avatar, p.avatar_tone AS psychologist_tone, p.status_text AS psychologist_status,
         r.outcome AS outcome, r.category AS category, f.score AS feedback_score
  FROM tickets t
  JOIN users e ON e.id = t.employee_id
  JOIN users p ON p.id = t.psychologist_id
  LEFT JOIN units u ON u.id = t.unit_id
  LEFT JOIN reports r ON r.ticket_id = t.id
  LEFT JOIN feedback f ON f.ticket_id = t.id`;

export const linkFor = (role: Role, id: number) =>
  role === 'admin' ? `/admin/sesi/${id}` : role === 'psychologist' ? `/psikolog/sesi/${id}` : `/pendaftaran/${id}`;

const location = (t: Pick<TicketRow, 'mode' | 'room'>) => (t.mode === 'offline' && t.room ? `${ROOM_PREFIX} – ${t.room}` : null);

function serialize(t: TicketRow, viewer: UserRow) {
  const staff = viewer.role !== 'employee';
  const psych = viewer.role === 'psychologist';
  return {
    id: t.id,
    code: t.code,
    status: t.status,
    mode: t.mode,
    scheduledStart: t.scheduled_start,
    scheduledEnd: t.scheduled_end,
    room: staff ? t.room : undefined,
    location: location(t),
    meetingUrl: t.mode === 'online' ? t.meeting_url : null,
    nickname: t.nickname,
    topic: t.topic,
    impact: t.impact,
    // Isi cerita & jawaban skrining hanya untuk pekerja itu sendiri dan psikolognya.
    complaint: viewer.role === 'admin' ? undefined : t.complaint,
    expectation: viewer.role === 'admin' ? undefined : t.expectation,
    screening: psych ? (JSON.parse(t.screening) as number[]) : undefined,
    screeningScore: staff ? t.screening_score : undefined,
    screeningLevel: staff ? t.screening_level : undefined,
    rescheduleCount: t.reschedule_count,
    cancelReason: t.cancel_reason,
    cancelledAt: t.cancelled_at,
    startedAt: t.started_at,
    endedAt: t.ended_at,
    completedAt: t.completed_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    outcome: t.outcome,
    category: staff ? t.category : undefined,
    hasFeedback: t.feedback_score != null,
    feedbackScore: staff ? t.feedback_score : undefined,
    employee: {
      id: t.employee_id,
      name: t.employee_name,
      pn: staff ? t.employee_pn : undefined,
      phone: staff ? t.employee_phone : undefined,
      email: staff ? t.employee_email : undefined,
      band: staff ? t.employee_band : undefined,
      region: staff ? t.employee_region : undefined,
      gender: staff ? t.employee_gender : undefined,
      birthDate: staff ? t.employee_birth : undefined,
      unitName: t.unit_name,
      avatarUrl: t.employee_avatar,
      avatarTone: t.employee_tone,
      statusText: t.employee_status,
    },
    psychologist: {
      id: t.psychologist_id,
      name: t.psychologist_name,
      title: t.psychologist_title,
      specialization: t.psychologist_specialization,
      avatarUrl: t.psychologist_avatar,
      avatarTone: t.psychologist_tone,
      statusText: t.psychologist_status,
    },
    unread: t.unread ?? 0,
  };
}

export function loadTicket(id: number) {
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

const insertEvent = db.prepare('INSERT INTO ticket_events (ticket_id, actor_id, type, message, created_at) VALUES (?,?,?,?,?)');
export function logEvent(ticketId: number, actorId: number | null, type: string, message: string) {
  insertEvent.run(ticketId, actorId, type, message, now());
}

/** Kabari semua pihak (yang sedang membuka aplikasi) agar data tiket dimuat ulang. */
export function broadcastTicket(t: { id: number; employee_id: number; psychologist_id: number }, extra: number[] = []) {
  publish([t.employee_id, t.psychologist_id, ...adminIds(), ...extra], 'ticket', { id: t.id });
}

function nextCode() {
  // Tahun menurut WIB, bukan zona waktu server.
  const year = wibToday().slice(0, 4);
  const row = db.prepare(`SELECT code FROM tickets WHERE code LIKE ? ORDER BY code DESC LIMIT 1`).get(`TC-${year}-%`) as
    | { code: string }
    | undefined;
  const n = row ? Number(row.code.split('-')[2]) + 1 : 1;
  return `TC-${year}-${String(n).padStart(5, '0')}`;
}

const modeEnum = z.enum(['offline', 'chat', 'online']);
const slotSchema = z.object({
  psychologistId: z.number().int().positive({ message: 'Pilih psikolog.' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pilih tanggal.'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Pilih waktu.'),
  mode: modeEnum,
});

function psychProfile(id: number) {
  return db.prepare(`SELECT id, name, title, meeting_url FROM users WHERE id = ? AND role = 'psychologist' AND status = 'verified'`).get(id) as
    | { id: number; name: string; title: string | null; meeting_url: string | null }
    | undefined;
}
const fullName = (p: { name: string; title: string | null }) => (p.title ? `${p.name}, ${p.title}` : p.name);

function whereText(mode: Mode, room: string | null, meetingUrl: string | null) {
  if (mode === 'offline') return `Lokasi: ${ROOM_PREFIX} – ${room}.`;
  if (mode === 'online') return meetingUrl ? 'Tautan Microsoft Teams tersedia di halaman pendaftaranmu.' : 'Tautan Microsoft Teams akan dikirim sebelum sesi.';
  return 'Sesi berlangsung lewat ruang chat di aplikasi.';
}

const leadOk = (start: string) => Date.parse(start) - Date.now() >= SCHEDULE.leadHours * 3600e3;

// ---------------------------------------------------------------------------
// Daftar & detail

const GROUPS: Record<string, TicketStatus[]> = {
  upcoming: ['scheduled', 'in_progress'],
  done: ['awaiting_report', 'completed', 'no_show'],
  history: ['completed', 'no_show', 'cancelled'],
};

ticketsRouter.get('/', requireVerified, (req, res) => {
  const viewer = req.user!;
  const where: string[] = [];
  const params: unknown[] = [];
  if (viewer.role === 'employee') where.push('t.employee_id = ?'), params.push(viewer.id);
  else if (viewer.role === 'psychologist') where.push('t.psychologist_id = ?'), params.push(viewer.id);
  const q = req.query as Record<string, string | undefined>;
  const statuses = q.status ? (GROUPS[q.status] ?? [q.status]) : [];
  if (statuses.length) where.push(`t.status IN (${statuses.map(() => '?').join(',')})`), params.push(...statuses);
  if (q.mode) where.push('t.mode = ?'), params.push(q.mode);
  if (q.unit) where.push('t.unit_id = ?'), params.push(Number(q.unit));
  if (q.psychologist) where.push('t.psychologist_id = ?'), params.push(Number(q.psychologist));
  if (q.from) where.push('t.scheduled_start >= ?'), params.push(q.from);
  if (q.to) where.push('t.scheduled_start < ?'), params.push(q.to);
  if (q.q && viewer.role !== 'employee') {
    where.push('(t.code LIKE ? OR e.name LIKE ? OR e.pn LIKE ? OR t.nickname LIKE ?)');
    params.push(...Array(4).fill(`%${q.q}%`));
  }
  const order =
    viewer.role === 'employee'
      ? 't.scheduled_start DESC'
      : `CASE t.status WHEN 'in_progress' THEN 0 WHEN 'awaiting_report' THEN 1 WHEN 'scheduled' THEN 2 ELSE 3 END,
         CASE WHEN t.status IN ('scheduled','in_progress') THEN t.scheduled_start END ASC, t.scheduled_start DESC`;
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  // Dengan ?page= hasil dipotong per halaman dan total ikut dikirim; tanpa page tetap daftar biasa (maks. limit).
  const pg = pageParams(q);
  // Batas 1–1000: limit negatif di SQLite berarti tanpa batas, jadi ikut dijepit.
  const limitSql = pg ? `LIMIT ${pg.size} OFFSET ${pg.offset}` : `LIMIT ${Math.min(Math.max(1, Math.floor(Number(q.limit)) || 300), 1000)}`;
  const unread =
    viewer.role === 'admin' ? '0' : '(SELECT COUNT(*) FROM messages m WHERE m.ticket_id = t.id AND m.sender_id != ? AND m.read_at IS NULL)';
  const sql = `${SELECT.replace('FROM tickets t', `, ${unread} AS unread FROM tickets t`)}
    ${whereSql} ORDER BY ${order} ${limitSql}`;
  const rows = db.prepare(sql).all(...(viewer.role === 'admin' ? params : [viewer.id, ...params])) as TicketRow[];
  const tickets = rows.map((t) => serialize(t, viewer));
  if (!pg) return res.json({ tickets });
  const { n } = db.prepare(`SELECT COUNT(*) n FROM tickets t JOIN users e ON e.id = t.employee_id ${whereSql}`).get(...params) as { n: number };
  res.json({ tickets, total: n, page: pg.page, pageSize: pg.size });
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

  const r = db.prepare('SELECT * FROM reports WHERE ticket_id = ?').get(t.id) as Record<string, string | null> | undefined;
  let report: Record<string, unknown> | null = null;
  if (r) {
    if (viewer.role === 'psychologist') {
      report = {
        outcome: r.outcome,
        goal: r.goal,
        healthHistory: r.health_history,
        symptoms: r.symptoms,
        summary: r.summary,
        category: r.category,
        noteForClient: r.note_for_client,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    } else if (viewer.role === 'admin') {
      // Admin hanya melihat metadata untuk monitoring — isi sesi tetap rahasia.
      report = { outcome: r.outcome, category: r.category, createdAt: r.created_at };
    } else {
      report = { outcome: r.outcome, noteForClient: r.note_for_client, createdAt: r.created_at };
    }
  }
  const f = db.prepare('SELECT * FROM feedback WHERE ticket_id = ?').get(t.id) as Record<string, string | number | null> | undefined;
  const feedback = f
    ? {
        score: f.score,
        level: f.level,
        createdAt: f.created_at,
        helpful: f.helpful,
        suggestion: f.suggestion,
        answers: viewer.role === 'employee' ? JSON.parse(String(f.answers)) : undefined,
      }
    : null;

  // Riwayat sesi klien yang sama (tanpa isi laporan) untuk konteks psikolog & admin.
  // Riwayat sesi klien yang sama. Psikolog (siapa pun yang menangani klien ini) juga melihat skrining &
  // catatan hasil sesi sebelumnya supaya pendampingan berkelanjutan; admin hanya metadata.
  type HistoryRow = {
    id: number; code: string; status: string; scheduledStart: string; mode: string; psychologistName: string; outcome: string | null;
    topic: string; screening: string; screeningScore: number; screeningLevel: string;
    goal: string | null; healthHistory: string | null; symptoms: string | null; summary: string | null; category: string | null; noteForClient: string | null;
  };
  const historyRows =
    viewer.role === 'employee'
      ? []
      : (db
          .prepare(
            `SELECT t.id, t.code, t.status, t.scheduled_start AS scheduledStart, t.mode, p.name AS psychologistName, r.outcome,
                    t.topic, t.screening, t.screening_score AS screeningScore, t.screening_level AS screeningLevel,
                    r.goal, r.health_history AS healthHistory, r.symptoms, r.summary, r.category, r.note_for_client AS noteForClient
             FROM tickets t JOIN users p ON p.id = t.psychologist_id LEFT JOIN reports r ON r.ticket_id = t.id
             WHERE t.employee_id = ? AND t.id != ? ORDER BY t.scheduled_start DESC LIMIT 20`,
          )
          .all(t.employee_id, t.id) as HistoryRow[]);
  const history = historyRows.map((h) => {
    const base = { id: h.id, code: h.code, status: h.status, scheduledStart: h.scheduledStart, mode: h.mode, psychologistName: h.psychologistName, outcome: h.outcome };
    if (viewer.role !== 'psychologist') return base;
    return {
      ...base,
      topic: h.topic,
      screening: JSON.parse(h.screening) as number[],
      screeningScore: h.screeningScore,
      screeningLevel: h.screeningLevel,
      report: h.outcome
        ? { outcome: h.outcome, goal: h.goal, healthHistory: h.healthHistory, symptoms: h.symptoms, summary: h.summary, category: h.category, noteForClient: h.noteForClient }
        : undefined,
    };
  });

  res.json({
    ticket: serialize(t, viewer),
    events,
    report,
    feedback,
    history,
    chat: chatState(t),
  });
});

// ---------------------------------------------------------------------------
// Pekerja: daftar konseling

const createSchema = z
  .object({
    consent: z.literal(true, { errorMap: () => ({ message: 'Persetujuan (informed consent) diperlukan.' }) }),
    nickname: z.string().trim().min(1, 'Isi nama panggilan.').max(40, 'Nama panggilan maksimal 40 karakter.'),
    screening: z
      .array(z.number().int().min(1).max(4))
      .length(SCREENING_ITEMS.length, 'Lengkapi seluruh pernyataan skrining.'),
    topic: z.enum(Object.keys(CLIENT_TOPICS) as [string, ...string[]], { message: 'Pilih topik permasalahan.' }),
    complaint: z.string().trim().min(COMPLAINT_MIN, `Ceritakan keluhanmu minimal ${COMPLAINT_MIN} karakter.`).max(3000),
    impact: z.number().int().min(1).max(10, 'Pilih skala 1–10.'),
    expectation: z.string().trim().min(3, 'Ceritakan harapanmu dari sesi ini.').max(1500),
  })
  .merge(slotSchema);

ticketsRouter.post('/', requireRole('employee'), (req, res) => {
  const u = req.user!;
  const d = parse(createSchema, req.body);
  const el = eligibility(u.id);
  if (!el.canBook) fail(409, el.reason!);
  const psych = psychProfile(d.psychologistId);
  if (!psych) fail(400, 'Psikolog tidak ditemukan atau sedang tidak aktif.');
  const { score, level } = scoreScreening(d.screening);

  const id = tx(() => {
    assertSlotEligible(u.id, d.date);
    const slot = reserveSlot(d);
    const ts = now();
    const meetingUrl = d.mode === 'online' ? psych!.meeting_url : null;
    const info = db
      .prepare(
        `INSERT INTO tickets (code, employee_id, unit_id, psychologist_id, status, mode, scheduled_start, scheduled_end, room, meeting_url,
           nickname, topic, complaint, impact, expectation, screening, screening_score, screening_level, consent_at, created_at, updated_at)
         VALUES (?,?,?,?, 'scheduled', ?,?,?,?,?, ?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        nextCode(), u.id, u.unit_id, psych!.id, d.mode, slot.start, slot.end, slot.room, meetingUrl,
        d.nickname, d.topic, d.complaint, d.impact, d.expectation, JSON.stringify(d.screening), score, level, ts, ts, ts,
      );
    db.prepare('UPDATE users SET nickname = ?, updated_at = ? WHERE id = ?').run(d.nickname, ts, u.id);
    const id = Number(info.lastInsertRowid);
    logEvent(id, u.id, 'created', `Pendaftaran konseling dibuat — ${MODE_LABEL[d.mode]} bersama ${fullName(psych!)}, ${formatWhen(slot.start)}.`);
    return id;
  });

  const t = loadTicket(id)!;
  notify(u.id, {
    type: 'ticket.booked',
    title: 'Pendaftaran konseling berhasil',
    body: `${t.code} · ${MODE_LABEL[t.mode]} bersama ${fullName(psych!)}, ${formatWhen(t.scheduled_start)}. ${whereText(t.mode, t.room, t.meeting_url)}`,
    link: linkFor('employee', id),
  });
  notify(psych!.id, {
    type: 'ticket.assigned',
    title: `Sesi baru: ${t.code}`,
    body: `${t.nickname} (${t.unit_name ?? '-'}) · ${MODE_LABEL[t.mode]}, ${formatWhen(t.scheduled_start)}. Skrining: ${level}.`,
    link: linkFor('psychologist', id),
  });
  broadcastTicket(t);
  res.status(201).json({ ticket: serialize(t, u) });
});

ticketsRouter.post('/:id/reschedule', requireRole('employee', 'admin'), (req, res) => {
  const viewer = req.user!;
  const t = getAccessible(req);
  const d = parse(slotSchema, req.body);
  if (t.status !== 'scheduled') fail(400, 'Jadwal hanya bisa diubah sebelum sesi dimulai.');
  if (viewer.role === 'employee' && !leadOk(t.scheduled_start)) {
    fail(400, `Perubahan jadwal paling lambat H-${SCHEDULE.leadHours} jam sebelum sesi. Hubungi admin bila mendesak.`);
  }
  const psych = psychProfile(d.psychologistId);
  if (!psych) fail(400, 'Psikolog tidak ditemukan atau sedang tidak aktif.');
  const prevPsych = t.psychologist_id;
  const prevStart = t.scheduled_start;
  tx(() => {
    if (viewer.role === 'employee') assertSlotEligible(t.employee_id, d.date, t.id);
    const slot = reserveSlot(d, { excludeTicketId: t.id, ignoreLead: viewer.role === 'admin' });
    const meetingUrl = d.mode === 'online' ? (psych!.id === prevPsych && t.meeting_url ? t.meeting_url : psych!.meeting_url) : null;
    db.prepare(
      `UPDATE tickets SET psychologist_id=?, mode=?, scheduled_start=?, scheduled_end=?, room=?, meeting_url=?,
         reschedule_count = reschedule_count + 1, reminder_sent_at = NULL, updated_at=? WHERE id=?`,
    ).run(psych!.id, d.mode, slot.start, slot.end, slot.room, meetingUrl, now(), t.id);
    logEvent(t.id, viewer.id, 'rescheduled', `Jadwal diubah${viewer.role === 'admin' ? ' oleh admin' : ''} ke ${formatWhen(slot.start)} — ${MODE_LABEL[d.mode]} bersama ${fullName(psych!)}.`);
  });
  const nt = loadTicket(t.id)!;
  const when = `${MODE_LABEL[nt.mode]} bersama ${fullName(psych!)}, ${formatWhen(nt.scheduled_start)}.`;
  if (viewer.role === 'admin') {
    notify(t.employee_id, { type: 'ticket.rescheduled', title: `Jadwal ${t.code} diperbarui admin`, body: `${when} ${whereText(nt.mode, nt.room, nt.meeting_url)}`, link: linkFor('employee', t.id) });
  }
  notify(psych!.id, {
    type: 'ticket.rescheduled',
    title: prevPsych === psych!.id ? `Jadwal ${t.code} berubah` : `Sesi baru: ${t.code}`,
    body: `${nt.nickname} · ${when}`,
    link: linkFor('psychologist', t.id),
  });
  if (prevPsych !== psych!.id) {
    notify(prevPsych, { type: 'ticket.unassigned', title: `Sesi ${t.code} dipindahkan`, body: `Sesi ${formatWhen(prevStart)} dipindah ke psikolog lain.`, email: false });
  }
  broadcastTicket(nt, [prevPsych]);
  res.json({ ok: true });
});

ticketsRouter.post('/:id/cancel', requireRole('employee', 'admin'), (req, res) => {
  const viewer = req.user!;
  const t = getAccessible(req);
  const { reason } = parse(z.object({ reason: z.string().trim().min(3, 'Tuliskan alasan pembatalan.').max(500) }), req.body);
  if (t.status !== 'scheduled') fail(400, 'Sesi ini sudah tidak bisa dibatalkan.');
  if (viewer.role === 'employee' && !leadOk(t.scheduled_start)) {
    fail(400, `Pembatalan paling lambat H-${SCHEDULE.leadHours} jam sebelum sesi. Hubungi admin bila mendesak.`);
  }
  tx(() => {
    db.prepare(`UPDATE tickets SET status='cancelled', cancel_reason=?, cancelled_by=?, cancelled_at=?, updated_at=? WHERE id=?`).run(reason, viewer.id, now(), now(), t.id);
    logEvent(t.id, viewer.id, 'cancelled', `Dibatalkan oleh ${viewer.role === 'admin' ? 'admin' : 'pekerja'}: ${reason}`);
  });
  if (viewer.role === 'admin') {
    notify(t.employee_id, { type: 'ticket.cancelled', title: `Sesi ${t.code} dibatalkan`, body: `Admin membatalkan sesimu ${formatWhen(t.scheduled_start)}. Alasan: ${reason}`, link: linkFor('employee', t.id) });
  }
  notify(t.psychologist_id, { type: 'ticket.cancelled', title: `Sesi ${t.code} dibatalkan`, body: `Sesi ${formatWhen(t.scheduled_start)} dengan ${t.nickname} dibatalkan. Slot kembali tersedia.`, link: linkFor('psychologist', t.id) });
  broadcastTicket(t);
  res.json({ ok: true });
});

ticketsRouter.post('/:id/feedback', requireRole('employee'), (req, res) => {
  const t = getAccessible(req);
  const d = parse(
    z.object({
      answers: z.array(z.number().int().min(1).max(4)).length(FEEDBACK_ITEMS.length, 'Lengkapi semua pertanyaan.'),
      helpful: z.string().trim().max(500).optional().default(''),
      suggestion: z.string().trim().max(500).optional().default(''),
    }),
    req.body,
  );
  if (t.status !== 'completed') fail(400, 'Feedback bisa diisi setelah hasil sesi tersedia.');
  if (db.prepare('SELECT 1 FROM feedback WHERE ticket_id = ?').get(t.id)) fail(409, 'Kamu sudah mengisi feedback untuk sesi ini.');
  const score = d.answers.reduce((a, b) => a + b, 0);
  db.prepare('INSERT INTO feedback (ticket_id, answers, score, level, helpful, suggestion, created_at) VALUES (?,?,?,?,?,?,?)').run(
    t.id, JSON.stringify(d.answers), score, satisfactionLevel(score), d.helpful || null, d.suggestion || null, now(),
  );
  logEvent(t.id, req.user!.id, 'feedback', 'Mengisi feedback sesi.');
  broadcastTicket(t);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Psikolog: sesi & form pasca-sesi

ticketsRouter.patch('/:id/meeting', requireRole('psychologist', 'admin'), (req, res) => {
  const t = getAccessible(req);
  const { meetingUrl } = parse(
    z.object({ meetingUrl: z.string().trim().regex(/^https?:\/\/\S+$/, 'Isi tautan Microsoft Teams yang valid (https://...).').max(500) }),
    req.body,
  );
  if (t.mode !== 'online') fail(400, 'Tautan meeting hanya untuk sesi video/voice call.');
  if (!['scheduled', 'in_progress'].includes(t.status)) fail(400, 'Sesi ini sudah selesai.');
  db.prepare('UPDATE tickets SET meeting_url = ?, updated_at = ? WHERE id = ?').run(meetingUrl, now(), t.id);
  logEvent(t.id, req.user!.id, 'meeting', 'Tautan Microsoft Teams diperbarui.');
  notify(t.employee_id, { type: 'ticket.meeting', title: 'Tautan sesi sudah tersedia', body: `Tautan Microsoft Teams untuk sesi ${formatWhen(t.scheduled_start)} bisa dibuka di halaman pendaftaranmu.`, link: linkFor('employee', t.id) });
  broadcastTicket(t);
  res.json({ ok: true });
});

ticketsRouter.post('/:id/start', requireRole('psychologist'), (req, res) => {
  const p = req.user!;
  const t = getAccessible(req);
  if (t.status !== 'scheduled') fail(400, 'Sesi hanya bisa dimulai dari status Akan datang.');
  if (Date.parse(t.scheduled_start) - Date.now() > 30 * 60e3) fail(400, 'Sesi bisa dimulai paling cepat 30 menit sebelum jadwal.');
  tx(() => {
    db.prepare(`UPDATE tickets SET status='in_progress', started_at=?, updated_at=? WHERE id=?`).run(now(), now(), t.id);
    logEvent(t.id, p.id, 'started', 'Sesi dimulai.');
  });
  notify(t.employee_id, {
    type: 'session.started',
    title: 'Sesimu sudah dimulai',
    body:
      t.mode === 'chat'
        ? `${p.name} sudah di ruang chat. Yuk mulai cerita.`
        : t.mode === 'online'
          ? `${p.name} sudah memulai sesi. Buka tautan Microsoft Teams di halaman pendaftaranmu.`
          : `${p.name} sudah siap di ${location(t)}.`,
    link: linkFor('employee', t.id),
    email: false,
  });
  broadcastTicket(t);
  res.json({ ok: true });
});

ticketsRouter.post('/:id/end', requireRole('psychologist'), (req, res) => {
  const t = getAccessible(req);
  if (!['scheduled', 'in_progress'].includes(t.status)) fail(400, 'Sesi ini sudah berakhir.');
  if (Date.parse(t.scheduled_start) > Date.now()) fail(400, 'Sesi belum dimulai.');
  tx(() => {
    db.prepare(`UPDATE tickets SET status='awaiting_report', started_at=COALESCE(started_at, ?), ended_at=?, updated_at=? WHERE id=?`).run(now(), now(), now(), t.id);
    logEvent(t.id, req.user!.id, 'ended', 'Sesi selesai. Menunggu hasil dari psikolog.');
  });
  broadcastTicket(t);
  res.json({ ok: true });
});

const reportSchema = z
  .object({
    outcome: z.enum(['terminasi', 'lanjutan', 'referral', 'no_show'], { message: 'Pilih rencana tindak lanjut.' }),
    goal: z.string().trim().max(2000).optional().default(''),
    healthHistory: z.string().trim().max(2000).optional().default(''),
    symptoms: z.string().trim().max(2000).optional().default(''),
    summary: z.string().trim().max(5000).optional().default(''),
    category: z.string().optional().default(''),
    noteForClient: z.string().trim().max(1500).optional().default(''),
  })
  .superRefine((d, ctx) => {
    if (d.outcome === 'no_show') return;
    if (d.goal.length < 3) ctx.addIssue({ code: 'custom', path: ['goal'], message: 'Isi tujuan konseling.' });
    if (d.summary.length < 10) ctx.addIssue({ code: 'custom', path: ['summary'], message: 'Ringkasan sesi minimal 10 karakter.' });
    if (!(d.category in CASE_CATEGORIES)) ctx.addIssue({ code: 'custom', path: ['category'], message: 'Pilih kategorisasi permasalahan.' });
  });

ticketsRouter.post('/:id/report', requireRole('psychologist'), (req, res) => {
  const p = req.user!;
  const t = getAccessible(req);
  const d = parse(reportSchema, req.body);
  if (t.status === 'cancelled') fail(400, 'Sesi ini dibatalkan.');
  if (Date.parse(t.scheduled_start) > Date.now()) fail(400, 'Hasil sesi bisa diisi setelah jadwal sesi dimulai.');
  const first = !db.prepare('SELECT 1 FROM reports WHERE ticket_id = ?').get(t.id);
  const noShow = d.outcome === 'no_show';
  tx(() => {
    const ts = now();
    db.prepare(
      `INSERT INTO reports (ticket_id, psychologist_id, outcome, goal, health_history, symptoms, summary, category, note_for_client, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(ticket_id) DO UPDATE SET outcome=excluded.outcome, goal=excluded.goal, health_history=excluded.health_history,
         symptoms=excluded.symptoms, summary=excluded.summary, category=excluded.category, note_for_client=excluded.note_for_client, updated_at=excluded.updated_at`,
    ).run(
      t.id, p.id, d.outcome,
      noShow ? null : d.goal, noShow ? null : d.healthHistory || null, noShow ? null : d.symptoms || null,
      noShow ? null : d.summary, noShow ? null : d.category, d.noteForClient || null, ts, ts,
    );
    db.prepare(
      `UPDATE tickets SET status=?, started_at=CASE WHEN ? THEN started_at ELSE COALESCE(started_at, scheduled_start) END,
         ended_at=COALESCE(ended_at, ?), completed_at=COALESCE(completed_at, ?), updated_at=? WHERE id=?`,
    ).run(noShow ? 'no_show' : 'completed', noShow ? 1 : 0, ts, ts, ts, t.id);
    logEvent(t.id, p.id, first ? 'reported' : 'report_updated', `${first ? 'Hasil sesi diisi' : 'Hasil sesi diperbarui'}: ${OUTCOME_LABEL[d.outcome]}.`);
  });
  if (first) {
    notify(t.employee_id, noShow
      ? { type: 'session.no_show', title: 'Kamu tercatat tidak hadir', body: `Sesi ${formatWhen(t.scheduled_start)} dinyatakan hangus. Kamu bisa membuat janji baru setelah jeda 2 minggu.`, link: linkFor('employee', t.id) }
      : { type: 'session.result', title: 'Hasil & tindak lanjut sesimu sudah tersedia', body: `${p.name} sudah mengisi hasil sesi. Yuk lihat, lalu bantu kami dengan mengisi feedback singkat.`, link: linkFor('employee', t.id) });
  }
  broadcastTicket(t);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Chat

const hasMessages = db.prepare('SELECT 1 FROM messages WHERE ticket_id = ? LIMIT 1');

const attachmentCount = db.prepare('SELECT COUNT(*) n FROM messages WHERE ticket_id = ? AND file_path IS NOT NULL');

/** Status ruang chat + kuota lampiran per sesi chat. */
function chatState(t: TicketRow) {
  const st: { canRead: boolean; canSend: boolean; reason: string | null; closesAt?: string; attachments?: { used: number; max: number; maxMB: number } } =
    chatAvailability(t);
  if (st.canRead) {
    const { n } = attachmentCount.get(t.id) as { n: number };
    st.attachments = { used: n, max: SERVICE_CONFIG.attachmentsPerTicket, maxMB: SERVICE_CONFIG.attachmentMaxMB };
  }
  return st;
}

function chatAvailability(t: TicketRow): { canRead: boolean; canSend: boolean; reason: string | null; closesAt?: string } {
  // Ruang chat hanya untuk sesi bermedia chat. Riwayat lama (mis. sebelum media diganti) tetap bisa dibaca.
  if (t.mode !== 'chat') {
    return { canRead: !!hasMessages.get(t.id), canSend: false, reason: 'Chat hanya tersedia untuk sesi dengan media Chat.' };
  }
  if (t.status === 'cancelled') return { canRead: true, canSend: false, reason: 'Sesi dibatalkan. Chat hanya bisa dibaca.' };
  if (t.status === 'completed' || t.status === 'no_show') {
    const closesAt = new Date(Date.parse(t.completed_at ?? t.updated_at) + CHAT_GRACE_DAYS * 864e5);
    if (Date.now() > closesAt.getTime()) return { canRead: true, canSend: false, reason: 'Ruang chat sudah ditutup. Buat janji baru bila perlu.' };
    return { canRead: true, canSend: true, reason: null, closesAt: closesAt.toISOString() };
  }
  return { canRead: true, canSend: true, reason: null };
}

function chatAccess(req: Request) {
  if (req.user!.role === 'admin') fail(403, 'Isi chat bersifat rahasia antara pekerja dan psikolog.');
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
  // Dimuat bertahap: `limit` pesan terbaru (default 100, maks. 200); ?before=<id> untuk pesan yang lebih lama.
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const before = Number(req.query.before) || 0;
  const rows = db
    .prepare(`SELECT ${MESSAGE_COLS} FROM messages WHERE ticket_id = ? ${before ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT ?`)
    .all(...(before ? [t.id, before, limit + 1] : [t.id, limit + 1])) as MessageRow[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse(); // urut lama → baru
  res.json({ messages: page.map((m) => serializeMessage(t.id, m)), hasMore, state });
});

const chatNoticeExists = db.prepare(`SELECT 1 FROM notifications WHERE user_id = ? AND type = 'chat.message' AND link = ? AND read_at IS NULL`);

function deliverMessage(u: UserRow, t: TicketRow, body: string, file?: { path: string; name: string; type: string; size: number }) {
  const info = db
    .prepare('INSERT INTO messages (ticket_id, sender_id, body, file_path, file_name, file_type, file_size, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(t.id, u.id, body, file?.path ?? null, file?.name ?? null, file?.type ?? null, file?.size ?? null, now());
  const row = db.prepare(`SELECT ${MESSAGE_COLS} FROM messages WHERE id = ?`).get(info.lastInsertRowid) as MessageRow;
  const message = serializeMessage(t.id, row);
  const other = u.id === t.employee_id ? t.psychologist_id : t.employee_id;
  publish([u.id, other], 'message', message);
  const otherRole: Role = other === t.employee_id ? 'employee' : 'psychologist';
  const link = linkFor(otherRole, t.id);
  if (!chatNoticeExists.get(other, link)) {
    const preview = message.attachment ? `📎 ${ATTACHMENT_KIND_LABEL[message.attachment.kind]}: ${message.attachment.name}` : body;
    const sender = u.id === t.employee_id ? t.nickname : u.name;
    notify(other, { type: 'chat.message', title: `Pesan baru dari ${sender}`, body: preview.length > 90 ? preview.slice(0, 90) + '…' : preview, link, email: false });
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
  if (state.attachments && state.attachments.used >= state.attachments.max) {
    fail(400, `Maksimal ${state.attachments.max} file per sesi chat. Batas ini sudah tercapai.`, 'ATTACHMENT_LIMIT');
  }
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
    publish(other, 'read', { ticketId: t.id });
  }
  res.json({ ok: true });
});

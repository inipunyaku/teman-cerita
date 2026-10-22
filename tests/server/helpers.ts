import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { vi } from 'vitest';
import { createApp } from '../../server/app.js';
import { config } from '../../server/config.js';
import { db, now } from '../../server/db.js';
import { wibIso } from '../../server/scheduling.js';
import { SCREENING_ITEMS, type Mode, type Role, type TicketStatus } from '../../shared/constants.js';

export const app = createApp();

export const PASSWORD = 'rahasia123';
const HASH = bcrypt.hashSync(PASSWORD, 4);

let seq = 0;
const next = () => ++seq;

/**
 * Jam dibekukan (hanya Date) supaya aturan H-4 jam dan tanggal tidak bergantung pada kapan tes dijalankan.
 * Senin 2 November 2026 07.00 WIB.
 */
export const MONDAY = '2026-11-02';
export const NOW = wibIso(MONDAY, '07:00');
export function freezeTime(iso = NOW) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}
export const setNow = (iso: string) => vi.setSystemTime(new Date(iso));

export function makeUnit(name = `Unit ${next()}`) {
  return Number(db.prepare('INSERT INTO units (name, code, active, created_at) VALUES (?,?,1,?)').run(name, null, now()).lastInsertRowid);
}

export function makeUser(role: Role, over: Record<string, unknown> = {}) {
  const n = next();
  const u = {
    role,
    name: `${role} ${n}`,
    email: `${role}${n}@test.id`,
    pn: role === 'employee' ? String(100000 + n) : null,
    unit_id: null,
    band: null,
    region: null,
    gender: null,
    birth_date: null,
    status: 'verified',
    meeting_url: null,
    ...over,
  };
  return Number(
    db
      .prepare(
        `INSERT INTO users (role, name, email, pn, unit_id, band, region, gender, birth_date, meeting_url, password_hash, status, created_at, updated_at)
         VALUES (@role, @name, @email, @pn, @unit_id, @band, @region, @gender, @birth_date, @meeting_url, @hash, @status, @ts, @ts)`,
      )
      .run({ ...u, hash: HASH, ts: now() }).lastInsertRowid,
  );
}

export const cookieFor = (userId: number) => `tc_session=${jwt.sign({ uid: userId }, config.jwtSecret)}`;

/** Klien supertest yang sudah login sebagai `userId` (tanpa lewat /login yang dibatasi rate limit). */
export function as(userId: number | null) {
  const c = userId ? cookieFor(userId) : '';
  const wrap = (r: request.Test) => (c ? r.set('Cookie', c) : r);
  return {
    get: (url: string) => wrap(request(app).get(url)),
    post: (url: string) => wrap(request(app).post(url)),
    put: (url: string) => wrap(request(app).put(url)),
    patch: (url: string) => wrap(request(app).patch(url)),
    delete: (url: string) => wrap(request(app).delete(url)),
  };
}

export function addBlock(psychologistId: number, date: string, start = '08:00', end = '16:30', modes: Mode[] = ['offline', 'chat', 'online']) {
  return Number(
    db
      .prepare('INSERT INTO availability (psychologist_id, date, start_time, end_time, modes, created_at) VALUES (?,?,?,?,?,?)')
      .run(psychologistId, date, start, end, JSON.stringify(modes), now()).lastInsertRowid,
  );
}

export const SCREENING = SCREENING_ITEMS.map(() => 2);

export const bookingBody = (over: Record<string, unknown>) => ({
  consent: true,
  nickname: 'Bunga',
  screening: SCREENING,
  topic: 'work_stress',
  complaint: 'Akhir-akhir ini pekerjaan terasa sangat berat dan saya sulit tidur. '.repeat(3),
  impact: 6,
  expectation: 'Ingin lebih tenang menghadapi pekerjaan.',
  mode: 'offline',
  ...over,
});

let codeSeq = 0;
/** Tiket langsung ke database (tanpa aturan booking) untuk menyiapkan data daftar/statistik. */
export function insertTicket(t: {
  employeeId: number;
  psychologistId: number;
  start: string;
  status?: TicketStatus;
  mode?: Mode;
  unitId?: number | null;
  nickname?: string;
  screening?: number[];
  completedAt?: string | null;
}) {
  const end = new Date(Date.parse(t.start) + 3600e3).toISOString();
  const ts = now();
  return Number(
    db
      .prepare(
        `INSERT INTO tickets (code, employee_id, unit_id, psychologist_id, status, mode, scheduled_start, scheduled_end, room, nickname, topic,
           complaint, impact, expectation, screening, screening_score, screening_level, consent_at, completed_at, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        `TX-${String(++codeSeq).padStart(5, '0')}`, t.employeeId, t.unitId ?? null, t.psychologistId, t.status ?? 'scheduled', t.mode ?? 'offline',
        t.start, end, 'Ruang 1', t.nickname ?? 'Klien', 'work_stress', 'Cerita rahasia klien', 5, 'Harapan klien',
        JSON.stringify(t.screening ?? SCREENING), 32, 'rendah', ts, t.completedAt ?? null, ts, ts,
      ).lastInsertRowid,
  );
}

export function insertReport(ticketId: number, psychologistId: number, over: Record<string, unknown> = {}) {
  const r = { outcome: 'lanjutan', goal: 'Tujuan', health_history: 'Riwayat', symptoms: 'Gejala', summary: 'Ringkasan klinis', category: 'beban_kerja', note: 'Catatan', ...over };
  db.prepare(
    `INSERT INTO reports (ticket_id, psychologist_id, outcome, goal, health_history, symptoms, summary, category, note_for_client, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(ticketId, psychologistId, r.outcome, r.goal, r.health_history, r.symptoms, r.summary, r.category, r.note, now(), now());
}

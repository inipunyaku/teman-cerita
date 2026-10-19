import { Router } from 'express';
import { z } from 'zod';
import { db, now, tx } from '../db.js';
import { requireRole } from '../auth.js';
import { publish } from '../events.js';
import { adminIds } from '../notify.js';
import { addDays, blocksBetween, wibIso, wibParts, wibToday } from '../scheduling.js';
import { fail, intParam, parse } from '../util.js';
import { MODES, SCHEDULE, toMin, weekday } from '../../shared/constants.js';

export const availabilityRouter = Router();
availabilityRouter.use(requireRole('psychologist', 'admin'));

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid.');
const hm = z.string().regex(/^\d{2}:\d{2}$/, 'Jam tidak valid.');

availabilityRouter.get('/', (req, res) => {
  const u = req.user!;
  const q = req.query as Record<string, string | undefined>;
  const from = ymd.parse(q.from ?? wibToday());
  const to = ymd.parse(q.to ?? addDays(from, 6));
  const pid = u.role === 'psychologist' ? u.id : Number(q.psychologistId) || undefined;
  const blocks = blocksBetween(from, to, pid).map((b) => ({
    id: b.id,
    psychologistId: b.psychologist_id,
    date: b.date,
    start: b.start_time,
    end: b.end_time,
    modes: b.modes,
  }));
  const sessions = (
    db
      .prepare(
        `SELECT t.id, t.code, t.psychologist_id, t.scheduled_start, t.scheduled_end, t.mode, t.status, t.nickname
         FROM tickets t WHERE t.status != 'cancelled' AND t.scheduled_start >= ? AND t.scheduled_start < ?
         ${pid ? 'AND t.psychologist_id = ?' : ''} ORDER BY t.scheduled_start`,
      )
      .all(...[wibIso(from, '00:00'), wibIso(addDays(to, 1), '00:00'), ...(pid ? [pid] : [])]) as {
      id: number;
      code: string;
      psychologist_id: number;
      scheduled_start: string;
      scheduled_end: string;
      mode: string;
      status: string;
      nickname: string;
    }[]
  ).map((s) => ({
    id: s.id,
    code: s.code,
    psychologistId: s.psychologist_id,
    date: wibParts(s.scheduled_start).date,
    start: wibParts(s.scheduled_start).time,
    end: wibParts(s.scheduled_end).time,
    mode: s.mode,
    status: s.status,
    // Admin cukup melihat kode tiket; nama panggilan untuk psikolog yang menangani.
    nickname: u.role === 'psychologist' ? s.nickname : undefined,
  }));
  res.json({ blocks, sessions });
});

const createSchema = z
  .object({
    psychologistId: z.number().int().positive().optional(),
    dates: z.array(ymd).min(1, 'Pilih minimal satu tanggal.').max(120),
    start: hm,
    end: hm,
    modes: z.array(z.enum(['offline', 'chat', 'online'])).min(1, 'Pilih minimal satu media konseling.'),
  })
  .superRefine((d, ctx) => {
    if (toMin(d.start) < toMin(SCHEDULE.open) || toMin(d.end) > toMin(SCHEDULE.close)) {
      ctx.addIssue({ code: 'custom', path: ['start'], message: `Ketersediaan harus dalam jam operasional ${SCHEDULE.open}–${SCHEDULE.close}.` });
    }
    if (toMin(d.end) - toMin(d.start) < SCHEDULE.durationMin) {
      ctx.addIssue({ code: 'custom', path: ['end'], message: 'Rentang waktu minimal 60 menit (satu sesi).' });
    }
  });

availabilityRouter.post('/', (req, res) => {
  const u = req.user!;
  const d = parse(createSchema, req.body);
  const pid = u.role === 'psychologist' ? u.id : d.psychologistId;
  if (!pid) fail(400, 'Pilih psikolog.');
  const psych = db.prepare(`SELECT id FROM users WHERE id = ? AND role = 'psychologist'`).get(pid);
  if (!psych) fail(404, 'Psikolog tidak ditemukan.');
  const today = wibToday();
  const dates = [...new Set(d.dates)].filter((x) => SCHEDULE.workDays.includes(weekday(x)));
  if (!dates.length) fail(400, 'Pilih tanggal di hari kerja (Senin–Jumat).');
  if (dates.some((x) => x < today)) fail(400, 'Tanggal yang sudah lewat tidak bisa diubah.');

  const s = toMin(d.start);
  const e = toMin(d.end);
  const clash = dates.filter((date) =>
    blocksBetween(date, date, pid).some((b) => toMin(b.start_time) < e && s < toMin(b.end_time)),
  );
  if (clash.length) fail(409, `Bertabrakan dengan ketersediaan yang sudah ada pada ${clash.join(', ')}. Hapus blok lama dulu bila ingin mengganti.`);

  const modes = JSON.stringify(MODES.filter((m) => d.modes.includes(m)));
  tx(() => {
    const ins = db.prepare('INSERT INTO availability (psychologist_id, date, start_time, end_time, modes, created_by, created_at) VALUES (?,?,?,?,?,?,?)');
    for (const date of dates) ins.run(pid, date, d.start, d.end, modes, u.id, now());
  });
  publish([pid!, ...adminIds()], 'availability', {});
  res.status(201).json({ ok: true, created: dates.length });
});

availabilityRouter.delete('/:id', (req, res) => {
  const u = req.user!;
  const b = db.prepare('SELECT * FROM availability WHERE id = ?').get(intParam(req.params.id)) as
    | { id: number; psychologist_id: number; date: string; start_time: string; end_time: string }
    | undefined;
  if (!b || (u.role === 'psychologist' && b.psychologist_id !== u.id)) return fail(404, 'Ketersediaan tidak ditemukan.');
  if (b.date < wibToday()) fail(400, 'Ketersediaan yang sudah lewat tidak bisa dihapus (dipakai untuk laporan utilisasi).');
  const booked = db
    .prepare(
      `SELECT code FROM tickets WHERE psychologist_id = ? AND status IN ('scheduled','in_progress')
       AND scheduled_start < ? AND scheduled_end > ?`,
    )
    .all(b.psychologist_id, wibIso(b.date, b.end_time), wibIso(b.date, b.start_time)) as { code: string }[];
  if (booked.length) fail(409, `Masih ada sesi terjadwal di rentang ini (${booked.map((x) => x.code).join(', ')}). Pindahkan atau batalkan sesinya dulu.`);
  db.prepare('DELETE FROM availability WHERE id = ?').run(b.id);
  publish([b.psychologist_id, ...adminIds()], 'availability', {});
  res.json({ ok: true });
});

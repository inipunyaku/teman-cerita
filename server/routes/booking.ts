import { Router, type Request } from 'express';
import { db } from '../db.js';
import { requireRole } from '../auth.js';
import { availableDays, eligibility, slotsOn } from '../scheduling.js';
import { fail } from '../util.js';

export const bookingRouter = Router();
bookingRouter.use(requireRole('employee', 'admin'));

export const PSYCH_PUBLIC_COLS = `u.id, u.name, u.title, u.bio, u.specialization, u.approach, u.languages,
  u.avatar_url AS avatarUrl, u.avatar_tone AS avatarTone, u.status_text AS statusText`;

/**
 * Konteks booking: pekerja memesan untuk dirinya; admin hanya untuk memindahkan jadwal tiket yang ada.
 * `ticket` dikecualikan dari hitungan slot & eligibility (dipakai saat ubah jadwal).
 */
function context(req: Request) {
  const u = req.user!;
  const ticketId = Number(req.query.ticket) || 0;
  let employeeId = u.id;
  if (ticketId) {
    const t = db.prepare('SELECT employee_id FROM tickets WHERE id = ?').get(ticketId) as { employee_id: number } | undefined;
    if (!t || (u.role === 'employee' && t.employee_id !== u.id)) fail(404, 'Tiket tidak ditemukan.');
    employeeId = t!.employee_id;
  } else if (u.role === 'admin') {
    fail(400, 'Admin memilih jadwal dari halaman tiket.');
  }
  const minDate = eligibility(employeeId, ticketId).earliestDate;
  return { excludeTicketId: ticketId, minDate, ignoreLead: u.role === 'admin' };
}

bookingRouter.get('/eligibility', requireRole('employee'), (req, res) => {
  res.json(eligibility(req.user!.id));
});

bookingRouter.get('/psychologists', (_req, res) => {
  const psychologists = db
    .prepare(`SELECT ${PSYCH_PUBLIC_COLS} FROM users u WHERE u.role = 'psychologist' AND u.status = 'verified' ORDER BY u.name`)
    .all();
  res.json({ psychologists });
});

bookingRouter.get('/month', (req, res) => {
  const month = String(req.query.month ?? '');
  if (!/^\d{4}-\d{2}$/.test(month)) fail(400, 'Bulan tidak valid.');
  const ctx = context(req);
  res.json({ days: availableDays(month, ctx), minDate: ctx.minDate });
});

bookingRouter.get('/day', (req, res) => {
  const date = String(req.query.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(400, 'Tanggal tidak valid.');
  const ctx = context(req);
  if (ctx.minDate && date < ctx.minDate) return res.json({ psychologists: [] });
  const slots = slotsOn(date, ctx);
  res.json({ psychologists: [...slots].map(([psychologistId, s]) => ({ psychologistId, slots: s })) });
});

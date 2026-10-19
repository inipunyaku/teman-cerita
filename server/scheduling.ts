/**
 * Mesin penjadwalan: menghitung slot yang bisa dipesan dari ketersediaan psikolog dan aturan layanan
 * (jam operasional, istirahat, H-4 jam, tanpa back-to-back, maks. 4 sesi/psikolog/hari, maks. 4 ruangan).
 * Semua tanggal & jam dalam WIB.
 */
import { db } from './db.js';
import { fail } from './util.js';
import {
  candidateStarts,
  ELIGIBILITY,
  MODES,
  OCCUPYING_STATUSES,
  ROOMS,
  SCHEDULE,
  toHM,
  toMin,
  type Mode,
} from '../shared/constants.js';

export const wibIso = (date: string, hm: string) => new Date(`${date}T${hm}:00+07:00`).toISOString();
export function wibParts(iso: string) {
  const d = new Date(Date.parse(iso) + 7 * 3600e3).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
}
export const wibToday = () => wibParts(new Date().toISOString()).date;
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

const OCC = OCCUPYING_STATUSES.map((s) => `'${s}'`).join(',');

export interface Block {
  id: number;
  psychologist_id: number;
  date: string;
  start_time: string;
  end_time: string;
  modes: Mode[];
}

interface Booked {
  id: number;
  psychologist_id: number;
  start: number;
  end: number;
  room: string | null;
}

export function blocksBetween(from: string, to: string, psychologistId?: number): Block[] {
  const rows = db
    .prepare(
      `SELECT a.id, a.psychologist_id, a.date, a.start_time, a.end_time, a.modes FROM availability a
       JOIN users u ON u.id = a.psychologist_id AND u.status = 'verified'
       WHERE a.date >= ? AND a.date <= ? ${psychologistId ? 'AND a.psychologist_id = ?' : ''}
       ORDER BY a.date, a.start_time`,
    )
    .all(...[from, to, ...(psychologistId ? [psychologistId] : [])]) as (Omit<Block, 'modes'> & { modes: string })[];
  return rows.map((r) => ({ ...r, modes: JSON.parse(r.modes) as Mode[] }));
}

function bookedOn(date: string, excludeTicketId = 0): Booked[] {
  const rows = db
    .prepare(
      `SELECT id, psychologist_id, scheduled_start, scheduled_end, room FROM tickets
       WHERE status IN (${OCC}) AND id != ? AND scheduled_start >= ? AND scheduled_start < ?`,
    )
    .all(excludeTicketId, wibIso(date, '00:00'), wibIso(addDays(date, 1), '00:00')) as {
    id: number;
    psychologist_id: number;
    scheduled_start: string;
    scheduled_end: string;
    room: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    psychologist_id: r.psychologist_id,
    room: r.room,
    start: toMin(wibParts(r.scheduled_start).time),
    end: toMin(wibParts(r.scheduled_end).time),
  }));
}

export interface DaySlot {
  time: string;
  modes: Mode[];
}

interface SlotOptions {
  excludeTicketId?: number;
  psychologistId?: number;
  /** Admin boleh memindahkan jadwal walau kurang dari H-4 jam. */
  ignoreLead?: boolean;
}

/** Slot yang masih bisa dipesan pada satu tanggal, per psikolog. */
export function slotsOn(date: string, opts: SlotOptions = {}): Map<number, DaySlot[]> {
  const result = new Map<number, DaySlot[]>();
  const starts = candidateStarts(date);
  if (!starts.length) return result;
  const blocks = blocksBetween(date, date, opts.psychologistId);
  if (!blocks.length) return result;
  const booked = bookedOn(date, opts.excludeTicketId);
  const earliest = Date.now() + (opts.ignoreLead ? 0 : SCHEDULE.leadHours * 3600e3);

  const byPsych = new Map<number, Block[]>();
  for (const b of blocks) byPsych.set(b.psychologist_id, [...(byPsych.get(b.psychologist_id) ?? []), b]);

  for (const [pid, own] of byPsych) {
    const mine = booked.filter((b) => b.psychologist_id === pid);
    if (mine.length >= SCHEDULE.maxPerPsychPerDay) continue;
    const slots: DaySlot[] = [];
    for (const s of starts) {
      const e = s + SCHEDULE.durationMin;
      const containing = own.filter((b) => toMin(b.start_time) <= s && e <= toMin(b.end_time));
      if (!containing.length) continue;
      if (Date.parse(wibIso(date, toHM(s))) < earliest) continue;
      // Tidak tumpang tindih & tidak back-to-back untuk psikolog yang sama.
      if (mine.some((b) => s < b.end + SCHEDULE.gapMin && b.start < e + SCHEDULE.gapMin)) continue;
      // Maksimal sesi bersamaan = jumlah ruangan.
      if (booked.filter((b) => b.start < e && s < b.end).length >= ROOMS.length) continue;
      slots.push({ time: toHM(s), modes: MODES.filter((m) => containing.some((b) => b.modes.includes(m))) });
    }
    if (slots.length) result.set(pid, slots);
  }
  return result;
}

/** Tanggal dalam satu bulan ("YYYY-MM") yang punya minimal satu slot. */
export function availableDays(month: string, opts: SlotOptions & { minDate?: string | null } = {}) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = wibToday();
  const out: string[] = [];
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    if (date < today || (opts.minDate && date < opts.minDate)) continue;
    if (slotsOn(date, opts).size) out.push(date);
  }
  return out;
}

/** Ruangan pertama (sesuai prioritas) yang kosong pada rentang waktu tersebut. */
function pickRoom(date: string, start: number, end: number, excludeTicketId?: number) {
  const overlapping = bookedOn(date, excludeTicketId).filter((b) => b.start < end && start < b.end);
  return ROOMS.find((r) => !overlapping.some((b) => b.room === r)) ?? null;
}

/** Validasi slot pilihan lalu kembalikan waktu & ruangannya. Panggil di dalam transaksi. */
export function reserveSlot(input: { psychologistId: number; date: string; time: string; mode: Mode }, opts: SlotOptions = {}) {
  const slot = slotsOn(input.date, { ...opts, psychologistId: input.psychologistId })
    .get(input.psychologistId)
    ?.find((s) => s.time === input.time);
  if (!slot) return fail(409, 'Slot ini sudah tidak tersedia. Silakan pilih jadwal lain.', 'SLOT_TAKEN');
  if (!slot.modes.includes(input.mode)) fail(400, 'Media konseling ini tidak tersedia pada slot tersebut.');
  const start = toMin(input.time);
  const end = start + SCHEDULE.durationMin;
  const room = pickRoom(input.date, start, end, opts.excludeTicketId);
  if (!room) fail(409, 'Semua ruangan sudah terpakai di jam ini. Silakan pilih jadwal lain.', 'SLOT_TAKEN');
  return { start: wibIso(input.date, input.time), end: wibIso(input.date, toHM(end)), room: room! };
}

/** Jumlah sesi yang muat dalam blok ketersediaan satu psikolog pada satu hari (untuk utilisasi). */
export function dayCapacity(date: string, blocks: Pick<Block, 'start_time' | 'end_time'>[]) {
  let n = 0;
  let lastEnd = -Infinity;
  for (const s of candidateStarts(date)) {
    const e = s + SCHEDULE.durationMin;
    if (s < lastEnd + SCHEDULE.gapMin) continue;
    if (!blocks.some((b) => toMin(b.start_time) <= s && e <= toMin(b.end_time))) continue;
    n++;
    lastEnd = e;
    if (n >= SCHEDULE.maxPerPsychPerDay) break;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Eligibility: maks. 7x setahun, jeda minimal 2 minggu, satu booking aktif.

function sessionDates(employeeId: number, excludeTicketId = 0) {
  return (
    db
      .prepare(`SELECT scheduled_start FROM tickets WHERE employee_id = ? AND id != ? AND status IN (${OCC}) ORDER BY scheduled_start DESC`)
      .all(employeeId, excludeTicketId) as { scheduled_start: string }[]
  ).map((r) => wibParts(r.scheduled_start).date);
}

export function eligibility(employeeId: number, excludeTicketId = 0) {
  const active = db
    .prepare(`SELECT id, code FROM tickets WHERE employee_id = ? AND id != ? AND status IN ('scheduled','in_progress') ORDER BY scheduled_start LIMIT 1`)
    .get(employeeId, excludeTicketId) as { id: number; code: string } | undefined;
  const dates = sessionDates(employeeId, excludeTicketId);
  const today = wibToday();
  const year = today.slice(0, 4);
  const yearCount = dates.filter((d) => d.startsWith(year)).length;
  const earliest = dates[0] ? addDays(dates[0], ELIGIBILITY.minGapDays) : null;
  let reason: string | null = null;
  if (active) reason = `Kamu masih punya jadwal konseling aktif (${active.code}).`;
  else if (yearCount >= ELIGIBILITY.maxPerYear) reason = `Kuota konseling tahun ${year} sudah terpakai (${ELIGIBILITY.maxPerYear}x dalam setahun).`;
  return {
    canBook: !reason,
    reason,
    activeTicket: active ?? null,
    yearCount,
    maxPerYear: ELIGIBILITY.maxPerYear,
    earliestDate: earliest && earliest > today ? earliest : null,
  };
}

export function assertSlotEligible(employeeId: number, date: string, excludeTicketId = 0) {
  const dates = sessionDates(employeeId, excludeTicketId);
  if (dates.filter((d) => d.startsWith(date.slice(0, 4))).length >= ELIGIBILITY.maxPerYear) {
    fail(400, `Kuota konseling tahun ${date.slice(0, 4)} sudah terpakai (${ELIGIBILITY.maxPerYear}x dalam setahun).`);
  }
  const near = dates.find((d) => Math.abs(daysBetween(d, date)) < ELIGIBILITY.minGapDays);
  if (near) fail(400, `Jadwal harus berjarak minimal 2 minggu dari sesi lain (sesi ${near}).`, 'GAP');
}

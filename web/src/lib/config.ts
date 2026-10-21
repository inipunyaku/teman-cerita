import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { CHAT_GRACE_DAYS, COMPLAINT_MIN, ELIGIBILITY, ROOMS, ROOM_PREFIX, SCHEDULE, SCREENING_CUTOFF, toHM, toMin, weekday } from '@shared/constants';

/**
 * Pengaturan layanan yang bisa diubah super admin (menu Pengaturan layanan), dibaca dari GET /api/meta/config.
 * Nilai bawaan di bawah dipakai selama data belum termuat, jadi tampilan tidak pernah menunggu.
 */
export interface ServiceConfig {
  schedule: {
    open: string;
    close: string;
    stepMin: number;
    durationMin: number;
    gapMin: number;
    leadHours: number;
    maxPerPsychPerDay: number;
    /** 0 = Minggu … 6 = Sabtu */
    workDays: number[];
    /** Kunci hari ("1" = Senin). Hari tanpa kunci = tanpa istirahat. */
    breaks: Record<string, { start: string; end: string }>;
  };
  roomPrefix: string;
  rooms: string[];
  maxPerYear: number;
  minGapDays: number;
  chatGraceDays: number;
  attachmentMaxMB: number;
  attachmentsPerTicket: number;
  avatarMaxKB: number;
  complaintMin: number;
  lateToleranceMin: number;
  screeningCutoffLow: number;
  screeningCutoffMid: number;
  satisfactionLow: number;
  satisfactionMid: number;
}

export const DEFAULT_CONFIG: ServiceConfig = {
  schedule: {
    open: SCHEDULE.open,
    close: SCHEDULE.close,
    stepMin: SCHEDULE.stepMin,
    durationMin: SCHEDULE.durationMin,
    gapMin: SCHEDULE.gapMin,
    leadHours: SCHEDULE.leadHours,
    maxPerPsychPerDay: SCHEDULE.maxPerPsychPerDay,
    workDays: [...SCHEDULE.workDays],
    breaks: Object.fromEntries(Object.entries(SCHEDULE.breaks).map(([d, [start, end]]) => [d, { start, end }])),
  },
  roomPrefix: ROOM_PREFIX,
  rooms: [...ROOMS],
  maxPerYear: ELIGIBILITY.maxPerYear,
  minGapDays: ELIGIBILITY.minGapDays,
  chatGraceDays: CHAT_GRACE_DAYS,
  attachmentMaxMB: 2,
  attachmentsPerTicket: 5,
  avatarMaxKB: 150,
  complaintMin: COMPLAINT_MIN,
  lateToleranceMin: SCHEDULE.lateToleranceMin,
  screeningCutoffLow: SCREENING_CUTOFF.rendah,
  screeningCutoffMid: SCREENING_CUTOFF.sedang,
  satisfactionLow: 20,
  satisfactionMid: 26,
};

export function useConfig(): ServiceConfig {
  const { data } = useQuery({
    queryKey: ['config'],
    queryFn: () => api.get<ServiceConfig>('/meta/config'),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
  return data ?? DEFAULT_CONFIG;
}

/** "2 minggu" bila kelipatan 7, selain itu "10 hari". */
export const gapText = (days: number) => (days > 0 && days % 7 === 0 ? `${days / 7} minggu` : `${days} hari`);

/** Pilihan jam blok ketersediaan dari jam buka sampai tutup. */
export function timeOptions(cfg: ServiceConfig) {
  const out: string[] = [];
  const step = Math.max(5, cfg.schedule.stepMin);
  for (let m = toMin(cfg.schedule.open); m <= toMin(cfg.schedule.close); m += step) out.push(toHM(m));
  return out;
}

/** Jam mulai yang mungkin pada suatu tanggal: hari layanan, dalam jam operasional, tidak menabrak istirahat. */
export function candidateStarts(cfg: ServiceConfig, date: string): number[] {
  const day = weekday(date);
  const sc = cfg.schedule;
  if (!sc.workDays.includes(day)) return [];
  const br = sc.breaks[String(day)];
  const [bs, be] = br ? [toMin(br.start), toMin(br.end)] : [0, 0];
  const out: number[] = [];
  for (let s = toMin(sc.open); s + sc.durationMin <= toMin(sc.close); s += Math.max(5, sc.stepMin)) {
    if (s < be && bs < s + sc.durationMin) continue;
    out.push(s);
  }
  return out;
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const dayName = (d: number) => DAY_NAMES[d] ?? String(d);

/** Ringkasan jam istirahat, mis. "Senin–Kamis 12.00–13.00, Jumat 11.30–13.30". */
export function breaksText(cfg: ServiceConfig) {
  const dot = (hm: string) => hm.replace(':', '.');
  const groups: { days: number[]; range: string }[] = [];
  for (const d of cfg.schedule.workDays) {
    const b = cfg.schedule.breaks[String(d)];
    if (!b) continue;
    const range = `${dot(b.start)}–${dot(b.end)}`;
    const last = groups[groups.length - 1];
    if (last && last.range === range && last.days[last.days.length - 1] === d - 1) last.days.push(d);
    else groups.push({ days: [d], range });
  }
  return groups
    .map((g) => `${g.days.length > 1 ? `${dayName(g.days[0])}–${dayName(g.days[g.days.length - 1])}` : dayName(g.days[0])} ${g.range}`)
    .join(', ');
}

/** Ganti placeholder teks informasi: {durasi}, {toleransi}, {jeda}, {lead}. */
export function fillInfo(text: string, cfg: ServiceConfig) {
  return text
    .replaceAll('{durasi}', String(cfg.schedule.durationMin))
    .replaceAll('{toleransi}', String(cfg.lateToleranceMin))
    .replaceAll('{jeda}', gapText(cfg.minGapDays))
    .replaceAll('{lead}', String(cfg.schedule.leadHours));
}

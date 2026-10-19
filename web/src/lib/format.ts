import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from 'date-fns';
import { id } from 'date-fns/locale';

/**
 * Semua jadwal layanan dalam WIB. Tanggal digeser supaya "jam dinding"-nya sama dengan WIB,
 * berapa pun zona waktu perangkat pengguna.
 */
export function wib(v: string | Date) {
  const d = new Date(v);
  return new Date(d.getTime() + (7 * 60 + d.getTimezoneOffset()) * 60_000);
}

export const fmtDate = (iso: string | Date, pattern = 'd MMM yyyy') => format(wib(iso), pattern, { locale: id });
export const fmtTime = (iso: string | Date) => format(wib(iso), 'HH.mm', { locale: id });

export function fmtDay(iso: string | Date) {
  const d = wib(iso);
  if (isToday(d)) return 'Hari ini';
  if (isTomorrow(d)) return 'Besok';
  if (isYesterday(d)) return 'Kemarin';
  return format(d, 'EEEE, d MMM', { locale: id });
}

export function fmtSchedule(start: string | null, end?: string | null) {
  if (!start) return 'Belum dijadwalkan';
  return `${fmtDay(start)} · ${fmtTime(start)}${end ? `–${fmtTime(end)}` : ''}`;
}

/** "Senin, 2 November 2026" dari "2026-11-02". */
export const fmtYmd = (date: string, pattern = 'EEEE, d MMMM yyyy') => format(new Date(`${date}T00:00:00`), pattern, { locale: id });
export const hmDot = (hm: string) => hm.replace(':', '.');
export const addMinutes = (hm: string, n: number) => {
  const [h, m] = hm.split(':').map(Number);
  const t = h * 60 + m + n;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export const fromNow = (iso: string) => formatDistanceToNowStrict(new Date(iso), { locale: id, addSuffix: true });

/** "2026-10-15" dari Date lokal. */
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Tanggal hari ini menurut WIB. */
export const todayWib = () => ymd(wib(new Date()));

export const firstName = (name: string) => name.split(' ')[0];
export const fullPsychName = (p: { name: string; title: string | null }) => (p.title ? `${p.name}, ${p.title}` : p.name);

export function ageOf(birth?: string | null) {
  if (!birth) return null;
  return Math.floor((Date.now() - Date.parse(`${birth}T00:00:00Z`)) / (365.25 * 864e5));
}

export function greeting() {
  const h = wib(new Date()).getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

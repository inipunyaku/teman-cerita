import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from 'date-fns';
import { id } from 'date-fns/locale';

export const fmtDate = (iso: string | Date, pattern = 'd MMM yyyy') => format(new Date(iso), pattern, { locale: id });
export const fmtTime = (iso: string | Date) => format(new Date(iso), 'HH.mm', { locale: id });

export function fmtDay(iso: string | Date) {
  const d = new Date(iso);
  if (isToday(d)) return 'Hari ini';
  if (isTomorrow(d)) return 'Besok';
  if (isYesterday(d)) return 'Kemarin';
  return format(d, 'EEEE, d MMM', { locale: id });
}

export function fmtSchedule(start: string | null, end?: string | null) {
  if (!start) return 'Belum dijadwalkan';
  return `${fmtDay(start)} · ${fmtTime(start)}${end ? `–${fmtTime(end)}` : ''}`;
}

export const fromNow = (iso: string) => formatDistanceToNowStrict(new Date(iso), { locale: id, addSuffix: true });

export function fmtSlot(s: { date: string; from: string; to: string }) {
  return `${format(new Date(`${s.date}T00:00`), 'EEE, d MMM', { locale: id })} · ${s.from.replace(':', '.')}–${s.to.replace(':', '.')}`;
}

/** "2026-10-15" untuk input type=date dari Date lokal. */
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export const firstName = (name: string) => name.split(' ')[0];

export function greeting() {
  const h = new Date().getHours();
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

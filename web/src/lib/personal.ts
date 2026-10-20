import { useEffect, useState, type CSSProperties } from 'react';
import { wib } from './format';

// ---------------------------------------------------------------------------
// Waktu (WIB)

export type DayPart = 'pagi' | 'siang' | 'sore' | 'malam';

export function dayPart(d: Date = wib(new Date())): DayPart {
  const h = d.getHours();
  if (h >= 4 && h < 11) return 'pagi';
  if (h >= 11 && h < 15) return 'siang';
  if (h >= 15 && h < 18) return 'sore';
  return 'malam';
}

/** Jam dinding WIB yang ikut diperbarui tiap menit — pergantian pagi→siang terasa tanpa reload. */
export function useWibNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => wib(new Date()));
  useEffect(() => {
    const t = window.setInterval(() => setNow(wib(new Date())), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

interface SkyTheme {
  label: string;
  /** Latar langit hero. */
  sky: string;
  ink: string;
  soft: string;
  /** Warna chip & kartu kaca di atas langit. */
  glass: string;
  night: boolean;
  line: string;
}

export const SKY: Record<DayPart, SkyTheme> = {
  pagi: {
    label: 'Pagi',
    sky: 'linear-gradient(180deg, #FFD7B5 0%, #FFE6CC 34%, #FFF4E6 66%, #EAF5FF 100%)',
    ink: '#5B3416',
    soft: 'rgba(91,52,22,.72)',
    glass: 'rgba(255,255,255,.62)',
    night: false,
    line: 'Semoga pagimu hangat seperti secangkir teh.',
  },
  siang: {
    label: 'Siang',
    sky: 'linear-gradient(180deg, #86CDFA 0%, #B7E2FD 42%, #E3F3FF 78%, #F4FAFF 100%)',
    ink: '#0B3F60',
    soft: 'rgba(11,63,96,.72)',
    glass: 'rgba(255,255,255,.6)',
    night: false,
    line: 'Sudah sempat makan siang? Tubuhmu juga butuh diperhatikan.',
  },
  sore: {
    label: 'Sore',
    sky: 'linear-gradient(180deg, #F59C7A 0%, #FABF8E 32%, #FCDDB8 62%, #F8E6EF 100%)',
    ink: '#5A2232',
    soft: 'rgba(90,34,50,.74)',
    glass: 'rgba(255,255,255,.55)',
    night: false,
    line: 'Hari hampir selesai. Kamu sudah berusaha dengan baik hari ini.',
  },
  malam: {
    label: 'Malam',
    sky: 'linear-gradient(180deg, #0B1A3A 0%, #15295A 48%, #24427A 100%)',
    ink: '#F3F6FF',
    soft: 'rgba(214,224,248,.82)',
    glass: 'rgba(255,255,255,.1)',
    night: true,
    line: 'Malam ini, izinkan dirimu beristirahat. Besok bisa dimulai lagi pelan-pelan.',
  },
};

export const WEEKDAY_NOTE = [
  'Minggu yang tenang — saatnya mengisi ulang energimu.',
  'Awal pekan baru. Pelan-pelan saja, satu langkah dulu.',
  'Selasa: waktunya menemukan ritme kerjamu.',
  'Sudah setengah pekan. Jangan lupa jeda sebentar.',
  'Kamis — sedikit lagi menuju akhir pekan.',
  'Jumat! Tutup pekan ini dengan perasaan lega.',
  'Akhir pekan. Semoga kamu sempat beristirahat dan bersenang-senang.',
];

// ---------------------------------------------------------------------------
// Aksen & tipografi berdasarkan jenis kelamin

export interface Accent {
  key: 'L' | 'P' | 'netral';
  acc: string;
  soft: string;
  ink: string;
  ring: string;
  /** Kelas tipografi nama di hero. */
  nameFont: string;
}

export const ACCENTS: Record<Accent['key'], Accent> = {
  // Biru samudra + huruf membulat tegas (selaras huruf logo).
  L: { key: 'L', acc: '#1F7DD0', soft: '#E3F1FD', ink: '#0B4C82', ring: '#A8D3F6', nameFont: 'font-brand font-semibold tracking-[-0.01em]' },
  // Merah muda kelopak + serif miring yang luwes.
  P: { key: 'P', acc: '#D2577F', soft: '#FCE8EF', ink: '#8A2648', ring: '#F3B5C9', nameFont: 'display italic' },
  netral: { key: 'netral', acc: '#1E88D6', soft: '#E6F3FD', ink: '#0B5A8F', ring: '#B5DCF8', nameFont: 'display italic' },
};

export const accentFor = (gender?: string | null) => (gender === 'L' ? ACCENTS.L : gender === 'P' ? ACCENTS.P : ACCENTS.netral);

/** Variabel CSS untuk dipakai kelas seperti `bg-[var(--acc)]`. */
export const accentVars = (a: Accent) =>
  ({ '--acc': a.acc, '--acc-soft': a.soft, '--acc-ink': a.ink, '--acc-ring': a.ring }) as CSSProperties;

// ---------------------------------------------------------------------------
// Ulang tahun

/** 0 = hari ini, 1..n = beberapa hari lagi; null bila tanggal lahir kosong. */
export function daysToBirthday(birth: string | null | undefined, today: Date) {
  if (!birth) return null;
  const [, m, d] = birth.split('-').map(Number);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(t.getFullYear(), m - 1, d);
  if (next < t) next = new Date(t.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - t.getTime()) / 864e5);
}

// ---------------------------------------------------------------------------
// Penyimpanan lokal (hanya di perangkat ini; aman bila diblokir)

export function useLocal<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const save = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* mode privat / penyimpanan penuh — cukup di memori */
    }
  };
  return [value, save] as const;
}

/** Angka harian yang stabil per pengguna — untuk memilih afirmasi hari ini. */
export function dailySeed(userId: number, d: Date) {
  const start = new Date(d.getFullYear(), 0, 0);
  const day = Math.floor((d.getTime() - start.getTime()) / 864e5);
  return day * 31 + userId * 7;
}

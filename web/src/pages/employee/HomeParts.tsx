import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { format, subDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ArrowRight, Cake, Check, Moon, Pause, Play, Quote, Sun, Sunrise, Sunset, Wind } from 'lucide-react';
import { AnimatedLogo } from '@/components/Brand';
import { Clouds } from '@/components/ui';
import { fmtDate, fullPsychName, ymd } from '@/lib/format';
import { SKY, type Accent, type DayPart, useLocal } from '@/lib/personal';
import type { Eligibility, Ticket } from '@/lib/types';

const PART_ICON = { pagi: Sunrise, siang: Sun, sore: Sunset, malam: Moon } as const;

// ---------------------------------------------------------------------------
// Hero langit — berubah mengikuti pagi / siang / sore / malam

export function SkyHero({
  part,
  now,
  accent,
  greeting,
  name,
  message,
  note,
  birthdayIn,
  children,
}: {
  part: DayPart;
  now: Date;
  accent: Accent;
  greeting: string;
  name: string;
  message: ReactNode;
  note: string;
  birthdayIn: number | null;
  children?: ReactNode;
}) {
  const sky = SKY[part];
  const Icon = PART_ICON[part];
  const isBirthday = birthdayIn === 0;
  return (
    <section
      className="relative -mx-4 overflow-hidden px-5 pb-[150px] pt-6 sm:mx-0 sm:rounded-4xl sm:px-10 sm:pb-12 sm:pt-9 lg:min-h-[360px]"
      style={{ background: sky.sky, color: sky.ink }}
    >
      <SkyScene part={part} />
      {isBirthday && <Confetti />}

      <div className="relative z-10 max-w-xl animate-rise">
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 backdrop-blur-sm" style={{ background: sky.glass }}>
            <Icon size={15} strokeWidth={2} /> {sky.label} · {format(now, 'EEEE, d MMMM', { locale: localeId })}
          </span>
          <span className="inline-flex h-8 items-center rounded-full px-3 tabular-nums backdrop-blur-sm" style={{ background: sky.glass }}>
            {format(now, 'HH.mm')} WIB
          </span>
          {birthdayIn !== null && birthdayIn > 0 && birthdayIn <= 7 && (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-white" style={{ background: accent.acc }}>
              <Cake size={14} /> {birthdayIn === 1 ? 'Besok ulang tahunmu!' : `${birthdayIn} hari lagi ulang tahunmu`}
            </span>
          )}
        </div>

        <p className="mt-6 text-[16px] font-medium" style={{ color: sky.soft }}>
          {isBirthday ? 'Selamat ulang tahun,' : `${greeting},`}
        </p>
        <h1
          className={clsx('mt-0.5 break-words text-[54px] leading-[0.98] sm:text-[72px]', accent.nameFont)}
          style={{ color: sky.night ? '#FFFFFF' : accent.ink }}
        >
          {name}
          {isBirthday ? ' 🎂' : '.'}
        </h1>
        <p className="mt-4 max-w-md text-[16px] leading-relaxed" style={{ color: sky.ink }}>
          {message}
        </p>
        <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed" style={{ color: sky.soft }}>
          {note}
        </p>
        {children}
      </div>

      {/* Teman-teman dari logo mengintip di tepi bawah — tidur saat malam */}
      <div className="pointer-events-none absolute bottom-0 right-1/2 w-[230px] translate-x-1/2 sm:right-8 sm:w-[300px] sm:translate-x-0 lg:right-14 lg:w-[360px]">
        <AnimatedLogo variant="peek" sleepy={sky.night} title={sky.night ? 'Teman Cerita sedang tidur' : 'Teman Cerita menyapamu'} className="w-full" />
      </div>
    </section>
  );
}

function SkyScene({ part }: { part: DayPart }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {part === 'pagi' && (
        <>
          <Sunball className="right-[10%] top-[30%] h-20 w-20 sm:right-[34%] sm:top-[38%] sm:h-24 sm:w-24" core="#FFE9A8" edge="#FFAA55" glow="rgba(255,190,120,.55)" rise />
          <Birds />
          <Clouds className="absolute -left-24 top-[46%] w-[300px] animate-drift opacity-70" />
          <Clouds className="absolute -right-24 top-4 w-[360px] animate-drift opacity-80 [animation-delay:-7s]" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-white/50 to-transparent" />
        </>
      )}
      {part === 'siang' && (
        <>
          <Sunball className="right-[8%] top-[8%] h-20 w-20 sm:right-[12%] sm:top-[12%] sm:h-24 sm:w-24" core="#FFF6C2" edge="#FFC72C" glow="rgba(255,230,120,.75)" rays />
          <Clouds className="absolute -right-20 top-[30%] w-[380px] animate-drift opacity-95" />
          <Clouds className="absolute -left-32 top-[8%] w-[320px] animate-drift opacity-80 [animation-delay:-5s]" />
          <div className="absolute inset-x-0 top-[18%] animate-cloudPass [animation-duration:80s] [animation-delay:-30s]">
            <Clouds className="w-[180px] opacity-80" />
          </div>
        </>
      )}
      {part === 'sore' && (
        <>
          <Sunball className="bottom-[60px] right-[8%] h-32 w-32 sm:bottom-[40px] sm:right-[36%] sm:h-40 sm:w-40" core="#FFD58A" edge="#FF7E4F" glow="rgba(255,140,90,.55)" />
          <svg viewBox="0 0 800 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[90px] w-full sm:h-[110px]">
            <path d="M0 70C120 30 220 40 330 70S560 30 800 60V120H0Z" fill="#F4A98C" opacity=".55" />
            <path d="M0 95C150 65 260 80 400 95S640 70 800 88V120H0Z" fill="#EE9384" opacity=".55" />
          </svg>
          <Clouds className="absolute -left-20 top-6 w-[340px] animate-drift opacity-50" />
        </>
      )}
      {part === 'malam' && (
        <>
          <Stars />
          <div className="absolute right-[10%] top-[10%] sm:right-[14%] sm:top-[14%]">
            <div className="hm-glow absolute -inset-10 rounded-full bg-[#FFF1C4]/25 blur-2xl" />
            <svg viewBox="0 0 64 64" className="relative h-16 w-16 sm:h-20 sm:w-20">
              <path d="M44 6a28 28 0 1 0 14 40A24 24 0 0 1 44 6z" fill="#FFF1C4" />
              <circle cx="24" cy="30" r="3" fill="#F2DE9C" />
              <circle cx="32" cy="46" r="2" fill="#F2DE9C" />
            </svg>
          </div>
          <Clouds className="absolute -left-24 top-[40%] w-[320px] animate-drift opacity-[.12]" />
        </>
      )}
    </div>
  );
}

function Sunball({ className, core, edge, glow, rays, rise }: { className: string; core: string; edge: string; glow: string; rays?: boolean; rise?: boolean }) {
  return (
    <div className={clsx('absolute', rise && 'hm-sunrise', className)}>
      <div className="hm-glow absolute -inset-[70%] rounded-full blur-2xl" style={{ background: glow }} />
      {rays && (
        <svg viewBox="0 0 100 100" className="hm-spin absolute -inset-[45%] h-[190%] w-[190%] opacity-60">
          {Array.from({ length: 12 }).map((_, i) => (
            <rect key={i} x="48.5" y="2" width="3" height="14" rx="1.5" fill={edge} transform={`rotate(${i * 30} 50 50)`} />
          ))}
        </svg>
      )}
      <div className="relative h-full w-full rounded-full" style={{ background: `radial-gradient(circle at 38% 35%, ${core} 0%, ${edge} 100%)` }} />
    </div>
  );
}

function Birds() {
  return (
    <div className="absolute inset-x-0 top-[18%] animate-cloudPass [animation-duration:45s] [animation-delay:-12s]">
      <svg viewBox="0 0 60 24" className="w-14 text-[#8A5A3A]/60">
        {[
          [4, 14, 1],
          [22, 6, 0.8],
          [40, 16, 0.7],
        ].map(([x, y, s], i) => (
          <path key={i} d={`M${x} ${y}q${4 * s} ${-5 * s} ${8 * s} 0q${4 * s} ${-5 * s} ${8 * s} 0`} stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        ))}
      </svg>
    </div>
  );
}

// Posisi bintang tetap (bukan acak) supaya tidak berpindah tiap render.
const STARS = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 72,
  size: 2 + (i % 3),
  delay: (i % 7) * 0.35,
}));
function Stars() {
  return (
    <>
      {STARS.map((s, i) => (
        <span
          key={i}
          className="tc-twinkle absolute rounded-full bg-white"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, animationDuration: `${2 + (i % 4) * 0.6}s` }}
        />
      ))}
    </>
  );
}

const CONFETTI_COLORS = ['#FFC94D', '#FF8FAB', '#6ED5FD', '#257CF3', '#17B4A4', '#B9A6F0'];
function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden>
      {Array.from({ length: 22 }).map((_, i) => (
        <span
          key={i}
          className="hm-confetti absolute top-0 rounded-[2px]"
          style={{
            left: `${(i * 41 + 5) % 100}%`,
            width: 6 + (i % 3) * 2,
            height: 10 + (i % 2) * 4,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 9) * 0.4}s`,
            animationDuration: `${3.2 + (i % 5) * 0.5}s`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cek perasaan harian (tersimpan di perangkat saja)

type MoodKey = 'senang' | 'tenang' | 'biasa' | 'lelah' | 'sedih';
const MOODS: { key: MoodKey; label: string; color: string; reply: string }[] = [
  { key: 'senang', label: 'Senang', color: '#FFCB57', reply: 'Ikut senang! Coba ingat apa yang membuat harimu baik — simpan itu sebagai pengingat di hari yang berat.' },
  { key: 'tenang', label: 'Tenang', color: '#6ED5FD', reply: 'Rasa tenang itu berharga. Pertahankan ritmemu, dan bagikan ketenangan itu ke sekitarmu.' },
  { key: 'biasa', label: 'Biasa', color: '#C5D2DE', reply: 'Hari yang biasa juga tidak apa-apa. Jangan lupa jeda sebentar dan minum air ya.' },
  { key: 'lelah', label: 'Lelah', color: '#BCA9F2', reply: 'Terima kasih sudah jujur pada dirimu. Istirahat sejenak bukan berarti menyerah.' },
  { key: 'sedih', label: 'Sedih', color: '#86AEF2', reply: 'Kamu tidak sendirian. Kalau rasa sedih atau cemas mulai terasa berat, psikolog kami siap mendengarkan.' },
];

export function MoodFace({ mood, className }: { mood: MoodKey; className?: string }) {
  const m = MOODS.find((x) => x.key === mood)!;
  const ink = '#123C63';
  const s = { stroke: ink, strokeWidth: 3.2, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <circle cx="24" cy="25" r="20" fill={m.color} />
      <path d="M12 18c2-5 6-8 11-8.5" stroke="#fff" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" fill="none" />
      {mood === 'senang' && (<><circle cx="17.5" cy="22" r="2.4" fill={ink} /><circle cx="30.5" cy="22" r="2.4" fill={ink} /><path d="M15.5 28.5c3.8 6 13.2 6 17 0" {...s} /></>)}
      {mood === 'tenang' && (<><path d="M14.5 22.5c1.5 2.4 4.5 2.4 6 0M27.5 22.5c1.5 2.4 4.5 2.4 6 0" {...s} /><path d="M18 30c3 2.8 9 2.8 12 0" {...s} /></>)}
      {mood === 'biasa' && (<><circle cx="17.5" cy="22.5" r="2.2" fill={ink} /><circle cx="30.5" cy="22.5" r="2.2" fill={ink} /><path d="M18 31h12" {...s} /></>)}
      {mood === 'lelah' && (<><path d="M14.5 23h6M27.5 23h6" {...s} /><path d="M18 31.5c2-1.6 4-1.6 6 0s4 1.6 6 0" {...s} /></>)}
      {mood === 'sedih' && (<><circle cx="17.5" cy="22" r="2.2" fill={ink} /><circle cx="30.5" cy="22" r="2.2" fill={ink} /><path d="M18 32.5c3-3 9-3 12 0" {...s} /><path d="M33.5 26.5c1.6 2.4 1.6 4 0 4.6-1.6-.6-1.6-2.2 0-4.6z" fill="#fff" opacity=".9" /></>)}
    </svg>
  );
}

const WD = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function MoodCheckin({
  userId,
  part,
  now,
  accent,
  canBook,
  hasActive,
  onBreathe,
}: {
  userId: number;
  part: DayPart;
  now: Date;
  accent: Accent;
  canBook: boolean;
  hasActive: boolean;
  onBreathe: () => void;
}) {
  const [log, setLog] = useLocal<Record<string, MoodKey>>(`tc:mood:${userId}`, {});
  const today = ymd(now);
  const mood = log[today];
  const picked = MOODS.find((m) => m.key === mood);
  const week = Array.from({ length: 7 }, (_, i) => subDays(now, 6 - i));

  const pick = (k: MoodKey) => {
    // Simpan 60 hari terakhir saja.
    const keep = Object.fromEntries(Object.entries({ ...log, [today]: k }).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 60));
    setLog(keep);
  };

  return (
    <section className="card card-pad">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-brand text-[19px] font-semibold">Bagaimana perasaanmu {part} ini?</h2>
          <p className="mt-0.5 text-[13px] text-ink-faint">Cukup untukmu sendiri — hanya tersimpan di perangkat ini.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2.5">
        {MOODS.map((m) => {
          const on = m.key === mood;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => pick(m.key)}
              aria-pressed={on}
              className={clsx(
                'group flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 transition-all duration-200',
                on ? 'border-transparent shadow-soft' : 'border-line hover:-translate-y-0.5 hover:border-[var(--acc-ring)]',
              )}
              style={on ? { background: accent.soft, boxShadow: `0 0 0 2px ${accent.acc}` } : undefined}
            >
              <MoodFace mood={m.key} className={clsx('h-10 w-10 transition-transform duration-300 sm:h-12 sm:w-12', on ? 'scale-110' : 'group-hover:scale-105')} />
              <span className={clsx('text-[12px] font-semibold sm:text-[13px]', on ? 'text-[var(--acc-ink)]' : 'text-ink-soft')}>{m.label}</span>
            </button>
          );
        })}
      </div>

      {picked && (
        <div key={picked.key} className="mt-4 animate-rise rounded-2xl px-4 py-3.5 text-[14px] leading-relaxed" style={{ background: accent.soft, color: accent.ink }}>
          {picked.reply}
          {picked.key === 'lelah' && (
            <button type="button" onClick={onBreathe} className="mt-2.5 flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline">
              <Wind size={15} /> Coba latihan napas 1 menit
            </button>
          )}
          {picked.key === 'sedih' &&
            (hasActive ? (
              <p className="mt-1.5 font-semibold">Ceritakan juga perasaan ini di sesi konselingmu nanti, ya.</p>
            ) : canBook ? (
              <Link to="/buat-janji" className="mt-2.5 flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline">
                Buat janji dengan psikolog <ArrowRight size={15} />
              </Link>
            ) : null)}
        </div>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <p className="eyebrow">7 hari terakhir</p>
        <div className="mt-2.5 grid grid-cols-7 gap-1">
          {week.map((d) => {
            const k = log[ymd(d)];
            const isToday = ymd(d) === today;
            return (
              <div key={ymd(d)} className="flex flex-col items-center gap-1">
                {k ? (
                  <MoodFace mood={k} className="h-7 w-7" />
                ) : (
                  <span className={clsx('grid h-7 w-7 place-items-center rounded-full border-2 border-dashed', isToday ? 'border-[var(--acc-ring)]' : 'border-line')} />
                )}
                <span className={clsx('text-[11px]', isToday ? 'font-bold text-[var(--acc-ink)]' : 'text-ink-faint')}>{isToday ? 'Hari ini' : WD[d.getDay()]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Rawat diri sesuai waktu + latihan napas

const CARE: Record<DayPart, { title: string; tips: string[] }> = {
  pagi: { title: 'Mulai hari pelan-pelan', tips: ['Minum segelas air putih', 'Tarik napas dalam tiga kali', 'Tulis satu hal yang ingin kamu capai hari ini'] },
  siang: { title: 'Jeda di tengah hari', tips: ['Alihkan mata dari layar selama 20 detik', 'Makan siang tanpa sambil bekerja', 'Berdiri dan regangkan bahu sebentar'] },
  sore: { title: 'Menutup hari kerja', tips: ['Catat satu hal yang berjalan baik hari ini', 'Rapikan daftar tugas untuk besok', 'Pamit dari pekerjaan — kamu sudah cukup berusaha'] },
  malam: { title: 'Waktunya beristirahat', tips: ['Jauhkan layar 30 menit sebelum tidur', 'Redupkan lampu dan dengarkan musik tenang', 'Ucapkan terima kasih pada dirimu hari ini'] },
};

export function SelfCare({ userId, part, now, accent, breatheSignal }: { userId: number; part: DayPart; now: Date; accent: Accent; breatheSignal: number }) {
  const care = CARE[part];
  const [done, setDone] = useLocal<number[]>(`tc:care:${userId}:${ymd(now)}:${part}`, []);
  const toggle = (i: number) => setDone(done.includes(i) ? done.filter((x) => x !== i) : [...done, i]);
  const all = done.length === care.tips.length;

  return (
    <section className="card card-pad">
      <p className="eyebrow" style={{ color: accent.acc }}>Untukmu {part} ini</p>
      <h2 className="mt-1 font-brand text-[19px] font-semibold">{care.title}</h2>
      <ul className="mt-3.5 space-y-2">
        {care.tips.map((t, i) => {
          const on = done.includes(i);
          return (
            <li key={t}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={on}
                className="flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left text-[14px] transition-colors hover:bg-canvas"
              >
                <span
                  className={clsx('grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-all', on ? 'scale-105 border-transparent text-white' : 'border-line text-transparent')}
                  style={on ? { background: accent.acc } : undefined}
                >
                  <Check size={14} strokeWidth={3} />
                </span>
                <span className={clsx(on ? 'text-ink-faint line-through decoration-1' : 'text-ink')}>{t}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {all && <p className="mt-2 animate-rise text-[13px] font-semibold" style={{ color: accent.ink }}>Semua selesai — kamu hebat sudah merawat dirimu. 💙</p>}
      <Breathing accent={accent} signal={breatheSignal} />
    </section>
  );
}

const PHASES = [
  { label: 'Tarik napas', secs: 4, scale: 1 },
  { label: 'Tahan', secs: 4, scale: 1 },
  { label: 'Hembuskan', secs: 6, scale: 0.55 },
] as const;
const CYCLES = 4;

function Breathing({ accent, signal }: { accent: Accent; signal: number }) {
  const [step, setStep] = useState(-1); // -1 = belum mulai
  const [left, setLeft] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const running = step >= 0;
  const phase = running ? PHASES[step % PHASES.length] : null;

  useEffect(() => {
    if (!signal) return;
    setStep(0);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [signal]);

  useEffect(() => {
    if (!phase) return;
    setLeft(phase.secs);
    const tick = window.setInterval(() => setLeft((x) => Math.max(1, x - 1)), 1000);
    const next = window.setTimeout(() => setStep((s) => (s + 1 >= CYCLES * PHASES.length ? -1 : s + 1)), phase.secs * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(next);
    };
  }, [step, phase]);

  return (
    <div ref={ref} className="mt-5 flex items-center gap-4 rounded-2xl p-4" style={{ background: accent.soft }}>
      <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center">
        <span className="absolute inset-0 rounded-full opacity-25" style={{ background: accent.acc }} />
        <span
          className="absolute inset-[6px] rounded-full ease-in-out"
          style={{
            background: accent.acc,
            opacity: 0.85,
            transform: `scale(${phase ? phase.scale : 0.6})`,
            transitionProperty: 'transform',
            transitionDuration: `${phase ? phase.secs : 0.6}s`,
          }}
        />
        <span className="relative font-brand text-[18px] font-bold text-white tabular-nums">{running ? left : <Wind size={20} />}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-brand text-[16px] font-semibold" style={{ color: accent.ink }}>
          {phase ? phase.label : 'Latihan napas 1 menit'}
        </p>
        <p className="text-[12.5px]" style={{ color: accent.ink, opacity: 0.75 }}>
          {running ? `Putaran ${Math.floor(step / PHASES.length) + 1} dari ${CYCLES}` : 'Tarik 4 detik · tahan 4 · hembuskan 6'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setStep(running ? -1 : 0)}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-soft transition-transform active:scale-95"
        style={{ color: accent.acc }}
        aria-label={running ? 'Hentikan latihan napas' : 'Mulai latihan napas'}
      >
        {running ? <Pause size={18} /> : <Play size={18} className="translate-x-px" />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Afirmasi harian

const AFFIRMATIONS = [
  'Perasaanmu valid, apa pun bentuknya hari ini.',
  'Kamu tidak harus selalu kuat. Kamu cukup jadi dirimu.',
  'Langkah kecil tetaplah langkah. Kamu sedang bergerak maju.',
  'Meminta bantuan adalah tanda keberanian, bukan kelemahan.',
  'Tidak apa-apa beristirahat. Dunia tetap berputar, dan kamu tetap berharga.',
  'Kamu sudah melewati banyak hari sulit — dan kamu masih di sini.',
  'Hari ini cukup lakukan yang kamu bisa. Itu sudah cukup.',
  'Ceritamu penting, dan ada yang siap mendengarkan.',
  'Kamu berhak merasa tenang dan bahagia.',
  'Bersikap lembut pada diri sendiri juga bagian dari produktif.',
  'Kemajuan tidak harus sempurna untuk tetap berarti.',
  'Napas yang pelan, pikiran yang lebih ringan.',
  'Kamu bagian penting dari tim ini — dan dirimu juga penting.',
  'Satu hari yang buruk bukan berarti hidup yang buruk.',
];

export function Affirmation({ seed, accent, part }: { seed: number; accent: Accent; part: DayPart }) {
  const text = AFFIRMATIONS[seed % AFFIRMATIONS.length];
  const night = SKY[part].night;
  return (
    <section
      className="relative overflow-hidden rounded-3xl p-5 sm:p-6"
      style={{ background: night ? 'linear-gradient(135deg,#15295A,#24427A)' : `linear-gradient(135deg, ${accent.soft}, #FFFFFF)`, color: night ? '#F3F6FF' : accent.ink }}
    >
      <Quote size={56} className="absolute -right-2 -top-2 opacity-10" />
      <p className="eyebrow" style={{ color: 'inherit', opacity: 0.7 }}>Pesan untukmu hari ini</p>
      <p className="display mt-2 text-[26px] italic leading-snug sm:text-[28px]">“{text}”</p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Perjalanan konseling pengguna

const STEPS = [
  ['Persetujuan & skrining', 'Baca informed consent lalu isi skrining singkat tentang kondisimu.'],
  ['Pilih psikolog & jadwal', 'Lihat slot yang masih tersedia, pilih psikolog, jam, dan media konseling.'],
  ['Bercerita', 'Sesi 60 menit lewat tatap muka, chat, atau video/voice call Microsoft Teams.'],
  ['Hasil & feedback', 'Lihat hasil dan tindak lanjut dari psikolog, lalu bagikan pengalamanmu.'],
];

export function Journey({ tickets, el, joinedAt, accent }: { tickets: Ticket[]; el?: Eligibility; joinedAt: string; accent: Accent }) {
  const done = tickets.filter((t) => t.status === 'completed' || t.status === 'awaiting_report');
  const last = [...done].sort((a, b) => (a.scheduledStart < b.scheduledStart ? 1 : -1))[0];
  const quota = el ? Math.min(1, el.yearCount / Math.max(1, el.maxPerYear)) : 0;

  if (tickets.length === 0) {
    return (
      <section className="card card-pad">
        <h2 className="font-brand text-[19px] font-semibold">Pertama kali di sini? Begini caranya</h2>
        <ol className="mt-4 grid gap-5 sm:grid-cols-2">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-brand text-[16px] font-bold" style={{ background: accent.soft, color: accent.ink }}>
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{t}</p>
                <p className="text-[13.5px] leading-relaxed text-ink-soft">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        {el && <p className="mt-5 border-t border-line pt-4 text-[13px] text-ink-faint">Kuota tahun ini: {el.maxPerYear} sesi · jeda minimal 2 minggu antar sesi.</p>}
      </section>
    );
  }

  return (
    <section className="card card-pad">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-brand text-[19px] font-semibold">Perjalananmu</h2>
        <Link to="/pendaftaran" className="inline-flex items-center gap-1 text-[13px] font-semibold" style={{ color: accent.acc }}>
          Semua pendaftaran <ArrowRight size={14} />
        </Link>
      </div>
      {done.length > 0 && (
        <p className="mt-1 text-[14px] text-ink-soft">
          Kamu sudah <b className="text-ink">{done.length} kali</b> berani bercerita. Itu bukan hal kecil.
        </p>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-canvas p-3.5">
          <dt className="text-[12px] font-semibold text-ink-faint">Sesi tahun ini</dt>
          <dd className="mt-1 font-brand text-[22px] font-bold leading-none">
            {el?.yearCount ?? 0}
            <span className="text-[14px] font-medium text-ink-faint"> / {el?.maxPerYear ?? '–'}</span>
          </dd>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${quota * 100}%`, background: accent.acc }} />
          </div>
        </div>
        <div className="rounded-2xl bg-canvas p-3.5">
          <dt className="text-[12px] font-semibold text-ink-faint">Bersama sejak</dt>
          <dd className="mt-1 font-brand text-[18px] font-bold leading-tight">{fmtDate(joinedAt, 'MMMM yyyy')}</dd>
        </div>
      </dl>
      {last && (
        <Link to={`/pendaftaran/${last.id}`} className="mt-3 flex items-center gap-3 rounded-2xl border border-line p-3.5 transition-colors hover:bg-canvas">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-ink-faint">Sesi terakhir · {fmtDate(last.scheduledStart, 'd MMMM yyyy')}</p>
            <p className="truncate text-[14px] font-semibold">{fullPsychName(last.psychologist)}</p>
          </div>
          <ArrowRight size={16} className="shrink-0 text-ink-faint" />
        </Link>
      )}
    </section>
  );
}

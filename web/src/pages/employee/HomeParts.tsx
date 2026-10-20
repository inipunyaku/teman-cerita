import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { format, subDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ArrowRight, Cake, Calendar, Check, Heart, Moon, Pause, Play, Quote, Route, Smile, Sparkle, Sun, Sunrise, Sunset, Wind, type LucideIcon } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { fmtDate, fullPsychName, ymd } from '@/lib/format';
import { SKY, type Accent, type DayPart, useLocal } from '@/lib/personal';
import type { Eligibility, Ticket } from '@/lib/types';
import heroArt from '@/assets/home/hero-3d.png';
import windowArt from '@/assets/home/window.svg';
import cloudArt from '@/assets/home/cloud.svg';

const PART_ICON = { pagi: Sunrise, siang: Sun, sore: Sunset, malam: Moon } as const;

/** Lencana ikon bulat di kepala kartu (komponen Figma "Icon Chip"). */
export function IconChip({ icon: Icon, size = 44, className }: { icon: LucideIcon; size?: 44 | 40 | 32; className?: string }) {
  return (
    <span className={clsx('grid shrink-0 place-items-center rounded-full bg-sky-50 text-brand', className)} style={{ width: size, height: size }}>
      <Icon size={size === 32 ? 16 : 20} strokeWidth={2} absoluteStrokeWidth />
    </span>
  );
}

const cardTitle = 'font-brand text-[19px] font-semibold leading-[1.3]';

// ---------------------------------------------------------------------------
// Hero sapaan — teks di kiri, ilustrasi teman-teman di kanan

export function GreetingHero({
  part,
  now,
  greeting,
  name,
  message,
  birthdayIn,
  children,
}: {
  part: DayPart;
  now: Date;
  greeting: string;
  name: string;
  message: string;
  birthdayIn: number | null;
  children?: ReactNode;
}) {
  const Icon = PART_ICON[part];
  const isBirthday = birthdayIn === 0;
  return (
    <section className="relative flex flex-col overflow-hidden rounded-[28px] border border-line bg-gradient-to-r from-white to-[#E4F1FE] shadow-[0_12px_32px_-16px_rgba(15,92,138,0.1)] lg:min-h-[300px] lg:flex-row">
      {isBirthday && <Confetti />}

      <div className="relative z-10 flex min-w-0 flex-1 animate-rise flex-col justify-center px-5 py-6 sm:py-8 sm:pl-11 sm:pr-6">
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold">
          <span className="inline-flex h-[30px] items-center gap-1.5 rounded-full border border-line bg-white px-3">
            <Icon size={15} strokeWidth={2} absoluteStrokeWidth className="text-[#E8A317]" /> {SKY[part].label} · {format(now, 'EEEE, d MMMM yyyy', { locale: localeId })}
          </span>
          <span className="inline-flex h-[30px] items-center rounded-full border border-line bg-white px-3 tabular-nums">{format(now, 'HH.mm')} WIB</span>
          {birthdayIn !== null && birthdayIn > 0 && birthdayIn <= 7 && (
            <span className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-brand px-3 text-white">
              <Cake size={14} /> {birthdayIn === 1 ? 'Besok ulang tahunmu!' : `${birthdayIn} hari lagi ulang tahunmu`}
            </span>
          )}
        </div>

        <h1 className="mt-[26px] break-words font-display text-[38px] leading-[0.98] tracking-[-0.01em] sm:text-[48px]">
          {isBirthday ? 'Selamat ulang tahun' : greeting}
          <span className="italic">
            , <span className="text-[#4690F5]">{name}</span>
          </span>
          {isBirthday && ' 🎂'}
        </h1>
        <p className="mt-3 max-w-[520px] whitespace-pre-line text-[16px] leading-normal">{message}</p>
        {children}
      </div>

      <div className="relative h-[200px] shrink-0 sm:h-[260px] lg:h-auto lg:w-[640px]">
        <img src={heroArt} alt="" className="absolute inset-0 h-full w-full object-cover" />
        {/* Memudarkan tepi ilustrasi ke latar hero */}
        <div className="absolute inset-x-0 -top-px h-16 bg-gradient-to-b from-[#F1F8FF] via-[rgba(241,248,255,0.85)] via-25% to-[rgba(241,248,255,0)] lg:inset-x-auto lg:-bottom-px lg:left-0 lg:h-auto lg:w-[177px] lg:bg-gradient-to-r" />
      </div>
    </section>
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
    <section className="card card-pad shadow-soft">
      <div className="flex items-center gap-3.5">
        <IconChip icon={Smile} />
        <div className="min-w-0 flex-1">
          <h2 className={cardTitle}>Bagaimana perasaanmu {part} ini?</h2>
          <p className="mt-0.5 text-[13px] leading-normal text-ink-faint">Cukup untukmu sendiri — hanya tersimpan di perangkat ini.</p>
        </div>
      </div>

      <div className="mt-[18px] grid grid-cols-5 gap-1.5 sm:gap-3">
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
                on ? 'border-sky-600 bg-sky-100 shadow-[0_0_0_1px_theme(colors.sky.600)]' : 'border-line bg-white hover:-translate-y-0.5 hover:border-sky-200',
              )}
            >
              <MoodFace mood={m.key} className={clsx('h-10 w-10 transition-transform duration-300 sm:h-12 sm:w-12', on ? 'scale-110' : 'group-hover:scale-105')} />
              <span className={clsx('text-[12px] font-semibold leading-normal sm:text-[13px]', on ? 'text-sky-600' : 'text-ink-soft')}>{m.label}</span>
            </button>
          );
        })}
      </div>

      {picked && (
        <div key={picked.key} className="mt-3 flex animate-rise items-start gap-2.5 rounded-xl border border-line px-4 py-3 text-[13.5px] leading-normal">
          <Heart size={16} strokeWidth={2} absoluteStrokeWidth color={accent.acc} fill={accent.acc} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            {picked.reply}
            {picked.key === 'lelah' && (
              <button type="button" onClick={onBreathe} className="mt-2 flex items-center gap-1.5 font-semibold text-brand underline-offset-4 hover:underline">
                <Wind size={15} /> Coba latihan napas 1 menit
              </button>
            )}
            {picked.key === 'sedih' &&
              (hasActive ? (
                <p className="mt-1.5 font-semibold">Ceritakan juga perasaan ini di sesi konselingmu nanti, ya.</p>
              ) : canBook ? (
                <Link to="/buat-janji" className="mt-2 flex items-center gap-1.5 font-semibold text-brand underline-offset-4 hover:underline">
                  Buat janji dengan psikolog <ArrowRight size={15} />
                </Link>
              ) : null)}
          </div>
        </div>
      )}

      <p className="eyebrow mt-5">7 hari terakhir</p>
      <div className="mt-2.5 grid grid-cols-7 items-end gap-1">
        {week.map((d) => {
          const k = log[ymd(d)];
          const isToday = ymd(d) === today;
          const face = k ? (
            <MoodFace mood={k} className="h-7 w-7" />
          ) : (
            <span className={clsx('h-7 w-7 rounded-full border-2 border-dashed', isToday ? 'border-sky-300' : 'border-line')} />
          );
          return (
            <div key={ymd(d)} className="flex flex-col items-center gap-1">
              {isToday ? <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-sky-200 bg-sky-100">{face}</span> : face}
              <span className={clsx('text-[11px] leading-normal', isToday ? 'font-bold text-ink' : 'text-ink-faint')}>{isToday ? 'Hari ini' : WD[d.getDay()]}</span>
            </div>
          );
        })}
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

export function SelfCare({ userId, part, now, breatheSignal }: { userId: number; part: DayPart; now: Date; breatheSignal: number }) {
  const care = CARE[part];
  const [done, setDone] = useLocal<number[]>(`tc:care:${userId}:${ymd(now)}:${part}`, []);
  const toggle = (i: number) => setDone(done.includes(i) ? done.filter((x) => x !== i) : [...done, i]);
  const all = done.length === care.tips.length;

  return (
    <section className="card card-pad relative overflow-hidden shadow-soft">
      <img src={windowArt} alt="" width={130} height={172} className="pointer-events-none absolute right-[23px] top-[21px] hidden sm:block" />
      <div className="relative flex items-center gap-2.5">
        <IconChip icon={PART_ICON[part]} size={32} />
        <p className="text-[13px] font-semibold leading-normal text-brand">Untukmu {part} ini</p>
      </div>
      <h2 className="relative mt-2.5 font-brand text-[26px] font-bold leading-[1.2]">{care.title}</h2>
      <ul className="relative mt-3 w-full max-w-[380px] space-y-1.5">
        {care.tips.map((t, i) => {
          const on = done.includes(i);
          return (
            <li key={t}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={on}
                className="flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left text-[14px] leading-normal transition-colors hover:bg-canvas"
              >
                <span
                  className={clsx(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-all',
                    on ? 'scale-105 border-transparent bg-brand text-white' : 'border-line text-transparent',
                  )}
                >
                  <Check size={14} strokeWidth={3} />
                </span>
                <span className={clsx(on ? 'text-ink-faint line-through decoration-1' : 'text-ink')}>{t}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {all && <p className="relative mt-2 animate-rise text-[13px] font-semibold text-brand">Semua selesai — kamu hebat sudah merawat dirimu. 💙</p>}
      <Breathing signal={breatheSignal} />
    </section>
  );
}

const PHASES = [
  { label: 'Tarik napas', secs: 4, scale: 1 },
  { label: 'Tahan', secs: 4, scale: 1 },
  { label: 'Hembuskan', secs: 6, scale: 0.55 },
] as const;
const CYCLES = 4;

function Breathing({ signal }: { signal: number }) {
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
    <div ref={ref} className="relative mt-[18px] flex items-center gap-3.5 rounded-2xl border border-sky-100 bg-sky-50 py-3.5 pl-3.5 pr-4">
      <div className="relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-sky-100">
        <span
          className="absolute inset-0 rounded-full bg-brand ease-in-out"
          style={{
            opacity: running ? 0.85 : 0,
            transform: `scale(${phase ? phase.scale : 0.6})`,
            transitionProperty: 'transform, opacity',
            transitionDuration: `${phase ? phase.secs : 0.3}s`,
          }}
        />
        <span className="relative font-brand text-[18px] font-bold tabular-nums text-white">
          {running ? left : <Wind size={22} strokeWidth={2} absoluteStrokeWidth className="text-brand" />}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-brand text-[16px] font-semibold leading-[1.3] text-brand">{phase ? phase.label : 'Latihan napas 1 menit'}</p>
        <p className="text-[12.5px] text-ink-soft">
          {running ? `Putaran ${Math.floor(step / PHASES.length) + 1} dari ${CYCLES}` : 'Tarik 4 detik · tahan 4 · hembuskan 6'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setStep(running ? -1 : 0)}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white shadow-[0_8px_16px_-8px_rgba(37,124,243,0.4)] transition-transform hover:brightness-95 active:scale-95"
        aria-label={running ? 'Hentikan latihan napas' : 'Mulai latihan napas'}
      >
        {running ? <Pause size={18} fill="currentColor" /> : <Play size={18} strokeWidth={2} absoluteStrokeWidth fill="currentColor" className="translate-x-px" />}
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

export function Affirmation({ seed }: { seed: number }) {
  const text = AFFIRMATIONS[seed % AFFIRMATIONS.length];
  const sparkle = { strokeWidth: 2, absoluteStrokeWidth: true, fill: 'currentColor', 'aria-hidden': true } as const;
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-sky-100 py-6 pl-6 pr-[72px] shadow-soft"
      style={{ backgroundImage: 'linear-gradient(156deg, #EEF6FE 0%, #CEE4FD 100%)' }}
    >
      <img src={cloudArt} alt="" width={230} height={100} className="pointer-events-none absolute -bottom-[38.67px] -right-[41px]" />
      <Sparkle size={26} {...sparkle} className="pointer-events-none absolute right-[31px] top-[21px] text-white" />
      <Sparkle size={14} {...sparkle} className="pointer-events-none absolute right-[15px] top-[57px] text-white opacity-90" />
      <Sparkle size={12} {...sparkle} className="pointer-events-none absolute bottom-[29px] right-[83px] text-white opacity-90" />
      <div className="relative flex items-center gap-2.5">
        <IconChip icon={Quote} size={32} className="bg-canvas" />
        <p className="text-[13px] font-semibold leading-normal text-ink-soft">Pesan untukmu hari ini</p>
      </div>
      <p className="display relative mt-3.5 text-[30px] italic leading-[1.3] text-sky-900">“{text}”</p>
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

export function Journey({ tickets, el, joinedAt }: { tickets: Ticket[]; el?: Eligibility; joinedAt: string }) {
  const done = tickets.filter((t) => t.status === 'completed' || t.status === 'awaiting_report');
  const last = [...done].sort((a, b) => (a.scheduledStart < b.scheduledStart ? 1 : -1))[0];
  const quota = el ? Math.min(1, el.yearCount / Math.max(1, el.maxPerYear)) : 0;

  if (tickets.length === 0) {
    return (
      <section className="card card-pad shadow-soft">
        <div className="flex items-center gap-3.5">
          <IconChip icon={Route} />
          <h2 className={cardTitle}>Pertama kali di sini? Begini caranya</h2>
        </div>
        <ol className="mt-5 grid gap-5 sm:grid-cols-2">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-50 font-brand text-[16px] font-bold text-brand">{i + 1}</span>
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
    <section className="card card-pad shadow-soft">
      <div className="flex items-center gap-3.5">
        <IconChip icon={Route} />
        <div className="min-w-0 flex-1">
          <h2 className={cardTitle}>Perjalananmu</h2>
          {done.length > 0 && (
            <p className="mt-0.5 text-[13px] leading-normal text-ink-soft">
              Kamu sudah <b className="text-ink">{done.length} kali</b> berani bercerita. Itu bukan hal kecil.
            </p>
          )}
        </div>
        <Link to="/pendaftaran" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-brand">
          Semua pendaftaran <ArrowRight size={14} strokeWidth={2} absoluteStrokeWidth />
        </Link>
      </div>

      <div className="mt-[18px] space-y-4">
        <dl className="flex flex-col gap-4 rounded-2xl border border-sky-100 bg-sky-50 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
          <div className="min-w-0 flex-1">
            <dt className="text-[12px] font-semibold text-ink-faint">Sesi tahun ini</dt>
            <dd className="mt-1 font-brand text-[22px] font-bold leading-none">
              {el?.yearCount ?? 0}
              <span className="text-[14px] font-semibold text-ink-faint"> / {el?.maxPerYear ?? '–'}</span>
            </dd>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${quota * 100}%` }} />
            </div>
          </div>
          <div className="hidden h-[52px] w-px shrink-0 bg-sky-200 sm:block" aria-hidden />
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <IconChip icon={Calendar} size={40} className="bg-white" />
            <div>
              <dt className="text-[12px] font-semibold text-ink-faint">Bersama sejak</dt>
              <dd className="mt-0.5 font-brand text-[18px] font-bold leading-tight">{fmtDate(joinedAt, 'MMMM yyyy')}</dd>
            </div>
          </div>
        </dl>
        {last && (
          <Link to={`/pendaftaran/${last.id}`} className="flex items-center gap-3 rounded-2xl border border-line p-3.5 transition-colors hover:bg-canvas">
            <Avatar name={last.psychologist.name} src={last.psychologist.avatarUrl} tone={last.psychologist.avatarTone} size={43} shape="rounded" />
            <div className="min-w-0 flex-1 font-semibold">
              <p className="text-[12px] text-ink-faint">Sesi terakhir · {fmtDate(last.scheduledStart, 'd MMMM yyyy')}</p>
              <p className="truncate text-[14px] leading-normal">{fullPsychName(last.psychologist)}</p>
            </div>
            <ArrowRight size={16} strokeWidth={2} absoluteStrokeWidth className="shrink-0 text-ink-faint" />
          </Link>
        )}
      </div>
    </section>
  );
}

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import type { User } from '@/lib/types';
import { firstName } from '@/lib/format';

const MIN_MS = 2400; // cukup untuk menikmati animasi & memuat halaman di belakangnya
const EXIT_MS = 520;

const LINES: Record<string, string[]> = {
  employee: ['Menyiapkan ruang ceritamu…', 'Menyeduh teh hangat…', 'Merapikan bantal sofa…', 'Hampir siap, tarik napas dulu…'],
  psychologist: ['Menyiapkan jadwal hari ini…', 'Merapikan catatan sesi…', 'Menyeduh kopi pagi…', 'Hampir siap…'],
  admin: ['Mengumpulkan kabar terbaru…', 'Merapikan jadwal sesi…', 'Menghitung statistik…', 'Hampir siap…'],
};

interface SplashState {
  name: string;
  role: User['role'];
  greeting: string;
}

const Ctx = createContext<{ show: (u: User, greeting?: string) => void } | null>(null);

export function useWelcomeSplash() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useWelcomeSplash di luar WelcomeSplashProvider');
  return c;
}

export function WelcomeSplashProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SplashState | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<number[]>([]);

  const show = useCallback((u: User, greeting = 'Halo') => {
    timers.current.forEach(clearTimeout);
    setLeaving(false);
    setState({ name: firstName(u.name), role: u.role, greeting });
    timers.current = [
      window.setTimeout(() => setLeaving(true), MIN_MS),
      window.setTimeout(() => setState(null), MIN_MS + EXIT_MS),
    ];
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {state && createPortal(<Splash {...state} leaving={leaving} />, document.body)}
    </Ctx.Provider>
  );
}

function Splash({ name, role, greeting, leaving }: SplashState & { leaving: boolean }) {
  const lines = LINES[role] ?? LINES.employee;
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((x) => (x + 1) % lines.length), 900);
    return () => clearInterval(t);
  }, [lines.length]);

  return (
    <div
      className={clsx(
        'grain fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-sky-100 via-sky-50 to-haze px-6 text-center',
        leaving ? 'tc-splash-out' : 'tc-splash-in',
      )}
      role="status"
      aria-live="polite"
    >
      {/* Langit: matahari lembut, awan berarak, kilau bintang */}
      <div className="tc-glow pointer-events-none absolute left-1/2 top-[18%] h-64 w-64 -translate-x-1/2 rounded-full bg-sun-100/80 blur-3xl" />
      <SmallCloud className="tc-drift-a absolute left-[-60px] top-[14%] w-40 opacity-80" />
      <SmallCloud className="tc-drift-b absolute right-[-50px] top-[30%] w-28 opacity-70" />
      <SmallCloud className="tc-drift-a absolute bottom-[12%] left-[8%] w-24 opacity-60 [animation-delay:-3s]" />
      {[
        ['left-[18%] top-[22%]', '0s'],
        ['right-[20%] top-[16%]', '.6s'],
        ['left-[26%] bottom-[26%]', '1.1s'],
        ['right-[14%] bottom-[30%]', '.3s'],
      ].map(([pos, delay]) => (
        <Sparkle key={pos} className={clsx('tc-twinkle absolute h-4 w-4 text-sun-500', pos)} style={{ animationDelay: delay }} />
      ))}

      <div className="relative">
        <Mascot />
      </div>

      <h1 className="tc-rise mt-8 text-[22px] font-semibold text-sky-900" style={{ animationDelay: '.15s' }}>
        {greeting},{' '}
        <span className="display text-[44px] italic leading-none text-sky-700">{name}!</span>
      </h1>
      <p key={i} className="tc-line mt-3 h-6 text-[15px] text-ink-soft">
        {lines[i]}
      </p>

      <div className="mt-8 h-1.5 w-44 overflow-hidden rounded-full bg-white/70">
        <div className="tc-fill h-full rounded-full bg-gradient-to-r from-sky-400 to-mint-500" style={{ animationDuration: `${MIN_MS}ms` }} />
      </div>
    </div>
  );
}

/** Maskot awan Teman Cerita: memantul pelan, berkedip, pipi merona, sedang "mengetik". */
function Mascot() {
  return (
    <div className="tc-pop relative h-[150px] w-[190px]">
      {/* bayangan */}
      <div className="tc-shadow absolute bottom-0 left-1/2 h-3 w-28 -translate-x-1/2 rounded-full bg-sky-900/10 blur-[2px]" />
      <div className="absolute left-1/2 top-4 w-[150px] -translate-x-[58%]">
      <svg viewBox="0 0 48 40" className="tc-bob w-full drop-shadow-[0_14px_18px_rgba(15,92,138,.18)]" aria-hidden>
        <path
          d="M13 33c-5.5 0-9-3.9-9-8.6 0-4.3 3.1-7.8 7.3-8.5C12.4 9.8 17.3 5.5 23.2 5.5c5 0 9.3 3.1 11 7.6.8-.2 1.6-.3 2.5-.3 5.5 0 9.8 4.5 9.8 10s-4.3 10.1-9.8 10.1H19l-6.8 5.1c-.7.5-1.7-.2-1.4-1L13 33z"
          fill="#2BA9EF"
        />
        <path d="M14 15.5c1.4-4 5-6.6 9.2-6.6" stroke="#fff" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* pipi */}
        <ellipse cx="17.2" cy="25.6" rx="2.3" ry="1.3" fill="#FFB4C6" opacity=".85" />
        <ellipse cx="34.8" cy="25.6" rx="2.3" ry="1.3" fill="#FFB4C6" opacity=".85" />
        {/* mata */}
        <g className="tc-blink">
          <ellipse cx="21" cy="21.6" rx="1.9" ry="2.3" fill="#fff" />
          <ellipse cx="31" cy="21.6" rx="1.9" ry="2.3" fill="#fff" />
          <circle cx="21.5" cy="21" r=".6" fill="#0B6FA9" />
          <circle cx="31.5" cy="21" r=".6" fill="#0B6FA9" />
        </g>
        {/* senyum */}
        <path d="M24 25.4c1.1 1.2 2.9 1.2 4 0" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      </svg>
      </div>

      {/* gelembung mengetik */}
      <div className="tc-bubble absolute -right-3 top-0 flex h-9 items-center gap-1 rounded-2xl rounded-bl-md bg-white px-3 shadow-pop">
        {[0, 1, 2].map((d) => (
          <span key={d} className="tc-dot h-1.5 w-1.5 rounded-full bg-sky-400" style={{ animationDelay: `${d * 0.16}s` }} />
        ))}
      </div>

      {/* hati melayang */}
      {[
        ['right-6', '0.9s', 'text-[#FF8FAB]', 14],
        ['right-12', '1.5s', 'text-sun-500', 11],
        ['right-1', '2.0s', 'text-[#FF8FAB]', 10],
      ].map(([pos, delay, color, s]) => (
        <Heart key={delay as string} className={clsx('tc-heart absolute top-2', pos as string, color as string)} size={s as number} style={{ animationDelay: delay as string }} />
      ))}
    </div>
  );
}

function SmallCloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" className={clsx('pointer-events-none', className)} aria-hidden>
      <path d="M22 52c-11 0-19-7-19-17 0-9 7-16 16-17 3-11 13-18 25-18 10 0 18 5 22 13 2-1 5-1 7-1 13 0 23 9 23 21s-10 19-23 19H22z" fill="#fff" />
    </svg>
  );
}

function Sparkle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 16 16" className={clsx('pointer-events-none', className)} style={style} aria-hidden>
      <path d="M8 0c.6 4.4 3.6 7.4 8 8-4.4.6-7.4 3.6-8 8-.6-4.4-3.6-7.4-8-8 4.4-.6 7.4-3.6 8-8z" fill="currentColor" />
    </svg>
  );
}

function Heart({ className, size, style }: { className?: string; size: number; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={clsx('pointer-events-none', className)} style={style} aria-hidden>
      <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.6.1.2.3.2.4 0 .7-1.4 2.2-2.6 4.3-2.6 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill="currentColor" />
    </svg>
  );
}

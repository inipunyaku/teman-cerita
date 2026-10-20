import type { ReactNode } from 'react';
import clsx from 'clsx';
import illustrationAvif from '@/assets/auth/login-illustration.avif';
import illustrationWebp from '@/assets/auth/login-illustration.webp';
import glowLangit from '@/assets/auth/glow-langit.svg';
import glowFajar from '@/assets/auth/glow-fajar.svg';

/** Mengikuti frame Figma "Login — Desktop (1440) — Dreamy Redesign". */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[740fr_700fr]">
      <aside className="relative hidden overflow-hidden lg:block lg:p-12">
        <Scene />
        {/* Selubung putih agar judul tetap terbaca di atas ilustrasi */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-gradient-to-b from-white/55 to-white/0" />
        <div className="relative -ml-3 mt-[89px] max-w-[448px]">
          <p className="display text-[56px] text-sky-900">
            Nggak semua hal
            <br />
            harus kamu
            <br />
            <span className="italic text-sky-600">pikul sendiri.</span>
          </p>
          <p className="mt-6 text-[15px] leading-[1.62] text-ink-soft">
            Perasaanmu berarti. Ceritamu berharga.
            <br />
            Mulai langkah kecil untuk memahami dirimu bersama psikolog profesional teman cerita.
          </p>
        </div>
      </aside>

      {/* Pengganti panel ilustrasi di layar kecil; formulir menimpanya seperti "sheet". */}
      <header className="relative h-[250px] overflow-hidden sm:h-[340px] lg:hidden">
        <Scene className="object-[center_70%]" />
      </header>

      <main className="relative -mt-7 flex flex-col items-center overflow-hidden rounded-t-[28px] bg-canvas px-4 pb-8 pt-9 sm:px-10 sm:pt-12 lg:mt-0 lg:justify-center lg:rounded-none lg:px-16 lg:py-8">
        {/* Glow — langit (kanan atas) & fajar (kiri bawah); blur 45px sudah ada di SVG. */}
        <img src={glowLangit} alt="" width={600} height={600} className="pointer-events-none absolute -right-[250px] -top-[230px] max-w-none" />
        <img src={glowFajar} alt="" width={540} height={540} className="pointer-events-none absolute -bottom-[190px] -left-[210px] max-w-none" />
        <div className="relative w-full max-w-[500px] rounded-[32px] border border-white/90 bg-white/50 p-6 backdrop-blur-[14px] sm:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}

function Scene({ className }: { className?: string }) {
  // AVIF (±150 KB) untuk browser modern; WebP sebagai cadangan.
  return (
    <picture>
      <source srcSet={illustrationAvif} type="image/avif" />
      <img src={illustrationWebp} alt="" aria-hidden width={928} height={1152} className={clsx('pointer-events-none absolute inset-0 h-full w-full object-cover', className)} />
    </picture>
  );
}

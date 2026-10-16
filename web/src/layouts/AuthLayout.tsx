import type { ReactNode } from 'react';
import { Clouds, Logo } from '@/components/ui';
import illustration from '@/assets/auth/login-illustration.png';
import glowLangit from '@/assets/auth/glow-langit.svg';
import glowFajar from '@/assets/auth/glow-fajar.svg';

type Variant = 'default' | 'dreamy';

export function AuthLayout({ children, variant = 'default' }: { children: ReactNode; variant?: Variant }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {variant === 'dreamy' ? <DreamyAside /> : <DefaultAside />}
      <main className="relative flex flex-col overflow-hidden px-4 py-8 sm:px-10 lg:justify-center lg:px-16">
        {variant === 'dreamy' && (
          <>
            {/* Glow — langit (kanan atas) & fajar (kiri bawah); blur 45px sudah ada di SVG. */}
            <img src={glowLangit} alt="" width={600} height={600} className="pointer-events-none absolute -right-[250px] -top-[230px] max-w-none" />
            <img src={glowFajar} alt="" width={540} height={540} className="pointer-events-none absolute -bottom-[190px] -left-[210px] max-w-none" />
          </>
        )}
        <div className="relative mb-10 lg:hidden">
          <Logo />
        </div>
        <div className="relative mx-auto w-full max-w-[420px]">{children}</div>
      </main>
    </div>
  );
}

function DreamyAside() {
  return (
    <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:p-12">
      <img src={illustration} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      {/* Veil agar judul tetap terbaca di atas ilustrasi */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-gradient-to-b from-white/55 to-white/0" />
      <Logo size="lg" className="relative" />
      <div className="relative -ml-3 mt-[43px] max-w-[448px]">
        <p className="display text-[56px] tracking-[-0.01em] text-sky-900">
          Nggak semua hal
          <br />
          harus kamu <span className="italic text-sky-600">pikul sendiri.</span>
        </p>
        <p className="mt-6 max-w-[384px] text-[15px] leading-[1.62] text-ink-soft">
          Perasaanmu berarti. Ceritamu berharga.
          <br />
          Mulai langkah kecil untuk memahami dirimu bersama psikolog profesional.
        </p>
      </div>
    </aside>
  );
}

function DefaultAside() {
  return (
    <aside className="grain relative hidden overflow-hidden bg-gradient-to-b from-sky-100 via-sky-50 to-haze lg:flex lg:flex-col lg:justify-between lg:p-12">
      <Logo size="lg" />
      <div className="relative z-10 max-w-md">
        <p className="display text-[56px] text-sky-900">
          Nggak semua hal
          <br />
          harus kamu <span className="italic text-sky-600">pikul sendiri.</span>
        </p>
        <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-ink-soft">
          Teman Cerita menghubungkanmu dengan psikolog lewat chat, online meeting, atau tatap muka. Ceritamu hanya dibaca
          psikolog yang mendampingimu.
        </p>
      </div>
      <div className="relative z-10 flex items-center gap-6 text-[13px] text-ink-soft">
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-mint-500" /> Rahasia</span>
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-500" /> Psikolog berlisensi</span>
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sun-500" /> Tanpa biaya</span>
      </div>
      <Clouds className="pointer-events-none absolute -right-24 bottom-16 w-[620px] animate-drift opacity-90" />
      <Clouds className="pointer-events-none absolute -left-40 top-24 w-[420px] opacity-60 [animation-delay:-6s] animate-drift" />
      <div className="pointer-events-none absolute right-20 top-20 h-28 w-28 rounded-full bg-sun-100/70 blur-2xl" />
    </aside>
  );
}

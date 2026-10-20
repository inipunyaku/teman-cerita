import { useEffect, useId, useState } from 'react';
import clsx from 'clsx';
import markSrc from '@/assets/brand/mark.webp';
import wordmarkSrc from '@/assets/brand/wordmark.webp';
import lettersSrc from '@/assets/brand/letters.webp';
import stickerSrc from '@/assets/brand/sticker.webp';
import { LETTERS, SHEET, STICKER } from './brand-letters';

/** Warna yang diambil langsung dari logo-teman-cerita.png. */
export const BRAND = {
  dark: '#014AB2', // huruf & garis wajah
  bubble: '#0150C1',
  mid: '#257CF3', // karakter tengah, huruf R
  light: '#4EC3F4', // huruf I & N
  face: '#6ED5FD', // karakter kiri & kanan
  outline: '#0F5BD6',
} as const;

// ---------------------------------------------------------------------------
// Logo statis (gambar dari aset)

/** Gelembung chat + tiga karakter, tanpa tulisan. Rasio ±1.53 : 1 — atur tingginya saja. */
export function LogoMark({ className = 'h-8' }: { className?: string }) {
  return <img src={markSrc} alt="" aria-hidden draggable={false} className={clsx('w-auto select-none object-contain', className)} />;
}

/** Tulisan "TEMAN CERITA / BRILiaN" — dipotong langsung dari PNG logo, jadi hurufnya persis sama. */
export function Wordmark({ className = 'h-9' }: { className?: string }) {
  return <img src={wordmarkSrc} alt="" aria-hidden draggable={false} className={clsx('w-auto select-none object-contain', className)} />;
}

export function Logo({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)} aria-label="Teman Cerita BRILiaN">
      <LogoMark className={size === 'lg' ? 'h-11' : 'h-8'} />
      <Wordmark className={size === 'lg' ? 'h-12' : 'h-9'} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Logo animasi — digambar ulang sebagai SVG (koordinat mengikuti PNG asli 1254×1254)
// supaya tiap bagian bisa bergerak: tangan dadah, mata melirik & berkedip, huruf bergoyang.
// Stiker & huruf memakai potongan PNG aslinya (scripts/brand-assets.py), jadi bentuknya sama persis.

const FONT = "'Fredoka Variable', Fredoka, 'Baloo 2', system-ui, sans-serif";

type Variant = 'full' | 'peek';

const VIEWBOX: Record<Variant, string> = {
  full: '96 180 1096 960',
  peek: '212 206 846 534',
};

export function AnimatedLogo({
  className,
  variant = 'full',
  sleepy = false,
  title = 'Teman Cerita BRILiaN',
}: {
  className?: string;
  /** full = logo stiker lengkap; peek = karakter saja, "mengintip" dari tepi bawah. */
  variant?: Variant;
  /** Mode malam: mata terpejam, tidak melambai, ada "z z". */
  sleepy?: boolean;
  title?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const full = variant === 'full';
  const id = (k: string) => `${k}-${uid}`;
  const D = BRAND.dark;
  const line = { stroke: D, strokeWidth: 13, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const closedEye = (d: string, delay: string) => (
    <path d={d} {...line} className={sleepy ? undefined : 'lg-happy'} style={{ animationDelay: delay }} />
  );

  return (
    <svg viewBox={VIEWBOX[variant]} className={clsx('lg-root overflow-visible', sleepy && 'lg-sleepy', className)} role="img" aria-label={title}>
      <defs>
        <clipPath id={id('cut')}>
          <rect x="0" y="0" width="1400" height={full ? 748 : 740} />
        </clipPath>
      </defs>

      {full && <image href={stickerSrc} x={STICKER.x} y={STICKER.y} width={STICKER.w} height={STICKER.h} aria-hidden />}

      <g clipPath={`url(#${id('cut')})`}>
        {/* Karakter kiri */}
        <g className="lg-bob" style={{ animationDelay: '-.2s' }}>
          <circle cx="384" cy="570" r="156" fill={BRAND.face} />
          {closedEye('M309 537C312 562 350 566 355 523', '0s')}
          {closedEye('M398 508C402 537 446 540 447 497', '.06s')}
          <path d="M361 578C372 600 410 600 418 563" {...line} />
          <path d="M362 638C388 650 404 626 432 621C458 616 476 630 486 650" {...line} />
        </g>

        {/* Karakter kanan — matanya melirik & berkedip */}
        <g className="lg-bob" style={{ animationDelay: '-1.1s' }}>
          <circle cx="884" cy="582" r="152" fill={BRAND.face} />
          <circle cx="1002" cy="660" r="34" fill={BRAND.face} />
          {sleepy ? (
            <>
              <path d="M815 532C820 552 848 554 853 534" {...line} />
              <path d="M893 562C898 582 926 584 931 564" {...line} />
            </>
          ) : (
            <g className="lg-look">
              <g className="lg-blink">
                <circle cx="835" cy="529" r="21" fill={D} />
                <circle cx="914" cy="559" r="21" fill={D} />
              </g>
            </g>
          )}
          <path d="M830 576C836 612 870 618 892 597" {...line} />
          <path d="M915 672C930 640 965 618 1010 626" {...line} className={sleepy ? undefined : 'lg-hug'} />
        </g>

        {/* Gelembung chat — titik-titik "sedang mengetik" */}
        <g className="lg-float">
          <ellipse cx="653" cy="338" rx="198" ry="112" fill={BRAND.bubble} />
          <path d="M548 420L545 484L612 446Z" fill={BRAND.bubble} stroke={BRAND.bubble} strokeWidth="14" strokeLinejoin="round" />
          {[560, 653, 746].map((cx, i) => (
            <circle key={cx} cx={cx} cy="342" r="27" fill="#fff" className="lg-dot" style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </g>
        {sleepy && (
          <g fontFamily={FONT} fontWeight={700} fill="#fff" aria-hidden>
            {[0, 1, 2].map((i) => (
              <text key={i} x={860 + i * 34} y={250 - i * 30} fontSize={44 + i * 10} className="lg-zzz" style={{ animationDelay: `${i * 0.7}s` }}>z</text>
            ))}
          </g>
        )}

        {/* Karakter tengah — melambai "dadah" dengan tangan kanannya */}
        <g className="lg-bob lg-bob-lg" style={{ animationDelay: '-.6s' }}>
          <circle cx="633" cy="642" r="157" fill={BRAND.mid} />
          {closedEye('M565 600C568 630 612 632 617 592', '.12s')}
          {closedEye('M655 588C660 620 702 620 705 580', '.18s')}
          <path d="M610 645C618 672 662 674 670 645" {...line} className={sleepy ? undefined : 'lg-chat'} />
        </g>
        <g>
          <circle cx="509" cy="704" r="44" fill={BRAND.mid} />
          <path d="M490 657C522 646 556 660 564 690C567 705 565 716 562 724" {...line} />
        </g>
        <g className={sleepy ? undefined : 'lg-wave'}>
          <circle cx="769" cy="704" r="44" fill={BRAND.mid} />
          <path d="M797 662C760 646 726 660 716 690C713 705 716 716 720 724" {...line} />
        </g>
      </g>

      {full &&
        LETTERS.map((l, i) => (
          // TEMAN CERITA naik-turun seperti ombak; BRILiaN bergoyang kenyal.
          <g
            key={i}
            className={l.ch === 'splash' ? 'lg-splash' : l.row === 't' ? 'lg-wavy' : 'lg-jelly'}
            style={{
              animationDelay: `${l.row === 't' ? i * 0.08 : (i - 11) * 0.12}s`,
              // Titik pusat eksplisit (kaki huruf); fill-box tidak andal untuk <svg> bersarang.
              transformBox: 'view-box',
              transformOrigin: `${l.ch === 'splash' ? l.x : l.x + l.w / 2}px ${l.y + l.h}px`,
            }}
          >
            <svg x={l.x} y={l.y} width={l.w} height={l.h} viewBox={`${l.sx} ${l.sy} ${l.sw} ${l.sh}`} preserveAspectRatio="none">
              <image href={lettersSrc} width={SHEET.w} height={SHEET.h} />
            </svg>
          </g>
        ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Loader layar penuh

const LOADER_LINES = ['Menyiapkan ruang ceritamu', 'Menyapa teman-teman', 'Merapikan bantal sofa', 'Hampir siap'];

export function BrandLoader({ label }: { label?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (label) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % LOADER_LINES.length), 1400);
    return () => clearInterval(t);
  }, [label]);

  return (
    <div
      role="status"
      aria-live="polite"
      // Muncul setelah jeda singkat supaya pemuatan yang cepat tidak berkedip.
      className="lg-loader fixed inset-0 z-[90] flex flex-col items-center justify-center bg-gradient-to-b from-sky-50 via-white to-[#EEF7FF] px-6"
    >
      <AnimatedLogo className="w-[min(70vw,300px)]" />
      <p key={label ?? i} className="tc-line mt-6 font-brand text-[16px] font-medium text-sky-900/80">
        {label ?? LOADER_LINES[i]}
        <span className="lg-ellipsis" aria-hidden />
      </p>
    </div>
  );
}

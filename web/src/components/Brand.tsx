import { useEffect, useId, useState, type CSSProperties } from 'react';
import clsx from 'clsx';
import markSrc from '@/assets/brand/mark.png';

/** Warna yang diambil langsung dari logo-teman-cerita.png. */
export const BRAND = {
  dark: '#014AB2', // huruf & garis wajah
  bubble: '#0150C1',
  mid: '#257CF3', // karakter tengah, huruf R
  light: '#4EC3F4', // huruf I & N
  face: '#6ED5FD', // karakter kiri & kanan
  outline: '#0F5BD6',
} as const;

const BRILIAN: [string, string][] = [
  ['B', BRAND.dark],
  ['R', BRAND.mid],
  ['I', BRAND.light],
  ['L', BRAND.dark],
  ['i', '#3A95F6'],
  ['a', BRAND.dark],
  ['N', BRAND.light],
];

// ---------------------------------------------------------------------------
// Logo statis (gambar dari aset)

/** Gelembung chat + tiga karakter, tanpa tulisan. Rasio ±1.53 : 1 — atur tingginya saja. */
export function LogoMark({ className = 'h-8' }: { className?: string }) {
  return <img src={markSrc} alt="" aria-hidden draggable={false} className={clsx('w-auto select-none object-contain', className)} />;
}

/** Tulisan "TEMAN CERITA / BRILiaN" dengan huruf berwarna seperti logo. */
export function Wordmark({ size = 'md', className }: { size?: 'md' | 'lg'; className?: string }) {
  const lg = size === 'lg';
  return (
    <span className={clsx('inline-flex flex-col font-brand font-bold leading-none', className)}>
      <span className={clsx('tracking-[.07em]', lg ? 'text-[12.5px]' : 'text-[10px]')} style={{ color: BRAND.dark }}>
        TEMAN CERITA
      </span>
      <span className={clsx('-mt-px tracking-[.01em]', lg ? 'text-[25px]' : 'text-[19px]')}>
        {BRILIAN.map(([ch, color], i) => (
          <span key={i} style={{ color }}>{ch}</span>
        ))}
      </span>
    </span>
  );
}

export function Logo({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)} aria-label="Teman Cerita BRILiaN">
      <LogoMark className={size === 'lg' ? 'h-11' : 'h-8'} />
      <Wordmark size={size} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Logo animasi — digambar ulang sebagai SVG (koordinat mengikuti PNG asli 1254×1254)
// supaya tiap bagian bisa bergerak: tangan dadah, mata melirik & berkedip, huruf bergoyang.

// Lebar huruf Fredoka Bold per 1000 unit em, untuk menata huruf satu per satu.
const ADV: Record<string, number> = { T: 640, E: 603, M: 809, A: 711, N: 670, ' ': 235, C: 631, R: 604, I: 239, B: 609, L: 569, i: 251, a: 557 };
function layout(text: string, size: number, startX: number) {
  let x = startX;
  return [...text].map((ch) => {
    const w = (ADV[ch] ?? 600) * (size / 1000);
    const cx = x + w / 2;
    x += w;
    return { ch, cx, w };
  });
}
const TITLE = layout('TEMAN CERITA', 120, 205);
const BIG = layout('BRILiaN', 260, 150);
// Kilau kecil di batang tiap huruf (posisi relatif terhadap lebar huruf).
const GLOSS_X: Record<string, number> = { B: 0.22, R: 0.22, I: 0.45, L: 0.26, i: 0.45, a: 0.27, N: 0.21 };
function gloss(l: { ch: string; cx: number; w: number }) {
  const x = l.cx - l.w / 2 + l.w * (GLOSS_X[l.ch] ?? 0.25);
  const y = l.ch === 'i' ? 1036 : l.ch === 'a' ? 1022 : 962;
  return `M${x} ${y}q-1 -18 5 -32`;
}
const FONT = "'Fredoka Variable', Fredoka, 'Baloo 2', system-ui, sans-serif";

type Variant = 'full' | 'peek';

const VIEWBOX: Record<Variant, string> = {
  full: '112 188 1080 930',
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
        {/* Stiker: siluet diburamkan lalu dipotong ambang → tepi putih membulat + garis biru tipis. */}
        <filter id={id('stk')} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="30" result="b" />
          <feComponentTransfer in="b" result="outer"><feFuncA type="linear" slope="60" intercept="-7.6" /></feComponentTransfer>
          <feComponentTransfer in="b" result="inner"><feFuncA type="linear" slope="60" intercept="-12" /></feComponentTransfer>
          <feFlood floodColor={BRAND.outline} /><feComposite in2="outer" operator="in" result="o" />
          <feFlood floodColor="#fff" /><feComposite in2="inner" operator="in" result="w" />
          <feMerge><feMergeNode in="o" /><feMergeNode in="w" /></feMerge>
        </filter>
        <clipPath id={id('cut')}>
          <rect x="0" y="0" width="1400" height={full ? 748 : 740} />
        </clipPath>
        {BIG.map((l, i) => (
          <clipPath key={i} id={id(`g${i}`)}>
            <text x={l.cx} y={1075} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={260}>{l.ch}</text>
          </clipPath>
        ))}
      </defs>

      {full && (
        <g filter={`url(#${id('stk')})`} aria-hidden>
          {/* Siluet padat (bukan huruf saja) supaya stiker tidak berlubang di sela huruf. */}
          <ellipse cx="653" cy="338" rx="198" ry="112" />
          <circle cx="384" cy="570" r="156" />
          <circle cx="884" cy="582" r="152" />
          <circle cx="633" cy="642" r="157" />
          <circle cx="1002" cy="660" r="34" />
          <rect x="300" y="600" width="680" height="150" rx="60" />
          <rect x="214" y="770" width="836" height="74" rx="30" />
          <rect x="160" y="902" width="890" height="168" rx="50" />
          <text x="632" y="850" textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={120} letterSpacing="-1">TEMAN CERITA</text>
          {BIG.map((l, i) => (
            <text key={i} x={l.cx} y={1075} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={260}>{l.ch}</text>
          ))}
          <circle cx="1124" cy="940" r="40" />
        </g>
      )}

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

      {full && (
        <g fontFamily={FONT} fontWeight={700}>
          {/* TEMAN CERITA — huruf naik-turun bergantian seperti ombak */}
          {TITLE.map((l, i) =>
            l.ch === ' ' ? null : (
              <text key={i} x={l.cx} y={850} textAnchor="middle" fontSize={120} fill={D} className="lg-wavy" style={{ animationDelay: `${i * 0.08}s` }}>
                {l.ch}
              </text>
            ),
          )}
          {/* BRILiaN — tiap huruf bergoyang kenyal */}
          {BIG.map((l, i) => (
            <g key={i} className="lg-jelly" style={{ animationDelay: `${i * 0.12}s` } as CSSProperties}>
              <text x={l.cx} y={1075} textAnchor="middle" fontSize={260} fill={BRILIAN[i][1]}>{l.ch}</text>
              <path
                clipPath={`url(#${id(`g${i}`)})`}
                d={gloss(l)}
                stroke="#fff"
                strokeOpacity=".85"
                strokeWidth="13"
                strokeLinecap="round"
                fill="none"
              />
            </g>
          ))}
          <g className="lg-splash" stroke={BRAND.light} strokeLinecap="round">
            <path d="M1092 934L1112 896" strokeWidth="20" />
            <path d="M1124 974L1140 964" strokeWidth="28" />
          </g>
        </g>
      )}
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

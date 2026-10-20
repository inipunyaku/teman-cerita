import type { CSSProperties, ReactNode } from 'react';
import clsx from 'clsx';
import sky from '@/assets/home/hero/sky.webp';
import sunGlow from '@/assets/home/hero/sunGlow.webp';
import sunRays from '@/assets/home/hero/sunRays.webp';
import cloudTop from '@/assets/home/hero/cloudTop.webp';
import cloudRight from '@/assets/home/hero/cloudRight.webp';
import cloudLeft from '@/assets/home/hero/cloudLeft.webp';
import cloudSmall from '@/assets/home/hero/cloudSmall.webp';
import right from '@/assets/home/hero/right.webp';
import eyeR1 from '@/assets/home/hero/eyeR1.webp';
import eyeR2 from '@/assets/home/hero/eyeR2.webp';
import left from '@/assets/home/hero/left.webp';
import handL from '@/assets/home/hero/handL.webp';
import center from '@/assets/home/hero/center.webp';
import armR from '@/assets/home/hero/armR.webp';
import plantL from '@/assets/home/hero/plantL.webp';
import plantR from '@/assets/home/hero/plantR.webp';
import bubble from '@/assets/home/hero/bubble.webp';
import dot1 from '@/assets/home/hero/dot1.webp';
import dot2 from '@/assets/home/hero/dot2.webp';
import dot3 from '@/assets/home/hero/dot3.webp';
import leaf1 from '@/assets/home/hero/leaf1.webp';
import leaf2 from '@/assets/home/hero/leaf2.webp';

// Ilustrasi 3D hero (hero-3d.png, 1376×768) yang dipotong per bagian supaya bisa bergerak.
// Kotak = [x, y, lebar, tinggi] dalam piksel ilustrasi asli; bagian yang tertutup sudah diisi
// sehingga gerakan tidak memperlihatkan celah. Dalam posisi diam hasilnya sama dengan gambar aslinya.
type Box = readonly [number, number, number, number];
type Point = readonly [number, number];

const VW = 1376, VH = 768;
const SCENE: Box = [0, 0, VW, VH];
const SUN: Point = [1157, 187];
const BOX = {
  left: [347, 448, 327, 384],
  hand: [392, 666, 101, 87],
  center: [595, 415, 466, 417],
  right: [979, 437, 320, 395],
  arm: [992, 609, 208, 85],
  bubble: [475, 185, 255, 238],
} as const satisfies Record<string, Box>;
// Titik poros: kaki tiap karakter, pergelangan tangan kiri, bahu kanan.
const FOOT = { left: [515, 800], center: [840, 800], right: [1140, 800] } as const satisfies Record<string, Point>;

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/** Posisi + poros sebuah kotak di dalam kotak induknya, dalam persen (ikut skala ilustrasi). */
function place([x, y, w, h]: Box, parent: Box = SCENE, origin?: Point): CSSProperties {
  const [px, py, pw, ph] = parent;
  return {
    left: pct(x - px, pw),
    top: pct(y - py, ph),
    width: pct(w, pw),
    height: pct(h, ph),
    transformOrigin: origin && `${pct(origin[0] - x, w)} ${pct(origin[1] - y, h)}`,
  };
}

function Layer({ src, box, parent, origin, className, style }: { src: string; box: Box; parent?: Box; origin?: Point; className?: string; style?: CSSProperties }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      className={clsx('absolute max-w-none select-none', className)}
      style={{ ...place(box, parent, origin), ...style }}
    />
  );
}

function Group({ box, origin, className, style, children }: { box: Box; origin?: Point; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={clsx('absolute', className)} style={{ ...place(box, SCENE, origin), ...style }}>
      {children}
    </div>
  );
}

const vars = (v: Record<string, string | number>) => v as CSSProperties;

/** Burung siluet kecil yang mengepakkan sayap (menghadap kanan). */
function Bird() {
  return (
    <svg viewBox="0 0 64 44" className="hs-bird-bob block h-auto w-full overflow-visible">
      <g fill="#1F4A7A">
        <path className="hs-flap" d="M20 25C17 13 23 5 32 5 31 13 29 20 28 27Z" opacity=".55" style={{ animationDelay: '-.08s' }} />
        <path d="M16 25 5 19l3 10Z" />
        <ellipse cx="30" cy="27" rx="15" ry="11" />
        <circle cx="45" cy="20" r="8.5" />
        <path d="m52.5 18.4 6.5 2.6-6.5 2.6Z" fill="#F2B544" />
        <path className="hs-flap" d="M24 25C22 11 30 3 40 4c-2 8-5 15-8 22Z" />
      </g>
      <circle cx="47.6" cy="18.4" r="1.9" fill="#fff" />
    </svg>
  );
}

// Garis angin (koordinat ilustrasi) — muncul saat hembusan, bersamaan dengan daun yang terbang.
// Semua lewat langit kosong supaya tidak menyilang wajah karakter.
const WIND = [
  'M-40 372C150 342 300 405 440 372c40-9 52-40 28-48-18-6-30 12-14 22',
  'M150 178C300 146 420 204 600 168',
  'M740 318C880 290 990 350 1150 312c38-10 46-40 22-46-17-4-27 14-11 22',
  'M880 96C1000 72 1090 118 1240 92',
];

// Daun yang terbawa angin: titik awal (koordinat ilustrasi) + jalur dalam satuan wadah.
const LEAVES = [
  { src: leaf2, at: [300, 600], s: 0.8, delay: 0, path: { '--x1': '16cqw', '--y1': '-16cqh', '--x2': '34cqw', '--y2': '-8cqh', '--x3': '66cqw', '--y3': '-22cqh' } },
  { src: leaf1, at: [250, 690], s: 0.6, delay: 0.35, path: { '--x1': '20cqw', '--y1': '-6cqh', '--x2': '42cqw', '--y2': '-20cqh', '--x3': '74cqw', '--y3': '-12cqh' } },
  { src: leaf1, at: [1300, 600], s: 0.7, delay: 0.2, path: { '--x1': '7cqw', '--y1': '-10cqh', '--x2': '13cqw', '--y2': '-4cqh', '--x3': '22cqw', '--y3': '-14cqh' } },
  { src: leaf2, at: [-40, 260], s: 0.55, delay: 0.5, path: { '--x1': '22cqw', '--y1': '6cqh', '--x2': '48cqw', '--y2': '-2cqh', '--x3': '84cqw', '--y3': '8cqh' } },
] as const;

/** Langit, matahari, awan, burung, gelembung chat, dan teman-teman yang menyapa — mengisi wadahnya seperti object-cover. */
export function HeroScene({ className }: { className?: string }) {
  return (
    <div className={clsx('pointer-events-none overflow-hidden [container-type:size]', className)} aria-hidden>
      <div className="absolute left-1/2 top-1/2 aspect-[1376/768] -translate-x-1/2 -translate-y-1/2" style={{ width: 'max(100cqw, calc(100cqh * 1376 / 768))' }}>
        <Layer src={sky} box={SCENE} />

        <Layer src={sunGlow} box={[1008, 38, 299, 299]} origin={SUN} className="hs-breathe" />
        <Layer src={sunRays} box={[1008, 40, 296, 296]} origin={SUN} className="hs-spin" />

        {/* Awan yang melintas penuh dari kiri ke kanan (salinan awan atas) */}
        <Layer src={cloudTop} box={[0, 40, 140, 80]} className="hs-travel" style={vars({ '--o': 0.95, animationDuration: '38s', animationDelay: '-12s' })} />
        <Layer src={cloudTop} box={[0, 250, 96, 55]} className="hs-travel" style={vars({ '--o': 0.75, animationDuration: '54s', animationDelay: '-34s' })} />

        <Layer src={cloudTop} box={[764, 147, 204, 117]} className="hs-drift" style={vars({ '--hs-from': '-14%', '--hs-to': '16%', animationDuration: '12s', animationDelay: '-4s' })} />
        {/* Awan yang terpotong tepi gambar / tertutup karakter hanya bergeser ke arah potongannya. */}
        <Layer src={cloudRight} box={[1209, 307, 167, 143]} className="hs-drift" style={vars({ '--hs-from': '0%', '--hs-to': '14%', animationDuration: '14s', animationDelay: '-9s' })} />
        <Layer src={cloudLeft} box={[0, 397, 141, 144]} className="hs-drift" style={vars({ '--hs-from': '0%', '--hs-to': '-16%', animationDuration: '15s', animationDelay: '-3s' })} />
        <Layer src={cloudSmall} box={[297, 459, 166, 128]} className="hs-drift" style={vars({ '--hs-from': '-6%', '--hs-to': '8%', animationDuration: '10s', animationDelay: '-6s' })} />

        {/* Sepasang burung siluet */}
        <div className="hs-bird absolute" style={{ left: '-6%', top: '13%', width: '5%' }}>
          <Bird />
        </div>
        <div className="hs-bird absolute" style={{ left: '-10%', top: '20%', width: '3.4%', animationDelay: '.9s' }}>
          <Bird />
        </div>

        {/* Karakter kanan (di belakang): bersandar ke tengah lalu menepuk-nepuk, matanya berkedip */}
        <Group box={BOX.right} origin={FOOT.right} className="hs-right">
          <Layer src={right} box={BOX.right} parent={BOX.right} />
          <Layer src={eyeR1} box={[1031, 525, 36, 37]} parent={BOX.right} origin={[1050, 542]} className="hs-blink" />
          <Layer src={eyeR2} box={[1128, 550, 36, 36]} parent={BOX.right} origin={[1146, 567]} className="hs-blink" />
        </Group>
        {/* Karakter kiri: bergoyang sambil melambaikan tangan "hai!" */}
        <Group box={BOX.left} origin={FOOT.left} className="hs-left">
          <Layer src={left} box={BOX.left} parent={BOX.left} />
          <Layer src={handL} box={BOX.hand} parent={BOX.left} origin={[405, 726]} className="hs-wave" />
        </Group>
        {/* Karakter tengah: ancang-ancang lalu melompat kegirangan */}
        <Layer src={center} box={BOX.center} origin={FOOT.center} className="hs-center" />
        {/* Tangan kanan ada di depan karakter tengah — gerakannya sama persis dengan badannya. */}
        <Group box={BOX.arm} origin={FOOT.right} className="hs-right">
          <Layer src={armR} box={BOX.arm} parent={BOX.arm} origin={[1195, 662]} className="hs-pat" />
        </Group>

        {/* Tanaman tertiup angin */}
        <Layer src={plantL} box={[217, 601, 160, 207]} origin={[296, 768]} className="hs-gust" />
        <Layer src={plantR} box={[1235, 591, 141, 217]} origin={[1305, 768]} className="hs-gust" style={{ animationDelay: '.25s' }} />

        <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 h-full w-full overflow-visible">
          <g fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round">
            {WIND.map((d, i) => (
              <path key={d} d={d} pathLength={100} className="hs-wind" style={{ animationDelay: `${i * 0.18}s` }} />
            ))}
          </g>
        </svg>

        <Group box={BOX.bubble} origin={[690, 418]} className="hs-float">
          <Layer src={bubble} box={BOX.bubble} parent={BOX.bubble} />
          {/* Titik "sedang mengetik" */}
          <Layer src={dot1} box={[533, 277, 33, 33]} parent={BOX.bubble} className="hs-dot" />
          <Layer src={dot2} box={[587, 277, 32, 33]} parent={BOX.bubble} className="hs-dot" style={{ animationDelay: '.18s' }} />
          <Layer src={dot3} box={[639, 277, 34, 33]} parent={BOX.bubble} className="hs-dot" style={{ animationDelay: '.36s' }} />
        </Group>

        {LEAVES.map((l, i) => (
          <img
            key={i}
            src={l.src}
            alt=""
            draggable={false}
            className="hs-leaf-fly absolute max-w-none select-none"
            style={vars({ left: pct(l.at[0], VW), top: pct(l.at[1], VH), width: pct(58, VW), '--s': l.s, animationDelay: `${l.delay}s`, ...l.path })}
          />
        ))}
      </div>
    </div>
  );
}

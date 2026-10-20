import type { CSSProperties } from 'react';
import clsx from 'clsx';
import sky from '@/assets/home/hero/sky.webp';
import sunGlow from '@/assets/home/hero/sunGlow.webp';
import sunRays from '@/assets/home/hero/sunRays.webp';
import cloudTop from '@/assets/home/hero/cloudTop.webp';
import cloudRight from '@/assets/home/hero/cloudRight.webp';
import cloudLeft from '@/assets/home/hero/cloudLeft.webp';
import cloudSmall from '@/assets/home/hero/cloudSmall.webp';
import right from '@/assets/home/hero/right.webp';
import left from '@/assets/home/hero/left.webp';
import center from '@/assets/home/hero/center.webp';
import rightArm from '@/assets/home/hero/rightArm.webp';
import plantL from '@/assets/home/hero/plantL.webp';
import plantR from '@/assets/home/hero/plantR.webp';
import bubble from '@/assets/home/hero/bubble.webp';
import dot1 from '@/assets/home/hero/dot1.webp';
import dot2 from '@/assets/home/hero/dot2.webp';
import dot3 from '@/assets/home/hero/dot3.webp';

// Ilustrasi 3D hero (hero-3d.png, 1376×768) yang dipotong per bagian supaya bisa bergerak.
// Kotak = [x, y, lebar, tinggi] dalam piksel ilustrasi asli; bagian yang tertutup sudah diisi
// sehingga gerakan kecil tidak memperlihatkan celah. Dalam posisi diam hasilnya sama dengan gambar aslinya.
type Box = readonly [number, number, number, number];
type Point = readonly [number, number];

const SCENE: Box = [0, 0, 1376, 768];
const BUBBLE: Box = [475, 185, 255, 238];
const SUN: Point = [1157, 187];

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

function Layer({
  src,
  box,
  parent = SCENE,
  origin,
  className,
  style,
}: {
  src: string;
  box: Box;
  parent?: Box;
  /** Titik poros animasi dalam koordinat ilustrasi. */
  origin?: Point;
  className?: string;
  style?: CSSProperties;
}) {
  const [x, y, w, h] = box;
  const [px, py, pw, ph] = parent;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      className={clsx('absolute max-w-none select-none', className)}
      style={{
        left: pct(x - px, pw),
        top: pct(y - py, ph),
        width: pct(w, pw),
        height: pct(h, ph),
        transformOrigin: origin && `${pct(origin[0] - x, w)} ${pct(origin[1] - y, h)}`,
        ...style,
      }}
    />
  );
}

const drift = (from: string, to: string, secs: number, delay = 0) =>
  ({ '--hs-from': from, '--hs-to': to, animationDuration: `${secs}s`, animationDelay: `${delay}s` }) as CSSProperties;

/** Langit, matahari, awan, gelembung chat, dan teman-teman yang menyapa — mengisi wadahnya seperti object-cover. */
export function HeroScene({ className }: { className?: string }) {
  return (
    <div className={clsx('pointer-events-none overflow-hidden [container-type:size]', className)} aria-hidden>
      <div className="absolute left-1/2 top-1/2 aspect-[1376/768] -translate-x-1/2 -translate-y-1/2" style={{ width: 'max(100cqw, calc(100cqh * 1376 / 768))' }}>
        <Layer src={sky} box={SCENE} />

        <Layer src={sunGlow} box={[1008, 38, 299, 299]} origin={SUN} className="hs-breathe" />
        <Layer src={sunRays} box={[1008, 40, 296, 296]} origin={SUN} className="hs-spin" />

        <Layer src={cloudTop} box={[764, 147, 204, 117]} className="hs-drift" style={drift('-6%', '8%', 15, -4)} />
        {/* Awan yang terpotong tepi gambar / tertutup karakter hanya bergeser ke arah potongannya. */}
        <Layer src={cloudRight} box={[1209, 307, 167, 143]} className="hs-drift" style={drift('0%', '10%', 18, -9)} />
        <Layer src={cloudLeft} box={[0, 397, 141, 144]} className="hs-drift" style={drift('0%', '-12%', 20, -3)} />
        <Layer src={cloudSmall} box={[297, 459, 162, 124]} className="hs-drift" style={drift('-4%', '6%', 13, -6)} />

        {/* Karakter kanan di belakang, tangannya di depan karakter tengah — keduanya bergerak bersamaan. */}
        <Layer src={right} box={[967, 437, 332, 379]} origin={[1130, 790]} className="hs-sway" style={{ animationDelay: '-2.1s' }} />
        <Layer src={left} box={[347, 448, 339, 368]} origin={[515, 790]} className="hs-sway" />
        <Layer src={center} box={[595, 415, 492, 401]} origin={[840, 790]} className="hs-hop" />
        <Layer src={rightArm} box={[992, 622, 17, 54]} origin={[1130, 790]} className="hs-sway" style={{ animationDelay: '-2.1s' }} />

        <Layer src={plantL} box={[217, 601, 160, 199]} origin={[296, 768]} className="hs-leaf" />
        <Layer src={plantR} box={[1235, 591, 141, 209]} origin={[1305, 768]} className="hs-leaf" style={{ animationDelay: '-2.7s' }} />

        <div
          className="hs-float absolute"
          style={{ left: pct(BUBBLE[0], 1376), top: pct(BUBBLE[1], 768), width: pct(BUBBLE[2], 1376), height: pct(BUBBLE[3], 768), transformOrigin: '84% 98%' }}
        >
          <Layer src={bubble} box={BUBBLE} parent={BUBBLE} />
          {/* Titik "sedang mengetik" */}
          <Layer src={dot1} box={[533, 277, 33, 33]} parent={BUBBLE} className="hs-dot" />
          <Layer src={dot2} box={[587, 277, 32, 33]} parent={BUBBLE} className="hs-dot" style={{ animationDelay: '.18s' }} />
          <Layer src={dot3} box={[639, 277, 34, 33]} parent={BUBBLE} className="hs-dot" style={{ animationDelay: '.36s' }} />
        </div>
      </div>
    </div>
  );
}

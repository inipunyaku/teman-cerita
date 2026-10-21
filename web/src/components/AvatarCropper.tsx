import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Modal, Spinner } from './ui';
import { useConfig } from '@/lib/config';
import { toast } from 'sonner';

const VIEW = 280; // ukuran area potong di layar (px)
const OUT = 320; // ukuran foto hasil (px)

/** Potong foto jadi persegi (tampil bulat): geser untuk memposisikan, slider untuk zoom. */
export function AvatarCropper({
  file,
  onCancel,
  onDone,
  saving,
}: {
  file: File;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
  saving?: boolean;
}) {
  const cfg = useConfig();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => setImg(el);
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const base = img ? Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight) : 1;
  const w = img ? img.naturalWidth * base * zoom : VIEW;
  const h = img ? img.naturalHeight * base * zoom : VIEW;
  const clamp = (o: { x: number; y: number }) => ({
    x: Math.max(-(w - VIEW) / 2, Math.min((w - VIEW) / 2, o.x)),
    y: Math.max(-(h - VIEW) / 2, Math.min((h - VIEW) / 2, o.y)),
  });
  const pos = clamp(off);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setOff({ x: drag.current.ox + e.clientX - drag.current.x, y: drag.current.oy + e.clientY - drag.current.y });
  };
  const onUp = () => {
    drag.current = null;
    setOff(pos);
  };

  const render = (size: number) => {
    const k = size / VIEW;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img!, (VIEW / 2 + pos.x - w / 2) * k, (VIEW / 2 + pos.y - h / 2) * k, w * k, h * k);
    return canvas;
  };

  const exportImage = () => {
    if (!img) return;
    const url = compressToLimit(render, cfg.avatarMaxKB * 1024);
    if (!url) {
      toast.error('Foto tidak bisa dikecilkan sampai batas ukuran.', { description: `Maksimal ${cfg.avatarMaxKB} KB. Coba foto lain.` });
      return;
    }
    onDone(url);
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title="Atur foto profil"
      description="Geser foto untuk memposisikan, lalu atur zoom."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel}>Batal</button>
          <button className="btn btn-primary" onClick={exportImage} disabled={!img || saving}>
            {saving && <Spinner />} Pakai foto ini
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-5 pb-3">
        <div
          className="relative touch-none select-none overflow-hidden rounded-3xl bg-canvas"
          style={{ width: VIEW, height: VIEW, cursor: drag.current ? 'grabbing' : 'grab' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {img ? (
            <img
              src={img.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{ width: w, height: h, left: VIEW / 2 + pos.x - w / 2, top: VIEW / 2 + pos.y - h / 2 }}
            />
          ) : (
            <div className="skeleton h-full w-full" />
          )}
          {/* Lingkaran panduan: area yang tampil sebagai avatar */}
          <svg className="pointer-events-none absolute inset-0" viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden>
            <defs>
              <mask id="crop-hole">
                <rect width={VIEW} height={VIEW} fill="white" />
                <circle cx={VIEW / 2} cy={VIEW / 2} r={VIEW / 2 - 2} fill="black" />
              </mask>
            </defs>
            <rect width={VIEW} height={VIEW} fill="rgba(14,42,61,.45)" mask="url(#crop-hole)" />
            <circle cx={VIEW / 2} cy={VIEW / 2} r={VIEW / 2 - 2} fill="none" stroke="#fff" strokeWidth="2" />
          </svg>
        </div>
        <div className="flex w-full max-w-[280px] items-center gap-3">
          <button type="button" className="btn btn-ghost btn-sm w-9 px-0" onClick={() => setZoom((z) => Math.max(1, z - 0.2))} aria-label="Perkecil">
            <Minus size={16} />
          </button>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-sky-600"
            aria-label="Zoom"
          />
          <button type="button" className="btn btn-ghost btn-sm w-9 px-0" onClick={() => setZoom((z) => Math.min(3, z + 0.2))} aria-label="Perbesar">
            <Plus size={16} />
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Ukuran berkas dari data URL base64 (byte). */
const dataUrlBytes = (url: string) => Math.ceil(((url.length - url.indexOf(',') - 1) * 3) / 4);

/**
 * Kompres foto profil sampai di bawah `maxBytes` sebelum diunggah. Mulai dari kualitas tertinggi; kualitas
 * diturunkan sedikit demi sedikit hanya bila perlu, lalu dimensi dikecilkan sebagai langkah terakhir.
 * WebP dipakai bila browser mendukung, selain itu JPEG (Safari lama).
 */
function compressToLimit(render: (size: number) => HTMLCanvasElement, maxBytes: number): string | null {
  const limit = maxBytes - 1024; // sisakan ruang supaya pasti di bawah batas server
  const webp = render(8).toDataURL('image/webp').startsWith('data:image/webp');
  const type = webp ? 'image/webp' : 'image/jpeg';
  for (const size of [OUT, 280, 240, 200, 160]) {
    const canvas = render(size);
    for (const q of [0.92, 0.86, 0.8, 0.72, 0.64, 0.56, 0.48]) {
      const url = canvas.toDataURL(type, q);
      if (dataUrlBytes(url) <= limit) return url;
    }
  }
  return null;
}

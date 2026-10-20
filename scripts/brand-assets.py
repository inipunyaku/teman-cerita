"""Turunkan aset merek dari web/src/assets/auth/logo-teman-cerita.png.

Menghasilkan:
  web/src/assets/brand/mark.webp       karakter + gelembung (tanpa tulisan), latar transparan
  web/src/assets/brand/logo-sm.webp    logo lengkap untuk loader awal di index.html
  web/src/assets/brand/wordmark.webp   tulisan "TEMAN CERITA / BRILiaN" persis dari logo
  web/src/assets/brand/sticker.webp    bentuk stiker (isi putih + garis biru) untuk logo animasi
  web/src/assets/brand/letters.webp    sprite tiap huruf, untuk dianimasikan satu per satu
  web/src/components/brand-letters.ts  posisi tiap huruf (koordinat PNG asli 1254x1254)
  web/public/favicon.*, apple-touch-icon.png, icon-192/512.png

Jalankan dari root repo:  python scripts/brand-assets.py   (butuh pillow, numpy, scipy)

File sumber logo (±1 MB) tidak disimpan di repo karena tidak dikirim ke browser. Ambil dulu dari riwayat git:
  git show dd2879d:web/src/assets/auth/logo-teman-cerita.png > web/src/assets/auth/logo-teman-cerita.png
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'web/src/assets/auth/logo-teman-cerita.png'
BRAND = ROOT / 'web/src/assets/brand'
PUB = ROOT / 'web/public'
BRAND.mkdir(parents=True, exist_ok=True)

im = Image.open(SRC).convert('RGB')
A = np.asarray(im).astype(np.int16)
H, W = A.shape[:2]
INK = A.min(axis=2) <= 232  # bukan putih


def soft(rgb: np.ndarray, hard: np.ndarray) -> Image.Image:
    """Alpha lembut di tepi (buram tipis), lalu 'un-mix' warna dari latar putih."""
    m = Image.fromarray((hard * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    al = np.asarray(m).astype(np.float32) / 255
    safe = np.clip(al, 1e-3, 1)[..., None]
    out = np.clip((rgb.astype(np.float32) - 255 * (1 - safe)) / safe, 0, 255)
    return Image.fromarray(np.dstack([out, al * 255]).astype(np.uint8), 'RGBA')


def trim(img: Image.Image, pad: int) -> Image.Image:
    img = img.crop(img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
    c = Image.new('RGBA', (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    c.paste(img, (pad, pad))
    return c


def small(img: Image.Image, path: Path, width: int | None = None, colors: int = 200):
    if width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    # Palet dikunci dulu, lalu disimpan sebagai WebP lossless (piksel identik, ±10-20% lebih kecil dari PNG).
    img = img.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGBA')
    img.save(path, lossless=True, quality=100, method=6, exact=True)


# --- Wilayah stiker: semua yang tidak terhubung ke putih di tepi gambar -------------------
lab, _ = ndi.label(~INK)
edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
OUTSIDE = np.isin(lab, edge[edge > 0])
INSIDE = ~OUTSIDE

full = trim(soft(A, INSIDE), 8)
small(full, BRAND / 'logo-sm.webp', 440)

# Stiker polos: garis biru di tepi dipertahankan, isinya putih. Disimpan setengah ukuran.
dist = ndi.distance_transform_edt(INSIDE)
stk = A.copy()
stk[dist > 12] = 255
y0, y1 = np.where(INSIDE.any(axis=1))[0][[0, -1]]
x0, x1 = np.where(INSIDE.any(axis=0))[0][[0, -1]]
sticker = soft(stk, INSIDE).crop((x0 - 2, y0 - 2, x1 + 3, y1 + 3))
STICKER_BOX = (int(x0 - 2), int(y0 - 2), sticker.width, sticker.height)
small(sticker, BRAND / 'sticker.webp', sticker.width // 2, colors=32)

# --- Mark: gelembung + tiga karakter --------------------------------------------------------
my0, my1, mx0, mx1 = 200, 745, 215, 1055
c = A[my0:my1, mx0:mx1]
nonwhite = INK[my0:my1, mx0:mx1]
lab, _ = ndi.label(nonwhite)
keep = np.zeros_like(nonwhite)
for i, sl in enumerate(ndi.find_objects(lab), start=1):
    comp = lab[sl] == i
    area = comp.sum()
    touches = sl[0].start == 0 or sl[1].start == 0 or sl[0].stop == nonwhite.shape[0] or sl[1].stop == nonwhite.shape[1]
    if area < 400 or area / comp.size < 0.12 or (touches and area < 8000):
        continue  # bintik, garis tepi stiker
    keep[sl] |= comp
mark = trim(soft(c, ndi.binary_fill_holes(keep)), 6)
small(mark, BRAND / 'mark.webp', 420)

# --- Huruf ----------------------------------------------------------------------------------
# Komponen tinta di bawah karakter, tanpa garis tepi stiker (tipis & panjang).
TY = 748
lab, _ = ndi.label(INK[TY:])
text = np.zeros_like(INK)
for i, sl in enumerate(ndi.find_objects(lab), start=1):
    comp = lab[sl] == i
    if comp.sum() < 150 or comp.sum() / comp.size < 0.2:
        continue
    text[TY + sl[0].start:TY + sl[0].stop, sl[1]] |= comp


tlab, _ = ndi.label(text)
tobj = ndi.find_objects(tlab)


def letter_mask(x_from: int, x_to: int, y_from: int, y_to: int, row: str) -> np.ndarray:
    m = np.zeros_like(text)
    if row == 't':
        # Huruf judul saling menempel: potong per kolom.
        m[y_from:y_to, x_from:x_to] = text[y_from:y_to, x_from:x_to]
    else:
        # Huruf besar terpisah: ambil komponen yang titik tengahnya ada di kolom ini.
        for k, sl in enumerate(tobj, start=1):
            cx, cy = (sl[1].start + sl[1].stop) / 2, (sl[0].start + sl[0].stop) / 2
            if x_from <= cx < x_to and y_from <= cy < y_to:
                m |= tlab == k
    # Kilau putih kecil di dalam huruf ikut dipertahankan; lubang besar (B, R, A…) tetap transparan.
    holes = ndi.binary_fill_holes(m) & ~m
    hl, hn = ndi.label(holes)
    for k in range(1, hn + 1):
        if (hl == k).sum() < 600:
            m |= hl == k
    return m


# Batas kolom huruf "TEMAN CERITA" (huruf saling menempel di PNG) dan huruf "BRILiaN".
TITLE = list(zip('TEMANCERITA', [182, 272, 344, 449, 534, 635, 721, 790, 872, 907, 966], [272, 344, 449, 534, 617, 721, 790, 872, 907, 966, 1066]))
BIG = list(zip('BRILiaN', [136, 335, 505, 578, 697, 762, 895], [335, 505, 578, 697, 773, 895, 1062]))
letters = [(ch, x0_, x1_, 752, 868, 't') for ch, x0_, x1_ in TITLE]
letters += [(ch, x0_, x1_, 870, 1100, 'b') for ch, x0_, x1_ in BIG]
letters += [('splash', 1062, 1156, 885, 1008, 'b')]

S = 0.7  # skala sprite
sprites, meta = [], []
for ch, lx0, lx1, ly0, ly1, row in letters:
    m = letter_mask(lx0, lx1, ly0, ly1, row)
    ys, xs = np.where(m)
    bx0, bx1, by0, by1 = xs.min() - 2, xs.max() + 3, ys.min() - 2, ys.max() + 3
    sp = soft(A, m).crop((bx0, by0, bx1, by1))
    sprites.append(sp.resize((max(1, round(sp.width * S)), max(1, round(sp.height * S))), Image.LANCZOS))
    meta.append((ch, row, int(bx0), int(by0), int(bx1 - bx0), int(by1 - by0)))

pad = 4
sheet = Image.new('RGBA', (sum(s.width + pad for s in sprites) + pad, max(s.height for s in sprites) + pad * 2), (0, 0, 0, 0))
x = pad
sheet_pos = []
for s in sprites:
    sheet.alpha_composite(s, (x, pad))
    sheet_pos.append((x, pad, s.width, s.height))
    x += s.width + pad
small(sheet, BRAND / 'letters.webp', colors=160)

# Wordmark: seluruh tulisan, tanpa stiker.
allm = np.zeros_like(text)
for ch, lx0, lx1, ly0, ly1, row in letters:
    allm |= letter_mask(lx0, lx1, ly0, ly1, row)
small(trim(soft(A, allm), 2), BRAND / 'wordmark.webp', 360)

# --- Metadata TypeScript --------------------------------------------------------------------
rows = ',\n'.join(
    f"  {{ ch: '{ch}', row: '{row}', x: {x}, y: {y}, w: {w}, h: {h}, sx: {sx}, sy: {sy}, sw: {sw}, sh: {sh} }}"
    for (ch, row, x, y, w, h), (sx, sy, sw, sh) in zip(meta, sheet_pos)
)
(ROOT / 'web/src/components/brand-letters.ts').write_text(
    '// Dibuat oleh scripts/brand-assets.py — jangan diedit manual.\n'
    '// x/y/w/h: posisi huruf di PNG logo asli (1254×1254); sx/sy/sw/sh: posisinya di letters.webp.\n'
    f'export const SHEET = {{ w: {sheet.width}, h: {sheet.height} }};\n'
    f'export const STICKER = {{ x: {STICKER_BOX[0]}, y: {STICKER_BOX[1]}, w: {STICKER_BOX[2]}, h: {STICKER_BOX[3]} }};\n'
    'export const LETTERS = [\n' + rows + ',\n] as const;\n',
    encoding='utf-8',
)


# --- Favicon & ikon -------------------------------------------------------------------------
def icon(size: int, bg: bool = True, radius: float = 0.24, scale: float = 0.82) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    if bg:
        ImageDraw.Draw(canvas).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius), fill=(234, 246, 255, 255))
    m = mark.copy()
    m.thumbnail((int(size * scale), int(size * scale)), Image.LANCZOS)
    canvas.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2 + int(size * 0.02)))
    return canvas


icon(64, bg=False, scale=1).save(PUB / 'favicon.png', optimize=True)
icon(180, radius=0).convert('RGB').save(PUB / 'apple-touch-icon.png', optimize=True)
icon(192).save(PUB / 'icon-192.png', optimize=True)
icon(512).save(PUB / 'icon-512.png', optimize=True)
icon(256, bg=False, scale=1).save(PUB / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print('ok — sheet', sheet.size, 'sticker', STICKER_BOX)

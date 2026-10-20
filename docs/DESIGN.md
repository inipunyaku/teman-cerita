# DESIGN.md — Teman Cerita

Konsep visual: **"Langit Pagi"**. Rasanya seperti membuka jendela jam tujuh pagi: biru muda, awan lembut, sedikit cahaya matahari. Tenang tanpa terasa klinis, cukup santai buat Gen Z, tapi tetap rapi untuk dipakai psikolog dan admin seharian.

Warna dasar diturunkan dari palet BRI Corporate University (`dash-bflp`): biru langit `#2BA9EF`, teal `#17B4A4`, navy `#0F5C8A`, kuning `#FFB020`.

---

## 1. Prinsip

1. **Tenang dulu, baru informatif.** Karyawan datang dalam kondisi tidak baik-baik saja. Layar karyawan dibuat lega, satu ajakan utama per layar, dan kalimatnya hangat.
2. **Padat untuk yang bekerja.** Layar admin dan psikolog lebih rapat: tabel, filter, angka. Tetap memakai bahasa visual yang sama.
3. **Status selalu terlihat.** Setiap tiket punya warna status dan linimasa yang konsisten di semua peran.
4. **Satu hal yang khas, bukan sepuluh.** Ciri khasnya hanya dua: logo karakter Teman Cerita BRILiaN dan judul serif miring. Selebihnya, termasuk kartu tiket, dibuat polos.

### Anti-"AI slop" (aturan yang sengaja dihindari)
- Tidak ada gradien ungu–biru, tidak ada teks gradien, tidak ada efek glassmorphism di mana-mana.
- Tidak memakai emoji sebagai ikon. Ikon pakai Lucide dengan stroke 1.75.
- Tidak ada pola "hero + 3 kartu fitur dengan ikon di lingkaran".
- Tidak memakai Inter/Roboto bawaan. Font dipilih dengan sengaja (lihat §3).
- Copy tidak generik ("Unlock your potential", "Seamless experience"). Kalimatnya spesifik dan manusiawi: *"Ceritamu aman di sini."*
- Bayangan tipis berwarna navy, bukan abu-abu hitam pekat.
- Animasi hanya untuk umpan balik (masuk halaman, toast, pesan baru), dengan durasi ≤ 300 ms dan menghormati `prefers-reduced-motion`.

## 2. Warna

### Token inti
| Token | Hex | Pemakaian |
|---|---|---|
| `canvas` | `#F7FAFC` | Latar aplikasi |
| `surface` | `#FFFFFF` | Kartu, panel |
| `line` | `#E3EDF5` | Border default |
| `ink` | `#0E2A3D` | Teks utama |
| `ink-soft` | `#4F6A7D` | Teks sekunder |
| `ink-faint` | `#8AA0B0` | Placeholder, meta |

### Langit (primer)
| 50 | 100 | 200 | 300 | 400 | **500** | 600 | 700 | 800 |
|---|---|---|---|---|---|---|---|---|
| `#F0F8FE` | `#DBF0FE` | `#BFE5FD` | `#93D6FB` | `#5FC0F7` | **`#2BA9EF`** | `#1E88D6` | `#0B6FA9` | `#0F5C8A` |

Tombol utama memakai `sky-600 #1E88D6` dengan teks putih (kontras 4.6:1) dan hover `sky-700`. `sky-500` dipakai untuk aksen non-teks.

### Pendukung
| Nama | Hex | Pemakaian |
|---|---|---|
| `mint` | `#17B4A4` / bg `#E3F6F3` | Sukses, verifikasi, "Selesai", ringan |
| `sun` | `#FFB020` / bg `#FFF3C4` | Peringatan, "Menunggu", sedang |
| `coral` | `#E8604C` / bg `#FDE9E5` | Berat, batal, error |
| `rose` | `#B4234A` / bg `#FBE3EA` | Kritis (jarang dipakai, harus mencolok) |
| `haze` | `#FBEFE7` | Rona hangat di ilustrasi awan (fajar) |

### Status tiket
| Status | Teks | Latar | Titik |
|---|---|---|---|
| Menunggu | `#8A5A00` | `#FFF3C4` | `#FFB020` |
| Dijadwalkan | `#0B6FA9` | `#DBF0FE` | `#2BA9EF` |
| Minta jadwal ulang | `#8A3B12` | `#FDE9DA` | `#F08A3E` |
| Berlangsung | `#0B6B62` | `#D5F3EF` | `#17B4A4` (berdenyut) |
| Selesai | `#3E5566` | `#EDF2F6` | `#8AA0B0` |
| Dibatalkan | `#A23A2A` | `#FDE9E5` | `#E8604C` |

### Keparahan
Ringan `mint` · Sedang `sun` · Berat `coral` · Kritis `rose`. Urutan ini juga dipakai di grafik.

## 3. Tipografi

| Peran | Font | Detail |
|---|---|---|
| Display | **Instrument Serif** (italic) | Judul halaman, angka KPI besar, kata sapaan. 32–56 px, line-height 1.05, tracking -0.01em |
| UI / body | **Onest** (variable) | Semua teks lain. 14–16 px, line-height 1.55 |
| Merek | **Fredoka** (variable, `font-brand`) | Wordmark, judul kartu Beranda pekerja, nama sapaan pekerja laki-laki. Selaras dengan huruf membulat di logo |
| Angka tabel | Onest + `font-variant-numeric: tabular-nums` | |

Pola khas: judul campuran, misalnya "Halo, *Rani*" dengan nama dalam serif miring dan sisanya Onest semibold.

Skala: `12 / 13 / 14 / 16 / 18 / 22 / 28 / 36 / 48`.

## 4. Bentuk, ruang, kedalaman

- Grid 4 px. Padding kartu 20–24 px (mobile 16 px).
- Radius: input & tombol `14px`, kartu `22px`, chip `999px`, bubble chat `20px` dengan satu sudut `6px`.
- Border 1 px `line` adalah pemisah utama. Bayangan hanya untuk elemen yang mengambang:
  - `shadow-soft`: `0 1px 0 #E3EDF5, 0 12px 32px -20px rgba(15,92,138,.35)`
  - `shadow-pop`: `0 18px 50px -20px rgba(15,92,138,.45)` (dropdown, modal)
- Latar halaman auth dan beranda karyawan: **awan SVG** besar di sudut dengan blur halus, ditambah grain tipis (noise 3%).

## 5. Elemen khas

### Logo — Teman Cerita BRILiaN
Sumber: `web/src/assets/auth/logo-teman-cerita.png` (gelembung chat + tiga karakter bulat, tulisan "TEMAN CERITA / BRILiaN"). Turunannya:
- `assets/brand/mark.png` — karakter saja (latar transparan), dipakai `LogoMark` dan lockup `Logo` (mark + wordmark Fredoka berwarna).
- `assets/brand/logo-sm.png` — logo stiker lengkap untuk loader awal di `index.html`.
- `public/favicon.ico|png`, `apple-touch-icon.png`, `icon-192/512.png` — favicon & ikon PWA.
- `AnimatedLogo` (`components/Brand.tsx`) — logo digambar ulang sebagai SVG agar bisa dianimasikan: karakter tengah melambai "dadah", mata karakter kanan melirik & berkedip, huruf "TEMAN CERITA" berombak, huruf "BRILiaN" bergoyang kenyal. Varian `peek` (karakter mengintip) dipakai di hero Beranda; `sleepy` saat malam. Dipakai juga oleh `BrandLoader` dan layar sambutan.

### Beranda pekerja — personal
Hero mengikuti waktu WIB: **pagi** (04–11, langit peach + matahari terbit), **siang** (11–15, biru cerah + matahari bersinar), **sore** (15–18, jingga + bukit), **malam** (18–04, biru tua + bulan & bintang, karakter tertidur). Jenis kelamin menentukan aksen & tipografi nama: **L** biru samudra + Fredoka, **P** merah muda kelopak + Instrument Serif miring, kosong → biru langit. Isi: sapaan + nama panggilan, ulang tahun (konfeti / hitung mundur 7 hari), cek perasaan harian (tersimpan di perangkat saja), daftar rawat diri sesuai waktu + latihan napas, afirmasi harian, dan ringkasan perjalanan konseling.

### Kartu tiket
Kartu biasa (border `line`, radius 22). Nomor `TC-2026-0012` tampil sebagai label kecil font mono `ink-faint` di atas, lalu status, metode, dan topik. Tidak ada ornamen tiket konser.

### Profil & ekspresi diri
Kartu profil punya banner gradien sesuai warna pilihan pengguna (Langit, Mint, Mentari, Senja, Lavender, Bunga, Malam), avatar 104px dengan tombol kamera, dan status singkat dalam serif miring. Avatar di seluruh aplikasi memakai foto bila ada; bila tidak, inisial di atas warna pilihan.

### Skeleton loader
Kerangka abu-biru (`#EAF2F8 → #F5F9FC`) dengan kilau 1.4s, bentuknya meniru konten asli per halaman (daftar, tabel, detail + chat, statistik, beranda psikolog). Dimatikan saat `prefers-reduced-motion`.

### Linimasa
Garis vertikal tipis berisi titik status. Event terakhir memakai titik berwarna penuh, event sebelumnya titik berongga.

## 6. Komponen

| Komponen | Spesifikasi |
|---|---|
| Tombol primer | `sky-600`, teks putih, tinggi 44, radius 14, semibold 14. Hover `sky-700`, aktif `scale(.98)` |
| Tombol sekunder | putih, border `line`, teks `ink` |
| Tombol lembut | `sky-50`, teks `sky-700` |
| Tombol bahaya | `coral`, teks putih |
| Input | tinggi 44, **font 16px** (cegah auto-zoom iOS), border `line`, fokus: border `sky-500` + ring 4 px `sky-100` |
| Pilihan kartu (metode/topik) | Kartu ber-border dengan ikon. Saat dipilih: border `sky-500`, latar `sky-50`, centang di pojok |
| Chip status | pill 24 px, titik 6 px + label 12 semibold |
| Kartu KPI | label 13 `ink-soft`, angka Instrument Serif 40, delta kecil |
| Tabel | header 12 uppercase tracking .04em `ink-faint`, baris 52 px, hover `sky-50/50` |
| Toast | Sonner, posisi atas-tengah, radius 16 |
| Lonceng notifikasi | badge `coral` berisi angka; panel dropdown 360 px |
| Chat | bubble sendiri `sky-600` teks putih; lawan bicara putih ber-border. Pemisah tanggal. Composer menempel di bawah |

## 7. Layout

- **Karyawan (mobile-first):** bar atas (logo + lonceng + avatar), konten maks. 720 px di tengah, dan **bottom nav** di mobile (Beranda, Buat janji, Pendaftaran, Profil).
- **Psikolog & Admin:** sidebar kiri 248 px (logo, navigasi, kartu profil), konten maks. 1200 px. Di mobile sidebar menjadi drawer.
- Halaman auth: dua kolom di desktop (kiri ilustrasi langit dengan kutipan, kanan formulir), satu kolom di mobile.

## 8. Ilustrasi & ikon
- Ilustrasi awan dibuat inline SVG (tanpa aset raster), dengan gradien sangat lembut `#DBF0FE → #FFFFFF` dan rona `haze` di tepi bawah awan.
- Ikon: `lucide-react`, ukuran 18 (UI) / 22 (kartu pilihan), stroke 1.75.
- Metode: Chat `MessageCircle`, Online `Video`, Tatap muka `MapPin`.

## 9. Bahasa & nada

| Situasi | Contoh |
|---|---|
| Sapaan | "Halo, Rani. Lagi kepikiran apa hari ini?" |
| Ajakan | "Ajukan sesi", "Ceritakan sedikit (boleh dilewati)" |
| Kosong | "Belum ada tiket. Kalau butuh teman cerita, kami di sini." |
| Sukses | "Permintaanmu sudah kami terima. Kamu akan dikabari begitu jadwalnya siap." |
| Kerahasiaan | "Ceritamu hanya dibaca psikolog yang mendampingimu." |
| Admin/psikolog | Netral dan ringkas: "3 tiket menunggu penjadwalan." |

Karyawan disapa "kamu". Psikolog dan admin juga memakai "kamu" pada mikro-copy, tapi tanpa basa-basi.

## 10. Aksesibilitas
- Kontras teks minimal 4.5:1. Chip status sudah dicek pada kombinasi di §2.
- Status tidak boleh hanya dibedakan lewat warna: selalu ada label teks.
- Target sentuh minimal 44 × 44 px.
- `:focus-visible` memakai ring 3 px `sky-300`.
- `prefers-reduced-motion`: animasi masuk dan denyut dimatikan.

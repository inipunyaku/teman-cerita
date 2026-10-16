# PRD — Teman Cerita

> Layanan konseling psikologi untuk karyawan. Ajukan, dijadwalkan, didampingi.

| | |
|---|---|
| Versi | 1.0 |
| Tanggal | 15 Oktober 2026 |
| Status | Disetujui untuk build v1 |
| Domain | https://temancerita.devmode.biz.id |

---

## 1. Latar belakang

Karyawan butuh jalur yang **mudah, aman, dan rahasia** untuk mendapatkan pendampingan psikolog. Saat ini permintaan konseling biasanya lewat chat pribadi atau email ke HC, sehingga:

- karyawan sungkan karena prosesnya terasa formal dan tidak jelas statusnya,
- admin menjadwalkan secara manual (spreadsheet, WA) dan mudah bentrok,
- psikolog tidak punya tempat terstruktur untuk mencatat hasil sesi,
- manajemen tidak punya gambaran agregat (topik apa yang paling banyak, unit kerja mana yang paling membutuhkan intervensi).

**Teman Cerita** menyatukan alur tersebut dalam satu aplikasi web.

## 2. Tujuan & ukuran keberhasilan

| Tujuan | Indikator |
|---|---|
| Karyawan bisa mengajukan konseling < 2 menit | Median waktu isi formulir |
| Tidak ada permintaan yang terlantar | 100% tiket "Menunggu" ditangani admin ≤ 1×24 jam kerja |
| Status selalu jelas bagi karyawan | Setiap perubahan status memicu notifikasi in-app (+ email bila aktif) |
| Admin punya data untuk intervensi | Dashboard statistik keparahan, topik, unit kerja, tren |
| Kerahasiaan terjaga | Catatan klinis hanya bisa dibaca psikolog penanggung jawab |

**Non-goal v1:** video call bawaan (pakai tautan meeting eksternal), pembayaran, aplikasi mobile native, integrasi SSO/HRIS.

## 3. Pengguna

| Peran | Siapa | Kebutuhan utama |
|---|---|---|
| **Karyawan** | Pegawai yang ingin konseling | Daftar akun, ajukan permintaan, pilih metode (chat / online / tatap muka), pantau status, chat dengan psikolog, ajukan reschedule, beri ulasan |
| **Psikolog** | Psikolog internal/mitra | Lihat jadwal, chat dengan karyawan, mulai & selesaikan sesi, isi laporan (keparahan, topik, ringkasan, rekomendasi) |
| **Admin** | Tim HC / pengelola layanan | Verifikasi akun karyawan, assign psikolog + jadwal + tempat/tautan, proses reschedule, kelola psikolog & unit kerja, lihat statistik |

## 4. Alur utama

```
Karyawan daftar ──► Admin verifikasi ──► Karyawan ajukan permintaan ──► Tiket TC-YYYY-NNNN (Menunggu)
                         │ tolak                                              │
                         ▼                                                    ▼
                  Akun ditolak (+alasan)                       Admin assign psikolog, jadwal, tempat/link
                                                                              │
                                                                              ▼
                                       ┌──────────── Dijadwalkan ◄──── reschedule disetujui
                                       │                 │                          ▲
                                       │                 ├── karyawan ajukan reschedule ──► Menunggu reschedule
                                       │                 ▼                          │
                                       │         Psikolog mulai sesi → Berlangsung  └── ditolak → kembali Dijadwalkan
                                       │                 ▼
                                       │         Psikolog isi laporan → Selesai ──► Karyawan beri ulasan (opsional)
                                       ▼
                                Dibatalkan (oleh karyawan sebelum sesi / oleh admin)
```

### 4.1 Status tiket

| Status | Kode | Arti |
|---|---|---|
| Menunggu | `pending` | Baru diajukan, belum ada psikolog |
| Dijadwalkan | `scheduled` | Psikolog, waktu, dan tempat/link sudah ditetapkan |
| Minta jadwal ulang | `reschedule_requested` | Karyawan mengajukan perubahan jadwal, menunggu admin |
| Berlangsung | `in_progress` | Psikolog sudah memulai sesi |
| Selesai | `completed` | Laporan sudah diisi psikolog |
| Dibatalkan | `cancelled` | Dibatalkan karyawan/admin, dengan alasan |

### 4.2 Status akun karyawan

`pending` (menunggu verifikasi) → `verified` atau `rejected`. Akun yang belum terverifikasi **bisa login** tapi hanya melihat halaman status verifikasi; semua fitur lain terkunci di sisi server (bukan hanya UI). Akun bisa dinonaktifkan admin (`disabled`).

## 5. Kebutuhan fungsional

### 5.1 Autentikasi & akun
- **F-01** Registrasi karyawan: nama lengkap, PN (personal number, unik), email (unik), nomor WhatsApp, unit kerja (pilih dari daftar), password (min. 8 karakter) + konfirmasi.
- **F-02** Login pakai email **atau** PN + password. Sesi via cookie httpOnly (7 hari).
- **F-03** Admin melihat daftar akun menunggu verifikasi, lalu **verifikasi** atau **tolak dengan alasan**. Karyawan dinotifikasi.
- **F-04** Karyawan yang ditolak bisa memperbaiki data dan mengajukan ulang.
- **F-05** Semua pengguna bisa mengubah profil (nama, WA, unit kerja untuk karyawan) dan password, serta **mengekspresikan diri**: foto profil (dipotong & di-zoom di browser, disimpan 320×320), warna avatar/latar profil, dan status singkat (maks. 60 karakter). Foto & status tampil ke lawan bicara (psikolog ↔ karyawan) dan admin.
- **F-07** Tombol **Keluar** tersedia di menu avatar (semua ukuran layar) dan di halaman profil.
- **F-06** Akun psikolog & admin dibuat oleh admin (tidak ada registrasi publik).

### 5.2 Permintaan konseling (karyawan)
- **F-10** Formulir: topik utama (Pekerjaan, Relasi kerja, Keluarga, Keuangan, Kesehatan mental, Pengembangan diri, Lainnya), metode (**Chat**, **Online meeting**, **Tatap muka**), seberapa mendesak (Bisa menunggu / Secepatnya / Mendesak), cerita singkat (opsional, maks. 2000 karakter). **Karyawan tidak memilih jam** — tanggal, jam, dan tempat ditentukan admin.
- **F-11** Setelah submit, karyawan mendapat **nomor tiket** `TC-2026-0001`.
- **F-12** Maksimal 1 tiket aktif per karyawan (status bukan Selesai/Dibatalkan) agar antrean adil.
- **F-13** Karyawan melihat daftar & detail tiket beserta **linimasa** (riwayat perubahan status).
- **F-14** Karyawan bisa **membatalkan** tiket selama belum Berlangsung, dengan alasan.
- **F-15** Karyawan bisa **mengajukan reschedule** untuk tiket Dijadwalkan cukup dengan alasan (boleh menyebut kapan lebih longgar); admin yang menentukan jadwal baru.
- **F-16** Setelah Selesai, karyawan bisa memberi **ulasan** (1–5 + komentar opsional). Ulasan hanya terlihat oleh admin secara agregat dan oleh psikolog terkait.

### 5.3 Penjadwalan (admin)
- **F-20** Antrean tiket dengan filter status, metode, urgensi, unit kerja; tiket mendesak tampil di atas.
- **F-21** **Assign**: pilih psikolog (aktif), tanggal, jam mulai–selesai, metode final, lalu:
  - Tatap muka → lokasi/ruangan wajib.
  - Online meeting → tautan meeting wajib.
  - Chat → tidak perlu tempat; sesi berlangsung di ruang chat aplikasi.
  - Catatan untuk karyawan (opsional).
- **F-22** Sistem memberi **peringatan bentrok** bila psikolog sudah punya sesi di waktu yang tumpang tindih.
- **F-23** Proses reschedule: **setujui** (tetapkan jadwal baru) atau **tolak** (dengan alasan → kembali Dijadwalkan dengan jadwal lama).
- **F-24** Admin bisa membatalkan atau mengubah penugasan tiket yang belum Berlangsung.
- **F-25** Kelola psikolog (tambah, ubah, nonaktifkan), kelola admin, kelola unit kerja.

### 5.4 Sesi & chat (psikolog ↔ karyawan)
- **F-30** Ruang chat per tiket, aktif sejak tiket Dijadwalkan hingga 7 hari setelah Selesai (lalu hanya-baca).
- **F-31** Pesan terkirim realtime (Server-Sent Events), indikator sudah dibaca.
- **F-32** Psikolog melihat daftar sesi: Hari ini, Mendatang, Riwayat; serta kalender mingguan.
- **F-33** Psikolog **memulai sesi** (Dijadwalkan → Berlangsung).
- **F-34** Psikolog **menyelesaikan sesi** dengan laporan wajib:
  - Tingkat keparahan: **Ringan / Sedang / Berat / Kritis**
  - Topik yang dibahas (multi-pilih, ≥1) — taksonomi sama dengan F-10 + Stres kerja, Burnout, Kecemasan, Duka/kehilangan
  - Ringkasan sesi (rahasia)
  - Rekomendasi / rencana tindak lanjut (rahasia)
  - Perlu sesi lanjutan? (ya/tidak)
- **F-35** Keparahan **Kritis** memicu notifikasi prioritas ke admin (tanpa isi ringkasan) agar bisa dieskalasi sesuai SOP.

### 5.5 Notifikasi
- **F-40** Notifikasi in-app (lonceng, jumlah belum dibaca, realtime via SSE) untuk setiap event di tabel bawah.
- **F-41** Email via **Brevo API** untuk event yang sama, **hanya jika** `BREVO_API_KEY` dan `MAIL_FROM` terisi. Bila kosong: dilewati tanpa error, dicatat di log server. Kode siap pakai.
- **F-42** Pesan chat baru hanya notifikasi in-app (bukan email) agar tidak spam.

| Event | Penerima |
|---|---|
| Akun baru menunggu verifikasi | Admin |
| Akun diverifikasi / ditolak | Karyawan |
| Tiket baru | Admin |
| Tiket dijadwalkan | Karyawan, Psikolog |
| Reschedule diajukan | Admin, Psikolog |
| Reschedule disetujui / ditolak | Karyawan, Psikolog |
| Tiket dibatalkan | Pihak terkait lainnya |
| Sesi dimulai | Karyawan |
| Sesi selesai | Karyawan |
| Laporan keparahan Kritis | Admin |
| Pesan chat baru | Lawan bicara (in-app) |

### 5.6 Statistik (admin)
- **F-50** KPI: total tiket, menunggu, dijadwalkan, selesai bulan ini, rata-rata waktu tunggu (ajuan → jadwal), rating rata-rata.
- **F-51** Distribusi **keparahan**.
- **F-52** **Topik** yang paling sering dibicarakan (dari laporan psikolog).
- **F-53** **Unit kerja** dengan permintaan terbanyak.
- **F-54** **Matriks topik × unit kerja** (heatmap).
- **F-55** Tren permintaan per bulan (6 bulan terakhir) dan distribusi metode.
- **F-56** Beban kerja per psikolog (sesi selesai, sesi mendatang, rating).
- **F-57** Filter rentang tanggal (30 hari, 90 hari, 12 bulan, semua).

## 6. Kerahasiaan & keamanan

- Ringkasan dan rekomendasi sesi **hanya** bisa dibaca psikolog yang menangani. Admin hanya melihat metadata (keparahan, topik, perlu lanjutan) untuk statistik.
- Isi chat hanya bisa dibaca karyawan dan psikolog pada tiket tersebut. Admin tidak membuka chat.
- Password di-hash bcrypt (cost 10). JWT di cookie httpOnly, `SameSite=Lax`, `Secure` di produksi.
- Rate limit login & registrasi. Validasi semua input di server (zod). Header keamanan (helmet).
- Otorisasi berbasis peran dan kepemilikan dicek di setiap endpoint.

## 7. Kebutuhan non-fungsional

- Responsif: nyaman di ponsel (karyawan sering membuka dari HP) hingga desktop.
- Bahasa antarmuka: Indonesia, nada hangat dan santai tapi tetap sopan.
- Input berukuran font 16px agar iOS Safari tidak auto-zoom saat fokus.
- Setiap halaman menampilkan **skeleton loader** yang meniru bentuk kontennya saat data dimuat.
- Ringan: berjalan di VPS 1 vCPU / 2 GB RAM.
- Aksesibilitas: kontras AA, fokus keyboard terlihat, label pada semua input.

## 8. Arsitektur

| Lapisan | Teknologi |
|---|---|
| Frontend | React 18 + Vite + TypeScript, Tailwind CSS, TanStack Query, Recharts |
| Backend | Node.js 22 + Express, zod, JWT |
| Database | SQLite (better-sqlite3, WAL) — satu file, mudah backup |
| Realtime | Server-Sent Events (`/api/stream`) |
| Email | Brevo Transactional API (`POST https://api.brevo.com/v3/smtp/email`) |
| Email | SMTP (Brevo relay) atau Brevo API, nonaktif bila kosong |
| Deploy | systemd + nginx reverse proxy + Let's Encrypt |

### Variabel lingkungan

| Nama | Wajib | Keterangan |
|---|---|---|
| `PORT` | – | Default 3410 |
| `JWT_SECRET` | ✔ | Rahasia penandatangan sesi |
| `DATABASE_PATH` | – | Default `./data/teman-cerita.db` |
| `APP_URL` | ✔ | URL publik, dipakai di tautan email |
| `MAIL_FROM` | – | Alamat pengirim terverifikasi di Brevo |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | – | Dipakai bila `SMTP_HOST` terisi |
| `BREVO_API_KEY` | – | Alternatif SMTP; semua kosong = email nonaktif |
| `MAIL_FROM_NAME` | – | Default "Teman Cerita" |

## 9. Akun demo

| Peran | Login | Password |
|---|---|---|
| Admin | `admin@temancerita.id` | `demo1234` |
| Psikolog | `psikolog@temancerita.id` | `demo1234` |
| Psikolog 2 | `psikolog2@temancerita.id` | `demo1234` |
| Karyawan | `karyawan@temancerita.id` / PN `90001234` | `demo1234` |
| Karyawan (belum diverifikasi) | `baru@temancerita.id` | `demo1234` |

Data contoh (±60 tiket lintas unit kerja dan 6 bulan) disiapkan agar dashboard statistik langsung bermakna.

## 10. Rilis berikutnya (backlog)

- Pengingat H-1 dan 1 jam sebelum sesi (email/WA).
- Integrasi WhatsApp (nomor sudah dikumpulkan).
- Ekspor statistik ke Excel/PDF.
- Self-assessment singkat (mis. PHQ-9/GAD-7) sebelum pengajuan.
- Ketersediaan jadwal psikolog (slot) agar karyawan bisa memilih langsung.
- SSO internal.

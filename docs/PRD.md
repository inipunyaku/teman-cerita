# PRD — Teman Cerita BRILiaN

> Layanan konseling individual 60 menit bersama psikolog profesional bagi Pekerja BRI.

| | |
|---|---|
| Versi | 2.0 (mengikuti *Journey Web Teman Cerita.xlsx*) |
| Tanggal | 19 Oktober 2026 |
| Domain | https://temancerita.devmode.biz.id |

Perubahan utama dari v1: tidak ada registrasi/verifikasi akun (pekerja dari master data PN), tidak ada penjadwalan manual oleh admin (pekerja memesan slot sendiri), ada informed consent, skrining EANSCALE, form pasca-sesi dengan rencana tindak lanjut, feedback CSQ, dan dashboard monitoring baru.

## 1. Peran

| Peran | Kebutuhan utama |
|---|---|
| **Pekerja** | Masuk dengan PN, consent, skrining, ceritakan kebutuhan, pilih psikolog + jadwal + media, lihat hasil & tindak lanjut, isi feedback |
| **Psikolog** | Membuka ketersediaan sendiri, melihat profil kasus klien, menjalankan sesi, mengisi form pasca-sesi |
| **Admin** | Master data pekerja, akun psikolog/admin, ketersediaan psikolog, memindahkan/membatalkan sesi, dashboard |

## 2. Journey pekerja

| # | Tahap | Ketentuan |
|---|---|---|
| 1 | Access | Login dengan PN (master data). Tidak ada registrasi manual. |
| 2 | Informed consent | Teks lengkap 5 poin. **Bersedia** → lanjut; **Tidak bersedia** → berhenti. |
| 3 | Data diri | Nama panggilan (disimpan ke profil & tiket). |
| 4 | Skrining EANSCALE | 16 pernyataan, skala 4 (STS–SS), wajib. Skor 16–64 (pernyataan positif dibalik); ≤32 rendah, 33–44 sedang, ≥45 tinggi (batas dapat disesuaikan di `shared/constants.ts`). |
| 5 | Kebutuhan | Topik (Work Stress Management, Emotional Resilience, Personal Growth, Interpersonal Relations, Lainnya), keluhan min. 100 karakter, pengaruh ke keseharian 1–10, harapan. |
| 6 | Scheduling | Kalender → psikolog yang tersedia (dengan profil) → jam → media (Tatap muka / Chat / Video-Voice Call Teams). Hanya slot kosong yang tampil. |
| 7 | Submission | Nomor tiket `TC-YYYY-NNNNN`; konfirmasi via notifikasi + email; pengingat H-1. |
| 8 | Session | Maks. 60 menit, toleransi telat 15 menit. Tatap muka di Well-being Corner (ruangan otomatis sesuai prioritas); online via tautan Teams psikolog; chat di ruang chat aplikasi. |
| 9 | Hasil & tindak lanjut | Sebelum psikolog mengisi: teks "Sesi kamu sudah selesai 💙…". Setelahnya teks sesuai Terminasi / Sesi lanjutan / Referral + catatan psikolog. |
| 10 | Feedback | 8 item CSQ (skor 1–4), total 8–32: ≤20 rendah, 21–26 sedang, 27–32 tinggi. |

Pekerja bisa **mengubah jadwal** atau **membatalkan** paling lambat H-4 jam; slot lama langsung tersedia lagi.

### Aturan penjadwalan
- Jam operasional 08.00–16.30 WIB, Senin–Jumat; pilihan jam mulai tiap 30 menit.
- Istirahat Senin–Kamis 12.00–13.00, Jumat 11.30–13.30.
- Booking minimal H-4 jam.
- Satu psikolog: tidak tumpang tindih dan tidak back-to-back (jeda ≥ 30 menit), maksimal 4 sesi/hari.
- Maksimal 4 sesi berjalan bersamaan (jumlah ruangan).
- Eligibility: maks. 7 sesi per tahun, jeda minimal 2 minggu antar sesi, satu booking aktif.

## 3. Journey psikolog
1. Membuka ketersediaan per tanggal/jam/media (bisa diulang mingguan).
2. Menerima notifikasi sesi baru dengan profil kasus: data diri, kebutuhan, hasil skrining, riwayat sesi.
3. Menjalankan sesi (mulai/akhiri). Sesi yang lewat jam selesai otomatis menjadi *Menunggu hasil psikolog*.
4. Form pasca-sesi: tujuan konseling, riwayat kesehatan, gejala, ringkasan, kategorisasi (Beban Kerja, Kehidupan Pribadi, Jam Kerja, Isu dengan Rekan Kerja, Transisi dan Adaptasi, Perkembangan Karier), rencana tindak lanjut (No show / Terminasi / Sesi lanjutan / Referral), catatan untuk klien.

## 4. Status tiket

| Status | Kode |
|---|---|
| Akan datang | `scheduled` |
| Berlangsung | `in_progress` |
| Menunggu hasil psikolog | `awaiting_report` |
| Selesai | `completed` |
| Tidak hadir | `no_show` |
| Dibatalkan | `cancelled` |

## 5. Dashboard admin (filter bulan & tahun, berdasarkan tanggal sesi)
- **Overview:** total klien, sesi selesai, total booking, booking akan datang, rate pembatalan / no show / reschedule, utilisasi layanan, kepuasan CSQ, jenis kelamin, usia, media.
- **Tren layanan:** klien unik, sesi, booking, utilisasi, kepuasan per bulan; klien per band & region.
- **Distribusi permasalahan:** kategori pasca-sesi dan hasil skrining EANSCALE — total, per band, region, unit, bulan.
- **Monitoring sesi:** akan datang, selesai, dibatalkan, no show, follow-up, terminasi, referral, menunggu hasil.
- **Monitoring psikolog:** slot ketersediaan, terpesan, tersisa, utilisasi, jumlah sesi, kepuasan.
- **Hasil & tindak lanjut:** terminasi, sesi lanjutan, referral, belum ada hasil (persentase).

## 6. Kerahasiaan
- Keluhan, harapan, jawaban skrining, dan catatan klinis hanya bisa dibaca pekerja ybs. dan psikolog penanggung jawab. Admin melihat metadata (tingkat skrining, kategori, rencana tindak lanjut, skor feedback).
- Isi chat hanya untuk pekerja dan psikolognya.

## 7. Belum tercakup / perlu keputusan
- Integrasi master data BRI & SSO (saat ini master data dikelola admin, impor CSV).
- Notifikasi WhatsApp (butuh penyedia API; email & in-app sudah berjalan).
- Pembuatan tautan Microsoft Teams otomatis (saat ini tautan pribadi psikolog / diisi per sesi).
- Norma resmi skoring EANSCALE dan teks resmi item feedback CSQ (bbri.id/FeedbackTemanCeritaBRILiaN).
- Nama ruangan Well-being Corner (sementara: Ruang 1, Ruang 2, Ruang Terhubung, Ruang 4).
- SLA pengisian hasil oleh psikolog.

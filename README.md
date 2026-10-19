# Teman Cerita

Layanan konseling Teman Cerita BRILiaN. Pekerja masuk dengan PN, menyetujui informed consent, mengisi skrining EANSCALE dan kebutuhannya, lalu memilih sendiri psikolog, jadwal, dan media dari slot yang tersedia. Psikolog membuka ketersediaan dan mengisi form pasca-sesi; admin memantau lewat dashboard.

- Dokumen produk: [docs/PRD.md](docs/PRD.md)
- Panduan desain: [docs/DESIGN.md](docs/DESIGN.md)

## Stack
React 18 + Vite + Tailwind (frontend) · Express + SQLite/better-sqlite3 (backend) · Server-Sent Events (realtime) · Brevo (email, opsional).

## Menjalankan lokal
```bash
npm install
cp .env.example .env
npm run seed          # isi akun demo + data contoh (pakai `-- --reset` untuk mengulang)
npm run dev           # API :3410 + web :5173
```

## Akun demo (password `demo1234`)
| Peran | Login |
|---|---|
| Pekerja | PN `90001234` (atau karyawan@temancerita.id) |
| Psikolog | psikolog@temancerita.id (juga psikolog2@ s.d. psikolog4@) |
| Admin | admin@temancerita.id |

Pekerja baru ditambahkan admin di menu **Data pekerja** (satu per satu atau impor CSV). Password awal = tanggal lahir `DDMMYYYY`, atau PN bila tanggal lahir kosong.

## Migrasi dari versi lama
Saat server pertama kali jalan di database versi lama, tabel tiket/chat/laporan dibuat ulang mengikuti alur baru. Akun & unit kerja dipertahankan; database lama dicadangkan otomatis ke `data/teman-cerita.db.v1-<waktu>.bak`. Akun karyawan yang dulu masih "menunggu/ditolak" dinonaktifkan untuk ditinjau admin.

## Produksi (VPS ini)
| Bagian | Lokasi |
|---|---|
| Kode | `/root/teman-cerita` |
| Service | `systemctl status teman-cerita` (port 127.0.0.1:3410) |
| Database | `data/teman-cerita.db` (SQLite, backup cukup salin file ini) |
| Nginx | `/etc/nginx/conf.d/temancerita.devmode.biz.id.conf` (salinan di `deploy/`) |
| SSL | `deploy/issue-cert.sh`, dijalankan otomatis oleh `teman-cerita-cert.timer` sampai berhasil |
| Log | `journalctl -u teman-cerita -f` |

Update aplikasi:
```bash
cd /root/teman-cerita && npm install && npm run build && systemctl restart teman-cerita
```

### Mengaktifkan email (Brevo)
Isi `BREVO_API_KEY` dan `MAIL_FROM` (alamat pengirim yang sudah diverifikasi di Brevo) di `.env`, lalu `systemctl restart teman-cerita`. Kalau dikosongkan, email dilewati dan notifikasi in-app tetap berjalan. Kodenya ada di `server/mail.ts`.

## Docker
```bash
cp .env.example .env          # isi JWT_SECRET, APP_URL, email, dst.
mkdir -p data && sudo chown -R 1000:1000 data   # container berjalan sebagai user `node` (uid 1000)
docker compose up -d --build  # app di 127.0.0.1:3410, pasang reverse proxy (nginx) di depannya
```
- Data (database SQLite, avatar, lampiran) tersimpan di volume `./data` → `/app/data`.
- Tanpa compose: `docker build -t teman-cerita . && docker run -d -p 127.0.0.1:3410:3410 --env-file .env -v $PWD/data:/app/data teman-cerita`

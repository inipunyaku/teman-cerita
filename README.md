# Teman Cerita

Layanan konseling psikologi untuk karyawan. Karyawan mengajukan sesi, admin menjadwalkan psikolog, lalu psikolog mendampingi dan membuat laporan.

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
| Admin | admin@temancerita.id |
| Psikolog | psikolog@temancerita.id (juga psikolog2@, psikolog3@) |
| Karyawan | karyawan@temancerita.id / PN 90001234 |
| Karyawan belum diverifikasi | baru@temancerita.id |

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

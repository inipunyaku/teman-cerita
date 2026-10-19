/** Tes kirim email: npm run mail:test -- alamat@tujuan.com */
import { emailEnabled, mailTransport } from './config.js';
import { sendMail } from './mail.js';

const to = process.argv[2];
if (!to) {
  console.log('Pemakaian: npm run mail:test -- alamat@tujuan.com');
  process.exit(1);
}
if (!emailEnabled) {
  console.log('Email nonaktif: isi MAIL_FROM dan SMTP_HOST (atau BREVO_API_KEY) di .env');
  process.exit(1);
}
const ok = await sendMail({
  to: { email: to },
  subject: 'Tes email — Teman Cerita',
  heading: 'Email Teman Cerita sudah aktif',
  body: `Kalau kamu membaca ini, pengiriman lewat ${mailTransport?.toUpperCase()} berhasil.\nKonfirmasi pendaftaran, pengingat H-1, dan hasil sesi akan dikirim dari alamat ini.`,
});
console.log(ok ? `Terkirim ke ${to} via ${mailTransport}` : 'Gagal mengirim — lihat pesan error di atas');
process.exit(ok ? 0 : 1);

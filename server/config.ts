import fs from 'node:fs';
import path from 'node:path';

if (fs.existsSync('.env')) process.loadEnvFile('.env');

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET wajib diisi di produksi');
}

export const config = {
  isProd,
  port: Number(process.env.PORT || 3410),
  host: process.env.HOST || '127.0.0.1',
  appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-teman-cerita',
  databasePath: path.resolve(process.env.DATABASE_PATH || './data/teman-cerita.db'),
  mail: {
    from: process.env.MAIL_FROM?.trim() || '',
    fromName: process.env.MAIL_FROM_NAME?.trim() || 'Teman Cerita',
  },
  brevo: {
    apiKey: process.env.BREVO_API_KEY?.trim() || '',
  },
  smtp: {
    host: process.env.SMTP_HOST?.trim() || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER?.trim() || '',
    pass: process.env.SMTP_PASS || '',
  },
};

/** SMTP dipakai bila SMTP_HOST terisi; selain itu Brevo API; bila keduanya kosong email nonaktif. */
export const mailTransport: 'smtp' | 'brevo' | null = !config.mail.from
  ? null
  : config.smtp.host
    ? 'smtp'
    : config.brevo.apiKey
      ? 'brevo'
      : null;
export const emailEnabled = mailTransport !== null;

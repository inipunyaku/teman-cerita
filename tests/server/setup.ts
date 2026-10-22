/**
 * Dijalankan sebelum setiap file tes server. Database selalu file SQLite sementara yang baru,
 * tidak pernah database asli di data/. Email dimatikan supaya tidak ada pesan terkirim.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teman-cerita-test-'));
process.env.DATABASE_PATH = path.join(dir, 'test.db');
process.env.NODE_ENV = 'test';
// Server produksi (Docker) berjalan dalam UTC; semua jadwal harus tetap benar dalam WIB.
process.env.TZ = 'UTC';
process.env.JWT_SECRET = 'test-secret';
process.env.MAIL_FROM = '';
process.env.SMTP_HOST = '';
process.env.BREVO_API_KEY = '';

// Log "[mail:skip]" (email nonaktif) tidak perlu memenuhi keluaran tes.
const log = console.log;
console.log = (...args: unknown[]) => (String(args[0]).startsWith('[mail:skip]') ? undefined : log(...args));

const { config } = await import('../../server/config.js');
if (!config.databasePath.startsWith(dir)) throw new Error(`Tes harus memakai database sementara, bukan ${config.databasePath}`);

afterAll(async () => {
  const { db } = await import('../../server/db.js');
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

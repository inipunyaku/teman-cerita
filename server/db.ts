import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

const SCHEMA_VERSION = 2;

const tableCols = (table: string) =>
  new Set((db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));

/**
 * Versi 1 memakai alur "ajukan → admin menjadwalkan". Versi 2 mengikuti journey baru (booking mandiri,
 * skrining, hasil & tindak lanjut), sehingga tabel tiket dan turunannya dibuat ulang. Database lama
 * dicadangkan dulu ke file terpisah; akun dan unit kerja dipertahankan.
 */
if ((db.pragma('user_version', { simple: true }) as number) < SCHEMA_VERSION && tableCols('tickets').has('urgency')) {
  const backup = `${config.databasePath}.v1-${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
  db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
  console.warn(`[db] Migrasi ke journey baru. Cadangan database lama: ${backup}`);
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    for (const t of ['notifications', 'messages', 'reviews', 'report_topics', 'reports', 'reschedule_requests', 'ticket_events', 'tickets']) {
      db.exec(`DROP TABLE IF EXISTS ${t}`);
    }
    // Pendaftaran mandiri sudah tidak ada: akun yang belum diverifikasi dinonaktifkan untuk ditinjau admin.
    db.exec(`UPDATE users SET status = 'disabled' WHERE role = 'employee' AND status IN ('pending','rejected')`);
  })();
  db.pragma('foreign_keys = ON');
}

db.exec(`
CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('employee','psychologist','admin')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pn TEXT UNIQUE,
  phone TEXT,
  unit_id INTEGER REFERENCES units(id),
  title TEXT,
  bio TEXT,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('pending','verified','rejected','disabled')),
  reject_reason TEXT,
  verified_at TEXT,
  verified_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS availability (
  id INTEGER PRIMARY KEY,
  psychologist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  modes TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_availability ON availability(date, psychologist_id);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  employee_id INTEGER NOT NULL REFERENCES users(id),
  unit_id INTEGER REFERENCES units(id),
  psychologist_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('scheduled','in_progress','awaiting_report','completed','no_show','cancelled')),
  mode TEXT NOT NULL CHECK (mode IN ('offline','chat','online')),
  scheduled_start TEXT NOT NULL,
  scheduled_end TEXT NOT NULL,
  room TEXT,
  meeting_url TEXT,
  nickname TEXT NOT NULL,
  topic TEXT NOT NULL,
  complaint TEXT NOT NULL,
  impact INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 10),
  expectation TEXT NOT NULL,
  screening TEXT NOT NULL,
  screening_score INTEGER NOT NULL,
  screening_level TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  reschedule_count INTEGER NOT NULL DEFAULT 0,
  reminder_sent_at TEXT,
  cancel_reason TEXT,
  cancelled_by INTEGER REFERENCES users(id),
  cancelled_at TEXT,
  started_at TEXT,
  ended_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_employee ON tickets(employee_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_tickets_psych ON tickets(psychologist_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status, scheduled_start);

CREATE TABLE IF NOT EXISTS ticket_events (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_ticket ON ticket_events(ticket_id);

CREATE TABLE IF NOT EXISTS reports (
  ticket_id INTEGER PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  psychologist_id INTEGER NOT NULL REFERENCES users(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('terminasi','lanjutan','referral','no_show')),
  goal TEXT,
  health_history TEXT,
  symptoms TEXT,
  summary TEXT,
  category TEXT,
  note_for_client TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  ticket_id INTEGER PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  answers TEXT NOT NULL,
  score INTEGER NOT NULL,
  level TEXT NOT NULL,
  helpful TEXT,
  suggestion TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  read_at TEXT,
  file_path TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON messages(ticket_id, id);
-- Jumlah pesan belum dibaca per sesi (daftar sesi) tanpa memeriksa semua pesan.
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(ticket_id, read_at, sender_id);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, id);

-- Chat bantuan ke admin (tombol chat melayang). Pengguna login punya satu percakapan; tamu dikenali lewat token.
CREATE TABLE IF NOT EXISTS support_threads (
  id INTEGER PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  guest_name TEXT,
  guest_pn TEXT,
  guest_token TEXT UNIQUE,
  last_message_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_support_threads_last ON support_threads(last_message_at);

CREATE TABLE IF NOT EXISTS support_messages (
  id INTEGER PRIMARY KEY,
  thread_id INTEGER NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  from_admin INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_support_messages_thread ON support_messages(thread_id, id);
CREATE INDEX IF NOT EXISTS idx_support_unread ON support_messages(thread_id, from_admin, read_at);

-- Pengaturan yang bisa diubah admin (nilai JSON per kunci).
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);
`);

// Kolom balasan otomatis chat bantuan (tabelnya sudah ada di database yang dibuat sebelum fitur ini).
const supportThreadCols = tableCols('support_threads');
if (!supportThreadCols.has('awaiting_since')) db.exec('ALTER TABLE support_threads ADD COLUMN awaiting_since TEXT');
if (!supportThreadCols.has('unavailable_sent_at')) db.exec('ALTER TABLE support_threads ADD COLUMN unavailable_sent_at TEXT');
if (!tableCols('support_messages').has('is_auto')) db.exec('ALTER TABLE support_messages ADD COLUMN is_auto INTEGER NOT NULL DEFAULT 0');

// Kolom tambahan pada tabel users (profil ekspresi diri, master data pekerja, profil psikolog).
const userCols = tableCols('users');
for (const [col, def] of [
  ['avatar_url', 'TEXT'],
  ['avatar_tone', 'TEXT'],
  ['status_text', 'TEXT'],
  ['nickname', 'TEXT'],
  ['band', 'TEXT'],
  ['region', 'TEXT'],
  ['gender', 'TEXT'],
  ['birth_date', 'TEXT'],
  ['specialization', 'TEXT'],
  ['approach', 'TEXT'],
  ['languages', 'TEXT'],
  ['meeting_url', 'TEXT'],
] as const) {
  if (!userCols.has(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
}

db.pragma(`user_version = ${SCHEMA_VERSION}`);

export const now = () => new Date().toISOString();

export function tx<T>(fn: () => T): T {
  return db.transaction(fn)();
}

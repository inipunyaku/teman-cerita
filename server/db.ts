import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','disabled')),
  reject_reason TEXT,
  verified_at TEXT,
  verified_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  employee_id INTEGER NOT NULL REFERENCES users(id),
  unit_id INTEGER REFERENCES units(id),
  psychologist_id INTEGER REFERENCES users(id),
  topic TEXT NOT NULL,
  story TEXT,
  preferred_mode TEXT NOT NULL,
  mode TEXT NOT NULL,
  urgency TEXT NOT NULL,
  preferred_slots TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  scheduled_start TEXT,
  scheduled_end TEXT,
  location TEXT,
  meeting_url TEXT,
  admin_note TEXT,
  cancel_reason TEXT,
  cancelled_by INTEGER REFERENCES users(id),
  first_scheduled_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_employee ON tickets(employee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_psych ON tickets(psychologist_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

CREATE TABLE IF NOT EXISTS ticket_events (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_ticket ON ticket_events(ticket_id);

CREATE TABLE IF NOT EXISTS reschedule_requests (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  requested_by INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  proposed_slots TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  response_note TEXT,
  decided_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS reports (
  ticket_id INTEGER PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  psychologist_id INTEGER NOT NULL REFERENCES users(id),
  severity TEXT NOT NULL CHECK (severity IN ('ringan','sedang','berat','kritis')),
  summary TEXT NOT NULL,
  recommendation TEXT,
  note_for_employee TEXT,
  follow_up INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS report_topics (
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  PRIMARY KEY (ticket_id, topic)
);

CREATE TABLE IF NOT EXISTS reviews (
  ticket_id INTEGER PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON messages(ticket_id, id);

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
`);

// Migrasi ringan: tambah kolom baru pada database yang sudah ada.
const userCols = new Set((db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name));
for (const [col, def] of [
  ['avatar_url', 'TEXT'],
  ['avatar_tone', 'TEXT'],
  ['status_text', 'TEXT'],
] as const) {
  if (!userCols.has(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
}

const messageCols = new Set((db.prepare('PRAGMA table_info(messages)').all() as { name: string }[]).map((c) => c.name));
for (const [col, def] of [
  ['file_path', 'TEXT'],
  ['file_name', 'TEXT'],
  ['file_type', 'TEXT'],
  ['file_size', 'INTEGER'],
] as const) {
  if (!messageCols.has(col)) db.exec(`ALTER TABLE messages ADD COLUMN ${col} ${def}`);
}

export const now = () => new Date().toISOString();

export function tx<T>(fn: () => T): T {
  return db.transaction(fn)();
}

import crypto from 'node:crypto';
import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db, now } from '../db.js';
import { requireRole } from '../auth.js';
import { publish } from '../events.js';
import { adminIds } from '../notify.js';
import { fail, intParam, parse } from '../util.js';
import { ROLE_LABEL } from '../../shared/constants.js';

/**
 * Chat bantuan ke admin lewat tombol chat melayang. Pengguna yang sudah masuk langsung memakai akunnya;
 * tamu (belum masuk) mengisi nama & PN lalu dikenali lewat token di header `x-support-token`.
 */
export const supportRouter = Router();

const TOKEN_HEADER = 'x-support-token';

interface ThreadRow {
  id: number;
  user_id: number | null;
  guest_name: string | null;
  guest_pn: string | null;
  guest_token: string | null;
  last_message_at: string | null;
  created_at: string;
}

interface MessageRow {
  id: number;
  threadId: number;
  fromAdmin: number;
  senderName: string | null;
  body: string;
  readAt: string | null;
  createdAt: string;
}

const MESSAGE_SQL = `SELECT m.id, m.thread_id AS threadId, m.from_admin AS fromAdmin, u.name AS senderName, m.body,
  m.read_at AS readAt, m.created_at AS createdAt FROM support_messages m LEFT JOIN users u ON u.id = m.sender_id`;

const serialize = (m: MessageRow) => ({ ...m, fromAdmin: !!m.fromAdmin });
const listMessages = (threadId: number) =>
  (db.prepare(`${MESSAGE_SQL} WHERE m.thread_id = ? ORDER BY m.id`).all(threadId) as MessageRow[]).map(serialize);

const guestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.' },
});
const sendLimiter = rateLimit({
  windowMs: 10 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Pesan terlalu cepat. Tunggu sebentar.' },
});

const bodySchema = z.object({ body: z.string().trim().min(1, 'Pesan kosong.').max(2000, 'Pesan terlalu panjang.') });

/** Percakapan milik peminta: akun yang login, atau tamu dengan token. `create` membuat percakapan akun bila belum ada. */
function ownThread(req: Request, create = false): ThreadRow | undefined {
  const u = req.user;
  if (u) {
    if (u.role === 'admin') fail(403, 'Admin membalas lewat menu Chat bantuan.');
    let t = db.prepare('SELECT * FROM support_threads WHERE user_id = ?').get(u.id) as ThreadRow | undefined;
    if (!t && create) {
      const id = db.prepare('INSERT INTO support_threads (user_id, created_at) VALUES (?, ?)').run(u.id, now()).lastInsertRowid;
      t = db.prepare('SELECT * FROM support_threads WHERE id = ?').get(id) as ThreadRow;
    }
    return t;
  }
  const token = String(req.headers[TOKEN_HEADER] ?? '');
  if (!token) return undefined;
  return db.prepare('SELECT * FROM support_threads WHERE guest_token = ? AND user_id IS NULL').get(token) as ThreadRow | undefined;
}

function threadSummary(t: ThreadRow) {
  const user = t.user_id
    ? (db
        .prepare('SELECT u.name, u.pn, u.role, u.email, u.avatar_url, u.avatar_tone, n.name AS unit FROM users u LEFT JOIN units n ON n.id = u.unit_id WHERE u.id = ?')
        .get(t.user_id) as { name: string; pn: string | null; role: keyof typeof ROLE_LABEL; email: string; avatar_url: string | null; avatar_tone: string | null; unit: string | null } | undefined)
    : undefined;
  // PN yang diketik tamu dicocokkan ke master data supaya admin tahu siapa yang menghubungi.
  const match =
    !t.user_id && t.guest_pn
      ? (db.prepare(`SELECT name FROM users WHERE pn = ? AND role = 'employee'`).get(t.guest_pn) as { name: string } | undefined)
      : undefined;
  const last = db.prepare(`${MESSAGE_SQL} WHERE m.thread_id = ? ORDER BY m.id DESC LIMIT 1`).get(t.id) as MessageRow | undefined;
  const { n } = db.prepare('SELECT COUNT(*) n FROM support_messages WHERE thread_id = ? AND from_admin = 0 AND read_at IS NULL').get(t.id) as { n: number };
  return {
    id: t.id,
    guest: !t.user_id,
    name: user?.name ?? t.guest_name ?? 'Tanpa nama',
    pn: user?.pn ?? t.guest_pn,
    role: user?.role ?? null,
    roleLabel: user ? ROLE_LABEL[user.role] : 'Tamu',
    email: user?.email ?? null,
    unitName: user?.unit ?? null,
    avatarUrl: user?.avatar_url ?? null,
    avatarTone: user?.avatar_tone ?? null,
    pnMatch: match?.name ?? null,
    lastMessage: last ? serialize(last) : null,
    lastMessageAt: t.last_message_at,
    unread: n,
    createdAt: t.created_at,
  };
}

function deliver(t: ThreadRow, senderId: number | null, fromAdmin: boolean, body: string) {
  const at = now();
  const id = db
    .prepare('INSERT INTO support_messages (thread_id, sender_id, from_admin, body, created_at) VALUES (?,?,?,?,?)')
    .run(t.id, senderId, fromAdmin ? 1 : 0, body, at).lastInsertRowid;
  db.prepare('UPDATE support_threads SET last_message_at = ? WHERE id = ?').run(at, t.id);
  const message = serialize(db.prepare(`${MESSAGE_SQL} WHERE m.id = ?`).get(id) as MessageRow);
  const name = t.user_id ? (db.prepare('SELECT name FROM users WHERE id = ?').get(t.user_id) as { name: string }).name : t.guest_name;
  const event = { threadId: t.id, message, name };
  publish(adminIds(), 'support', event);
  if (t.user_id) publish(t.user_id, 'support', event);
  return message;
}

// ---------------------------------------------------------------------------
// Sisi pengguna (pekerja, psikolog, atau tamu)

supportRouter.post('/guest', guestLimiter, (req, res) => {
  if (req.user) fail(400, 'Kamu sudah masuk — langsung kirim pesan saja.');
  const d = parse(
    z.object({
      name: z.string().trim().min(2, 'Isi nama kamu.').max(80, 'Nama terlalu panjang.'),
      pn: z.string().trim().regex(/^[0-9A-Za-z]{3,20}$/, 'PN tidak valid. Gunakan angka/huruf tanpa spasi.'),
    }),
    req.body,
  );
  const token = crypto.randomBytes(24).toString('hex');
  const id = db
    .prepare('INSERT INTO support_threads (guest_name, guest_pn, guest_token, created_at) VALUES (?,?,?,?)')
    .run(d.name, d.pn, token, now()).lastInsertRowid;
  const t = db.prepare('SELECT * FROM support_threads WHERE id = ?').get(id) as ThreadRow;
  res.status(201).json({ token, thread: { id: t.id, name: d.name, pn: d.pn } });
});

supportRouter.get('/me', (req, res) => {
  const t = ownThread(req);
  if (!t) {
    // Token tamu yang tidak dikenal (mis. sudah dihapus) → minta isi identitas lagi.
    if (!req.user && req.headers[TOKEN_HEADER]) return res.status(404).json({ error: 'Percakapan tidak ditemukan.', code: 'NO_THREAD' });
    return res.json({ thread: null, messages: [], unread: 0 });
  }
  const messages = listMessages(t.id);
  const unread = messages.filter((m) => m.fromAdmin && !m.readAt).length;
  res.json({ thread: { id: t.id, name: t.guest_name, pn: t.guest_pn }, messages, unread });
});

supportRouter.post('/me/messages', sendLimiter, (req, res) => {
  const { body } = parse(bodySchema, req.body);
  const t = ownThread(req, true);
  if (!t) fail(400, 'Isi nama dan PN dulu untuk mulai chat.', 'NO_THREAD');
  res.status(201).json({ message: deliver(t!, req.user?.id ?? null, false, body) });
});

supportRouter.post('/me/read', (req, res) => {
  const t = ownThread(req);
  if (t) {
    const changed = db.prepare('UPDATE support_messages SET read_at = ? WHERE thread_id = ? AND from_admin = 1 AND read_at IS NULL').run(now(), t.id).changes;
    if (changed) publish(adminIds(), 'support-read', { threadId: t.id });
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Sisi admin

const admin = Router();
admin.use(requireRole('admin'));

admin.get('/', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const rows = db.prepare('SELECT * FROM support_threads WHERE last_message_at IS NOT NULL ORDER BY last_message_at DESC LIMIT 200').all() as ThreadRow[];
  let threads = rows.map(threadSummary);
  if (q) {
    const needle = q.toLowerCase();
    threads = threads.filter((t) => t.name.toLowerCase().includes(needle) || (t.pn ?? '').toLowerCase().includes(needle));
  }
  const unread = threads.reduce((a, t) => a + (t.unread ? 1 : 0), 0);
  res.json({ threads, unread });
});

const getThread = (id: string) => {
  const t = db.prepare('SELECT * FROM support_threads WHERE id = ?').get(intParam(id)) as ThreadRow | undefined;
  if (!t) fail(404, 'Percakapan tidak ditemukan.');
  return t!;
};

admin.get('/:id', (req, res) => {
  const t = getThread(req.params.id);
  res.json({ thread: threadSummary(t), messages: listMessages(t.id) });
});

admin.post('/:id/messages', sendLimiter, (req, res) => {
  const t = getThread(req.params.id);
  const { body } = parse(bodySchema, req.body);
  res.status(201).json({ message: deliver(t, req.user!.id, true, body) });
});

admin.post('/:id/read', (req, res) => {
  const t = getThread(req.params.id);
  const changed = db.prepare('UPDATE support_messages SET read_at = ? WHERE thread_id = ? AND from_admin = 0 AND read_at IS NULL').run(now(), t.id).changes;
  if (changed) {
    publish(adminIds(), 'support-read', { threadId: t.id });
    if (t.user_id) publish(t.user_id, 'support-read', { threadId: t.id });
  }
  res.json({ ok: true });
});

supportRouter.use('/threads', admin);

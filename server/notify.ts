import { config } from './config.js';
import { db, now } from './db.js';
import { publish } from './events.js';
import { sendMail } from './mail.js';

interface Notice {
  type: string;
  title: string;
  body?: string;
  link?: string;
  priority?: boolean;
  /** false = hanya in-app (mis. pesan chat). Admin selalu hanya in-app. */
  email?: boolean;
}

const insert = db.prepare(
  `INSERT INTO notifications (user_id, type, title, body, link, priority, created_at) VALUES (?,?,?,?,?,?,?)`,
);
const getRecipient = db.prepare(`SELECT id, name, email, role FROM users WHERE id = ? AND status != 'disabled'`);

export function notify(userIds: number | number[], n: Notice) {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
  for (const id of ids) {
    const user = getRecipient.get(id) as { id: number; name: string; email: string; role: string } | undefined;
    if (!user) continue;
    const createdAt = now();
    const info = insert.run(id, n.type, n.title, n.body ?? null, n.link ?? null, n.priority ? 1 : 0, createdAt);
    publish(id, 'notification', {
      id: Number(info.lastInsertRowid),
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
      priority: !!n.priority,
      readAt: null,
      createdAt,
    });
    if (n.email !== false && user.role !== 'admin') {
      void sendMail({
        to: { email: user.email, name: user.name },
        subject: `${n.title} — Teman Cerita`,
        heading: n.title,
        body: `Halo ${user.name.split(' ')[0]},\n${n.body ?? ''}`,
        cta: n.link ? { label: 'Buka Teman Cerita', url: config.appUrl + n.link } : undefined,
      });
    }
  }
}

export function adminIds(): number[] {
  return (db.prepare(`SELECT id FROM users WHERE role = 'admin' AND status = 'verified'`).all() as { id: number }[]).map(
    (r) => r.id,
  );
}

const fmt = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
});

export function formatWhen(iso: string | null) {
  return iso ? `${fmt.format(new Date(iso))} WIB` : '-';
}

import { Router } from 'express';
import { db, now } from '../db.js';
import { requireAuth } from '../auth.js';
import { intParam } from '../util.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', (req, res) => {
  const uid = req.user!.id;
  const items = db
    .prepare(
      `SELECT id, type, title, body, link, priority, read_at AS readAt, created_at AS createdAt
       FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 60`,
    )
    .all(uid) as { priority: number }[];
  const { n } = db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(uid) as { n: number };
  res.json({ items: items.map((i) => ({ ...i, priority: !!i.priority })), unread: n });
});

notificationsRouter.post('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(now(), req.user!.id);
  res.json({ ok: true });
});

notificationsRouter.post('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL').run(
    now(),
    intParam(req.params.id),
    req.user!.id,
  );
  res.json({ ok: true });
});

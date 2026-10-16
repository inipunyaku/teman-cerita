import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../auth.js';

export const statsRouter = Router();

const RANGES: Record<string, number | null> = { '30': 30, '90': 90, '365': 365, all: null };

statsRouter.get('/', requireRole('admin'), (req, res) => {
  const range = String(req.query.range ?? '90');
  const days = range in RANGES ? RANGES[range] : 90;
  const since = days ? new Date(Date.now() - days * 864e5).toISOString() : '0000';
  const all = <T>(sql: string, ...p: unknown[]) => db.prepare(sql).all(since, ...p) as T[];
  const get = <T>(sql: string, ...p: unknown[]) => db.prepare(sql).get(since, ...p) as T;

  const kpi = get<Record<string, number | null>>(
    `SELECT COUNT(*) AS total,
       SUM(status = 'pending') AS pending,
       SUM(status IN ('scheduled','reschedule_requested','in_progress')) AS active,
       SUM(status = 'completed') AS completed,
       SUM(status = 'cancelled') AS cancelled,
       SUM(urgency = 'high') AS urgent,
       ROUND(AVG(CASE WHEN first_scheduled_at IS NOT NULL THEN (julianday(first_scheduled_at) - julianday(created_at)) * 24 END), 1) AS avgWaitHours
     FROM tickets WHERE created_at >= ?`,
  );
  const quality = get<Record<string, number | null>>(
    `SELECT ROUND(AVG(rv.rating), 2) AS avgRating, COUNT(rv.rating) AS reviews,
       ROUND(100.0 * SUM(r.follow_up) / NULLIF(COUNT(r.ticket_id), 0), 0) AS followUpRate,
       SUM(r.severity IN ('berat','kritis')) AS severeCount
     FROM tickets t LEFT JOIN reports r ON r.ticket_id = t.id LEFT JOIN reviews rv ON rv.ticket_id = t.id
     WHERE t.created_at >= ?`,
  );

  const severity = all(
    `SELECT r.severity AS key, COUNT(*) AS value FROM reports r JOIN tickets t ON t.id = r.ticket_id
     WHERE t.created_at >= ? GROUP BY r.severity`,
  );
  const topics = all(
    `SELECT rt.topic AS key, COUNT(*) AS value FROM report_topics rt JOIN tickets t ON t.id = rt.ticket_id
     WHERE t.created_at >= ? GROUP BY rt.topic ORDER BY value DESC`,
  );
  const requestTopics = all(
    `SELECT topic AS key, COUNT(*) AS value FROM tickets WHERE created_at >= ? GROUP BY topic ORDER BY value DESC`,
  );
  const modes = all(`SELECT mode AS key, COUNT(*) AS value FROM tickets WHERE created_at >= ? AND status != 'cancelled' GROUP BY mode`);
  const units = all(
    `SELECT u.id, u.name, COUNT(t.id) AS total,
       SUM(r.severity IN ('berat','kritis')) AS severe,
       SUM(r.severity = 'ringan') AS ringan, SUM(r.severity = 'sedang') AS sedang,
       SUM(r.severity = 'berat') AS berat, SUM(r.severity = 'kritis') AS kritis
     FROM tickets t JOIN units u ON u.id = t.unit_id LEFT JOIN reports r ON r.ticket_id = t.id
     WHERE t.created_at >= ? GROUP BY u.id ORDER BY total DESC`,
  );
  const matrix = all(
    `SELECT t.unit_id AS unitId, rt.topic, COUNT(*) AS value FROM report_topics rt JOIN tickets t ON t.id = rt.ticket_id
     WHERE t.created_at >= ? AND t.unit_id IS NOT NULL GROUP BY t.unit_id, rt.topic`,
  );

  // Tren selalu 6 bulan terakhir agar bentuknya terbaca, terlepas dari filter.
  const trend = db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS requests,
         SUM(status = 'completed') AS completed,
         (SELECT COUNT(*) FROM reports r JOIN tickets t2 ON t2.id = r.ticket_id
            WHERE strftime('%Y-%m', t2.created_at) = strftime('%Y-%m', tickets.created_at) AND r.severity IN ('berat','kritis')) AS severe
       FROM tickets WHERE created_at >= date('now', 'start of month', '-5 months') GROUP BY month ORDER BY month`,
    )
    .all();

  const psychologists = all(
    `SELECT p.id, p.name, p.title, p.avatar_url AS avatarUrl, p.avatar_tone AS avatarTone,
       SUM(t.status = 'completed') AS completed,
       SUM(t.status IN ('scheduled','reschedule_requested','in_progress')) AS active,
       ROUND(AVG(rv.rating), 2) AS rating
     FROM users p LEFT JOIN tickets t ON t.psychologist_id = p.id AND t.created_at >= ?
     LEFT JOIN reviews rv ON rv.ticket_id = t.id
     WHERE p.role = 'psychologist' AND p.status = 'verified' GROUP BY p.id ORDER BY completed DESC`,
  );

  res.json({ range, kpi: { ...kpi, ...quality }, severity, topics, requestTopics, modes, units, matrix, trend, psychologists });
});

import { Router } from 'express';
import { db } from '../db.js';
import { publicUser, requireRole, type UserRow } from '../auth.js';
import { fail, intParam, pageParams } from '../util.js';

// Psikolog: semua peserta (pekerja yang pernah mendaftar konseling).
// Klien sendiri (pernah/akan sesi dengan psikolog ini) → catatan klinis lengkap seperti riwayat sesi.
// Peserta lain → hanya skrining awal & catatan untuk klien.
export const psychRouter = Router();
psychRouter.use(requireRole('psychologist'));

interface ClientRow {
  id: number;
  name: string;
  pn: string | null;
  unitName: string | null;
  avatarUrl: string | null;
  avatarTone: string | null;
  sessionCount: number;
  lastSessionAt: string;
  mine: number;
  screeningLevel: string | null;
  screeningScore: number | null;
}

psychRouter.get('/clients', (req, res) => {
  const viewer = req.user!;
  const q = req.query as Record<string, string | undefined>;
  const where = [`u.role = 'employee'`];
  const params: unknown[] = [];
  if (q.q) {
    where.push('(u.name LIKE ? OR u.pn LIKE ? OR u.nickname LIKE ?)');
    params.push(...Array(3).fill(`%${q.q}%`));
  }
  if (q.unit) where.push('u.unit_id = ?'), params.push(Number(q.unit));
  const having = q.scope === 'mine' ? ' HAVING mine = 1' : q.scope === 'others' ? ' HAVING mine = 0' : '';
  // Skrining terakhir diambil dari pendaftaran terbaru pekerja.
  const base = `SELECT u.id, u.name, u.pn, un.name AS unitName, u.avatar_url AS avatarUrl, u.avatar_tone AS avatarTone,
      COUNT(t.id) AS sessionCount, MAX(t.scheduled_start) AS lastSessionAt,
      MAX(t.psychologist_id = ? AND t.status != 'cancelled') AS mine,
      (SELECT t2.screening_level FROM tickets t2 WHERE t2.employee_id = u.id ORDER BY t2.scheduled_start DESC LIMIT 1) AS screeningLevel,
      (SELECT t2.screening_score FROM tickets t2 WHERE t2.employee_id = u.id ORDER BY t2.scheduled_start DESC LIMIT 1) AS screeningScore
    FROM users u JOIN tickets t ON t.employee_id = u.id LEFT JOIN units un ON un.id = u.unit_id
    WHERE ${where.join(' AND ')}
    GROUP BY u.id${having}`;
  const args = [viewer.id, ...params];
  const pg = pageParams(q);
  const rows = db
    .prepare(`${base} ORDER BY mine DESC, lastSessionAt DESC ${pg ? `LIMIT ${pg.size} OFFSET ${pg.offset}` : 'LIMIT 1000'}`)
    .all(...args) as ClientRow[];
  const clients = rows.map((c) => ({ ...c, mine: c.mine === 1 }));
  if (!pg) return res.json({ clients });
  const { n } = db.prepare(`SELECT COUNT(*) n FROM (${base})`).get(...args) as { n: number };
  res.json({ clients, total: n, page: pg.page, pageSize: pg.size });
});

psychRouter.get('/clients/:id', (req, res) => {
  const viewer = req.user!;
  const id = intParam(req.params.id);
  const u = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'employee'`).get(id) as UserRow | undefined;
  if (!u) return fail(404, 'Peserta tidak ditemukan.');
  const mine = !!db
    .prepare(`SELECT 1 FROM tickets WHERE employee_id = ? AND psychologist_id = ? AND status != 'cancelled' LIMIT 1`)
    .get(id, viewer.id);

  type Row = {
    id: number; code: string; status: string; scheduledStart: string; mode: string; psychologistId: number; psychologistName: string; outcome: string | null;
    topic: string; screening: string; screeningScore: number; screeningLevel: string;
    goal: string | null; healthHistory: string | null; symptoms: string | null; summary: string | null; category: string | null; noteForClient: string | null;
  };
  const rows = db
    .prepare(
      `SELECT t.id, t.code, t.status, t.scheduled_start AS scheduledStart, t.mode, t.psychologist_id AS psychologistId, p.name AS psychologistName, r.outcome,
              t.topic, t.screening, t.screening_score AS screeningScore, t.screening_level AS screeningLevel,
              r.goal, r.health_history AS healthHistory, r.symptoms, r.summary, r.category, r.note_for_client AS noteForClient
       FROM tickets t JOIN users p ON p.id = t.psychologist_id LEFT JOIN reports r ON r.ticket_id = t.id
       WHERE t.employee_id = ? ORDER BY t.scheduled_start DESC LIMIT 50`,
    )
    .all(id) as Row[];
  const sessions = rows.map((h) => {
    const base = {
      id: h.id, code: h.code, status: h.status, scheduledStart: h.scheduledStart, mode: h.mode, psychologistName: h.psychologistName,
      own: h.psychologistId === viewer.id,
      screening: JSON.parse(h.screening) as number[], screeningScore: h.screeningScore, screeningLevel: h.screeningLevel,
      outcome: null as string | null,
    };
    if (mine) {
      return {
        ...base,
        topic: h.topic,
        outcome: h.outcome,
        report: h.outcome
          ? { outcome: h.outcome, goal: h.goal, healthHistory: h.healthHistory, symptoms: h.symptoms, summary: h.summary, category: h.category, noteForClient: h.noteForClient }
          : undefined,
      };
    }
    return { ...base, report: h.noteForClient ? { noteForClient: h.noteForClient } : undefined };
  });

  const p = publicUser(u);
  res.json({
    client: {
      id: p.id, name: p.name, pn: p.pn, unitName: p.unitName, nickname: p.nickname, avatarUrl: p.avatarUrl, avatarTone: p.avatarTone,
      gender: p.gender, birthDate: p.birthDate, band: p.band, region: p.region,
    },
    mine,
    sessions,
  });
});

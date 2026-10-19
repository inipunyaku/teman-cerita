import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../auth.js';
import { dayCapacity, wibIso, wibParts } from '../scheduling.js';

export const statsRouter = Router();

interface Row {
  id: number;
  employee_id: number;
  psychologist_id: number;
  status: string;
  mode: string;
  scheduled_start: string;
  reschedule_count: number;
  screening_level: string;
  band: string | null;
  region: string | null;
  gender: string | null;
  birth_date: string | null;
  unit_name: string | null;
  outcome: string | null;
  category: string | null;
  feedback: number | null;
  month: string;
}

type KV = { key: string; value: number };
const FEEDBACK_MAX = 32;

const countBy = <T>(rows: T[], key: (r: T) => string | null | undefined): KV[] => {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) || 'Tidak diisi';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].map(([k, value]) => ({ key: k, value })).sort((a, b) => b.value - a.value);
};

/** Tabel silang: baris = grup (band/region/unit/bulan), kolom = kategori. */
const crossTab = <T>(rows: T[], group: (r: T) => string | null | undefined, key: (r: T) => string | null | undefined) => {
  const m = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const g = group(r) || 'Tidak diisi';
    const k = key(r) || 'Tidak diisi';
    const cell = m.get(g) ?? {};
    cell[k] = (cell[k] ?? 0) + 1;
    m.set(g, cell);
  }
  return [...m]
    .map(([g, values]) => ({ group: g, values, total: Object.values(values).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);
};

const unique = <T>(rows: T[], key: (r: T) => number) => {
  const seen = new Set<number>();
  return rows.filter((r) => (seen.has(key(r)) ? false : (seen.add(key(r)), true)));
};
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function ageBucket(birth: string | null) {
  if (!birth) return 'Tidak diisi';
  const age = Math.floor((Date.now() - Date.parse(`${birth}T00:00:00Z`)) / (365.25 * 864e5));
  if (age < 25) return '< 25';
  if (age < 35) return '25–34';
  if (age < 45) return '35–44';
  if (age < 55) return '45–54';
  return '≥ 55';
}

const HELD = new Set(['completed', 'awaiting_report']);

statsRouter.get('/', requireRole('admin'), (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Math.min(12, Math.max(0, Number(req.query.month) || 0));
  const monthKey = month ? `${year}-${String(month).padStart(2, '0')}` : null;
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

  const all = (
    db
      .prepare(
        `SELECT t.id, t.employee_id, t.psychologist_id, t.status, t.mode, t.scheduled_start, t.reschedule_count, t.screening_level,
           e.band, e.region, e.gender, e.birth_date, un.name AS unit_name, r.outcome, r.category, f.score AS feedback
         FROM tickets t JOIN users e ON e.id = t.employee_id LEFT JOIN units un ON un.id = t.unit_id
         LEFT JOIN reports r ON r.ticket_id = t.id LEFT JOIN feedback f ON f.ticket_id = t.id
         WHERE t.scheduled_start >= ? AND t.scheduled_start < ?`,
      )
      .all(wibIso(`${year}-01-01`, '00:00'), wibIso(`${year + 1}-01-01`, '00:00')) as Omit<Row, 'month'>[]
  ).map((r) => ({ ...r, month: wibParts(r.scheduled_start).date.slice(0, 7) }));

  // Kapasitas slot per psikolog per bulan, dihitung dari blok ketersediaan.
  const blocks = db
    .prepare(`SELECT psychologist_id, date, start_time, end_time FROM availability WHERE date >= ? AND date <= ?`)
    .all(`${year}-01-01`, `${year}-12-31`) as { psychologist_id: number; date: string; start_time: string; end_time: string }[];
  const byDay = new Map<string, typeof blocks>();
  for (const b of blocks) byDay.set(`${b.psychologist_id}|${b.date}`, [...(byDay.get(`${b.psychologist_id}|${b.date}`) ?? []), b]);
  const capacity: { psych: number; month: string; n: number }[] = [...byDay].map(([k, bs]) => {
    const [psych, date] = k.split('|');
    return { psych: Number(psych), month: date.slice(0, 7), n: dayCapacity(date, bs) };
  });
  const capOf = (filter: (c: (typeof capacity)[number]) => boolean) => capacity.filter(filter).reduce((a, c) => a + c.n, 0);

  const inPeriod = (m: string) => !monthKey || m === monthKey;
  const P = all.filter((r) => inPeriod(r.month));
  const live = P.filter((r) => r.status !== 'cancelled');
  const clients = unique(live, (r) => r.employee_id);
  const fb = P.filter((r) => r.feedback != null).map((r) => r.feedback!);
  const now = new Date().toISOString();
  const periodCap = capOf((c) => inPeriod(c.month));

  const overview = {
    clients: clients.length,
    completed: P.filter((r) => r.status === 'completed').length,
    bookings: P.length,
    upcoming: P.filter((r) => r.status === 'scheduled' && r.scheduled_start > now).length,
    cancelRate: pct(P.filter((r) => r.status === 'cancelled').length, P.length),
    noShowRate: pct(P.filter((r) => r.status === 'no_show').length, live.length),
    rescheduleRate: pct(P.filter((r) => r.reschedule_count > 0).length, P.length),
    utilization: pct(live.length, periodCap),
    capacity: periodCap,
    satisfaction: { rate: pct(avg(fb) ?? 0, FEEDBACK_MAX), avgScore: avg(fb) && Math.round(avg(fb)! * 10) / 10, responses: fb.length },
    gender: countBy(clients, (r) => r.gender),
    age: countBy(clients, (r) => ageBucket(r.birth_date)),
    modes: countBy(live, (r) => r.mode),
  };

  const trend = months.map((m) => {
    const rows = all.filter((r) => r.month === m);
    const lv = rows.filter((r) => r.status !== 'cancelled');
    const f = rows.filter((r) => r.feedback != null).map((r) => r.feedback!);
    return {
      month: m,
      clients: unique(lv, (r) => r.employee_id).length,
      sessions: rows.filter((r) => HELD.has(r.status)).length,
      bookings: rows.length,
      utilization: pct(lv.length, capOf((c) => c.month === m)),
      satisfaction: f.length ? pct(avg(f)!, FEEDBACK_MAX) : null,
    };
  });

  const reported = P.filter((r) => r.category && r.outcome !== 'no_show');
  const reportedYear = all.filter((r) => r.category && r.outcome !== 'no_show');
  const breakdown = <T extends Row>(rows: T[], yearRows: T[], key: (r: T) => string | null) => ({
    total: countBy(rows, key),
    band: crossTab(rows, (r) => r.band, key),
    region: crossTab(rows, (r) => r.region, key),
    unit: crossTab(rows, (r) => r.unit_name, key),
    month: months.map((m) => ({ group: m, values: Object.fromEntries(countBy(yearRows.filter((r) => r.month === m), key).map((x) => [x.key, x.value])) })),
  });

  const count = (s: string) => P.filter((r) => r.status === s).length;
  const outcome = (o: string) => P.filter((r) => r.outcome === o).length;
  const monitoring = {
    upcoming: count('scheduled'),
    inProgress: count('in_progress'),
    completed: count('completed'),
    cancelled: count('cancelled'),
    noShow: count('no_show'),
    followUp: outcome('lanjutan'),
    terminasi: outcome('terminasi'),
    referral: outcome('referral'),
    awaitingReport: count('awaiting_report'),
  };

  const done = P.filter((r) => ['completed', 'awaiting_report'].includes(r.status));
  const outcomes = {
    total: done.length,
    terminasi: outcome('terminasi'),
    lanjutan: outcome('lanjutan'),
    referral: outcome('referral'),
    pending: count('awaiting_report'),
  };

  const psychRows = db
    .prepare(
      `SELECT id, name, title, status, avatar_url AS avatarUrl, avatar_tone AS avatarTone FROM users WHERE role = 'psychologist' ORDER BY name`,
    )
    .all() as { id: number; name: string; title: string | null; status: string; avatarUrl: string | null; avatarTone: string | null }[];
  const psychologists = psychRows
    .map((p) => {
      const mine = live.filter((r) => r.psychologist_id === p.id);
      const slots = capOf((c) => c.psych === p.id && inPeriod(c.month));
      return {
        ...p,
        slots,
        booked: mine.length,
        remaining: Math.max(0, slots - mine.length),
        utilization: pct(mine.length, slots),
        sessions: mine.filter((r) => HELD.has(r.status)).length,
        upcoming: mine.filter((r) => r.status === 'scheduled').length,
        satisfaction: (() => {
          const f = mine.filter((r) => r.feedback != null).map((r) => r.feedback!);
          return f.length ? pct(avg(f)!, FEEDBACK_MAX) : null;
        })(),
      };
    })
    .filter((p) => p.status === 'verified' || p.booked > 0);

  res.json({
    period: { year, month: month || null },
    overview,
    trend,
    clientsByBand: countBy(clients, (r) => r.band),
    clientsByRegion: countBy(clients, (r) => r.region),
    problems: breakdown(reported, reportedYear, (r) => r.category),
    screening: breakdown(live, all.filter((r) => r.status !== 'cancelled'), (r) => r.screening_level),
    monitoring,
    outcomes,
    psychologists,
  });
});

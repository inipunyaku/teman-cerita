import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { db } from '../../server/db.js';
import { wibIso } from '../../server/scheduling.js';
import { addBlock, app, as, bookingBody, freezeTime, insertReport, insertTicket, makeUnit, makeUser, setNow } from './helpers.js';

afterAll(() => vi.useRealTimers());

describe('statistik admin', () => {
  const c = {} as Record<string, number>;
  beforeAll(() => {
    freezeTime();
    c.admin = makeUser('admin');
    const unit = makeUnit('Unit Statistik');
    c.p = makeUser('psychologist', { name: 'Psi Statistik' });
    makeUser('psychologist', { name: 'Psi Nonaktif', status: 'disabled' });
    c.e1 = makeUser('employee', { band: 'Band 1', region: 'Jakarta', gender: 'L', birth_date: '1990-01-01', unit_id: unit });
    c.e2 = makeUser('employee', { band: 'Band 2', region: 'Bandung', gender: 'P', birth_date: '2003-06-01' });
    addBlock(c.p, '2026-10-05');
    addBlock(c.p, '2026-11-03');
    c.t1 = insertTicket({ employeeId: c.e1, psychologistId: c.p, start: wibIso('2026-10-05', '09:00'), status: 'completed', unitId: unit });
    insertReport(c.t1, c.p, { outcome: 'lanjutan', category: 'beban_kerja' });
    db.prepare(`INSERT INTO feedback (ticket_id, answers, score, level, created_at) VALUES (?, '[]', 30, 'tinggi', '')`).run(c.t1);
    c.t2 = insertTicket({ employeeId: c.e2, psychologistId: c.p, start: wibIso('2026-10-05', '13:00'), status: 'no_show' });
    insertReport(c.t2, c.p, { outcome: 'no_show', category: null });
    c.t3 = insertTicket({ employeeId: c.e2, psychologistId: c.p, start: wibIso('2026-11-03', '09:00'), status: 'scheduled' });
    c.t4 = insertTicket({ employeeId: c.e1, psychologistId: c.p, start: wibIso('2026-11-03', '13:00'), status: 'cancelled' });
    c.t5 = insertTicket({ employeeId: c.e1, psychologistId: c.p, start: wibIso('2026-10-05', '15:00'), status: 'awaiting_report', mode: 'chat' });
  });

  it('hanya admin', async () => {
    expect((await as(c.p).get('/api/stats')).status).toBe(403);
    expect((await as(c.e1).get('/api/stats')).status).toBe(403);
  });

  it('ringkasan setahun', async () => {
    const s = (await as(c.admin).get('/api/stats?year=2026')).body;
    expect(s.period).toEqual({ year: 2026, month: null });
    expect(s.overview).toMatchObject({
      clients: 2,
      completed: 1,
      bookings: 5,
      upcoming: 1,
      cancelRate: 20,
      noShowRate: 25,
      rescheduleRate: 0,
      capacity: 8,
      utilization: 50,
      satisfaction: { rate: 93.8, avgScore: 30, responses: 1 },
    });
    expect(s.overview.modes).toEqual([{ key: 'offline', value: 3 }, { key: 'chat', value: 1 }]);
    expect(s.overview.gender).toEqual(expect.arrayContaining([{ key: 'L', value: 1 }, { key: 'P', value: 1 }]));
    expect(s.overview.age).toEqual(expect.arrayContaining([{ key: '35–44', value: 1 }, { key: '< 25', value: 1 }]));
    expect(s.monitoring).toEqual({ upcoming: 1, inProgress: 0, completed: 1, cancelled: 1, noShow: 1, followUp: 1, terminasi: 0, referral: 0, awaitingReport: 1 });
    expect(s.outcomes).toEqual({ total: 2, terminasi: 0, lanjutan: 1, referral: 0, pending: 1 });
    expect(s.problems.total).toEqual([{ key: 'beban_kerja', value: 1 }]);
    expect(s.problems.unit).toEqual([{ group: 'Unit Statistik', values: { beban_kerja: 1 }, total: 1 }]);
    expect(s.clientsByBand).toEqual(expect.arrayContaining([{ key: 'Band 1', value: 1 }, { key: 'Band 2', value: 1 }]));
    expect(s.screening.total).toEqual([{ key: 'rendah', value: 4 }]);

    const oct = s.trend.find((t: { month: string }) => t.month === '2026-10');
    expect(oct).toEqual({ month: '2026-10', clients: 2, sessions: 2, bookings: 3, utilization: 75, satisfaction: 93.8 });
    const nov = s.trend.find((t: { month: string }) => t.month === '2026-11');
    expect(nov).toEqual({ month: '2026-11', clients: 1, sessions: 0, bookings: 2, utilization: 25, satisfaction: null });
    expect(s.trend).toHaveLength(12);

    expect(s.psychologists).toHaveLength(1);
    expect(s.psychologists[0]).toMatchObject({ name: 'Psi Statistik', slots: 8, booked: 4, remaining: 4, utilization: 50, sessions: 2, upcoming: 1, satisfaction: 93.8 });
  });

  it('filter bulan', async () => {
    const s = (await as(c.admin).get('/api/stats?year=2026&month=10')).body;
    expect(s.period).toEqual({ year: 2026, month: 10 });
    expect(s.overview).toMatchObject({ bookings: 3, clients: 2, capacity: 4, utilization: 75, cancelRate: 0 });
    // Tren tetap setahun penuh.
    expect(s.trend.find((t: { month: string }) => t.month === '2026-11').bookings).toBe(2);
  });

  it('periode tanpa data: rasio kosong (null), bukan 0%', async () => {
    const s = (await as(c.admin).get('/api/stats?year=2025')).body;
    expect(s.overview).toMatchObject({ bookings: 0, clients: 0, cancelRate: null, utilization: null, capacity: 0 });
    expect(s.overview.satisfaction).toEqual({ rate: null, avgScore: null, responses: 0 });
  });

  it('tahun bawaan mengikuti tanggal WIB', async () => {
    // 31 Des 2026 18.00 UTC = 1 Jan 2027 01.00 WIB.
    setNow('2026-12-31T18:00:00.000Z');
    const s = (await as(c.admin).get('/api/stats')).body;
    expect(s.period.year).toBe(2027);
    freezeTime();
  });

  it('kode tiket memakai tahun WIB', async () => {
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    addBlock(p, '2027-01-04');
    setNow('2026-12-31T18:00:00.000Z');
    const r = await as(e).post('/api/tickets').send(bookingBody({ psychologistId: p, date: '2027-01-04', time: '09:00' }));
    expect(r.status).toBe(201);
    expect(r.body.ticket.code).toBe('TC-2027-00001');
    freezeTime();
  });
});

describe('admin: ringkasan & psikolog', () => {
  it('overview & daftar psikolog', async () => {
    freezeTime();
    const admin = makeUser('admin');
    const o = (await as(admin).get('/api/admin/overview')).body;
    expect(o).toEqual({ awaitingReport: expect.any(Number), today: expect.any(Number), upcoming: expect.any(Number) });
    const list = (await as(admin).get('/api/admin/psychologists')).body.psychologists;
    const ps = list.find((p: { name: string }) => p.name === 'Psi Statistik');
    expect(ps).toMatchObject({ awaiting: 1, completed: 1, satisfaction: 30, openBlocks: 1 });
    // Nonaktif di urutan paling bawah.
    expect(list.at(-1).status).toBe('disabled');
    expect((await request(app).get('/api/admin/overview')).status).toBe(401);
  });
});

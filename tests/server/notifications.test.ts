import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../server/db.js';
import { notify } from '../../server/notify.js';
import { startJobs } from '../../server/jobs.js';
import { wibIso } from '../../server/scheduling.js';
import { as, freezeTime, insertTicket, makeUser } from './helpers.js';

beforeEach(() => freezeTime());
afterAll(() => vi.useRealTimers());

describe('notifikasi', () => {
  it('daftar, jumlah belum dibaca, tandai dibaca (hanya milik sendiri)', async () => {
    const u = makeUser('employee');
    const other = makeUser('employee');
    notify(u, { type: 'a', title: 'Satu', priority: true, email: false });
    notify(u, { type: 'b', title: 'Dua', body: 'isi', link: '/x', email: false });
    notify(other, { type: 'c', title: 'Milik orang lain', email: false });

    const r = (await as(u).get('/api/notifications')).body;
    expect(r.unread).toBe(2);
    expect(r.items.map((i: { title: string }) => i.title)).toEqual(['Dua', 'Satu']);
    expect(r.items[1]).toMatchObject({ priority: true, readAt: null });
    expect(r.items[0]).toMatchObject({ priority: false, body: 'isi', link: '/x' });

    const theirs = db.prepare('SELECT id FROM notifications WHERE user_id = ?').pluck().get(other) as number;
    await as(u).post(`/api/notifications/${theirs}/read`);
    expect((await as(other).get('/api/notifications')).body.unread).toBe(1);

    await as(u).post(`/api/notifications/${r.items[0].id}/read`);
    expect((await as(u).get('/api/notifications')).body.unread).toBe(1);
    await as(u).post('/api/notifications/read-all');
    expect((await as(u).get('/api/notifications')).body.unread).toBe(0);
    expect((await as(u).post('/api/notifications/abc/read')).status).toBe(404);
  });

  it('maks. 60 item terbaru; akun nonaktif tidak menerima notifikasi', async () => {
    const u = makeUser('employee');
    for (let i = 0; i < 65; i++) notify(u, { type: 't', title: `N${i}`, email: false });
    const r = (await as(u).get('/api/notifications')).body;
    expect(r.items).toHaveLength(60);
    expect(r.items[0].title).toBe('N64');
    expect(r.unread).toBe(65);

    const off = makeUser('employee', { status: 'disabled' });
    notify([off, off], { type: 't', title: 'x', email: false });
    expect(db.prepare('SELECT COUNT(*) FROM notifications WHERE user_id = ?').pluck().get(off)).toBe(0);
  });
});

describe('tugas berkala', () => {
  it('menutup sesi yang lewat & mengirim pengingat H-1', () => {
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    const ended = insertTicket({ employeeId: e, psychologistId: p, start: wibIso('2026-10-30', '09:00') });
    const soon = insertTicket({ employeeId: e, psychologistId: p, start: wibIso('2026-11-03', '06:00') });
    db.prepare('UPDATE tickets SET created_at = ? WHERE id = ?').run('2026-10-01T00:00:00.000Z', soon);
    const fresh = insertTicket({ employeeId: makeUser('employee'), psychologistId: p, start: wibIso('2026-11-02', '13:00') });
    const far = insertTicket({ employeeId: e, psychologistId: p, start: wibIso('2026-11-10', '09:00') });

    startJobs();

    const st = (id: number) => db.prepare('SELECT status, reminder_sent_at FROM tickets WHERE id = ?').get(id) as { status: string; reminder_sent_at: string | null };
    expect(st(ended).status).toBe('awaiting_report');
    expect(st(soon).reminder_sent_at).not.toBeNull();
    expect(st(fresh).reminder_sent_at).not.toBeNull();
    expect(st(far).reminder_sent_at).toBeNull();
    const types = (uid: number) => (db.prepare('SELECT type FROM notifications WHERE user_id = ?').all(uid) as { type: string }[]).map((r) => r.type);
    expect(types(p).filter((t) => t === 'session.report_due')).toHaveLength(1);
    // Pengingat pekerja hanya untuk booking yang dibuat lebih dari 24 jam sebelum sesi.
    expect(types(e)).toEqual(['ticket.reminder']);
    expect(db.prepare(`SELECT message FROM ticket_events WHERE ticket_id = ?`).pluck().get(ended)).toMatch(/berakhir/);
  });
});

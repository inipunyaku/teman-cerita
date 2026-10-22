import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../server/db.js';
import { wibIso } from '../../server/scheduling.js';
import { FEEDBACK_ITEMS } from '../../shared/constants.js';
import { as, freezeTime, insertReport, insertTicket, makeUnit, makeUser, MONDAY, setNow } from './helpers.js';

beforeEach(() => freezeTime());
afterAll(() => vi.useRealTimers());

type T = { id: number; code: string; status: string; nickname: string; scheduledStart: string };
const ids = (res: { body: { tickets: T[] } }) => res.body.tickets.map((t) => t.id).sort((a, b) => a - b);
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);

describe('daftar tiket: filter & pagination', () => {
  const ctx = {} as Record<string, number>;
  beforeAll(() => {
    freezeTime();
    const unit = makeUnit('Unit Daftar');
    ctx.admin = makeUser('admin');
    ctx.p = makeUser('psychologist');
    ctx.p2 = makeUser('psychologist');
    ctx.e1 = makeUser('employee', { name: 'Andi Wijaya', pn: '5550001', unit_id: unit });
    ctx.e2 = makeUser('employee', { name: 'Budi Santoso', pn: '5550002' });
    const mk = (employeeId: number, date: string, status: Parameters<typeof insertTicket>[0]['status'], psychologistId = ctx.p, nickname = 'Klien') =>
      insertTicket({ employeeId, psychologistId, start: wibIso(date, '09:00'), status, nickname, unitId: employeeId === ctx.e1 ? unit : null });
    ctx.scheduled = mk(ctx.e1, '2026-11-10', 'scheduled', ctx.p, 'Kunang');
    ctx.inProgress = mk(ctx.e2, '2026-11-02', 'in_progress');
    ctx.awaiting = mk(ctx.e2, '2026-10-26', 'awaiting_report');
    ctx.completed = mk(ctx.e1, '2026-10-12', 'completed');
    ctx.noShow = mk(ctx.e2, '2026-09-14', 'no_show');
    ctx.cancelled = mk(ctx.e1, '2026-09-07', 'cancelled');
    ctx.otherPsych = mk(ctx.e2, '2026-11-11', 'scheduled', ctx.p2);
  });

  it('kelompok status upcoming / done / history', async () => {
    const a = as(ctx.admin);
    expect(ids(await a.get('/api/tickets?status=upcoming'))).toEqual(sorted([ctx.scheduled, ctx.inProgress, ctx.otherPsych]));
    expect(ids(await a.get('/api/tickets?status=done'))).toEqual(sorted([ctx.awaiting, ctx.completed, ctx.noShow]));
    expect(ids(await a.get('/api/tickets?status=history'))).toEqual(sorted([ctx.completed, ctx.noShow, ctx.cancelled]));
    expect(ids(await a.get('/api/tickets?status=cancelled'))).toEqual([ctx.cancelled]);
    expect((await a.get('/api/tickets')).body.tickets).toHaveLength(7);
  });

  it('peran membatasi tiket yang terlihat', async () => {
    expect(ids(await as(ctx.e1).get('/api/tickets'))).toEqual(sorted([ctx.scheduled, ctx.completed, ctx.cancelled]));
    expect(ids(await as(ctx.p2).get('/api/tickets'))).toEqual([ctx.otherPsych]);
    expect((await as(ctx.p).get('/api/tickets')).body.tickets).toHaveLength(6);
  });

  it('urutan: pekerja terbaru dulu; staf yang berlangsung dulu', async () => {
    const emp = (await as(ctx.e1).get('/api/tickets')).body.tickets.map((t: T) => t.id);
    expect(emp).toEqual([ctx.scheduled, ctx.completed, ctx.cancelled]);
    const staff = (await as(ctx.p).get('/api/tickets')).body.tickets.map((t: T) => t.id);
    expect(staff.slice(0, 3)).toEqual([ctx.inProgress, ctx.awaiting, ctx.scheduled]);
  });

  it('filter from/to (ISO, to eksklusif), mode, unit, psikolog', async () => {
    const a = as(ctx.admin);
    const r = await a.get(`/api/tickets?from=${wibIso('2026-10-01', '00:00')}&to=${wibIso('2026-11-02', '09:00')}`);
    expect(ids(r)).toEqual(sorted([ctx.awaiting, ctx.completed]));
    const r2 = await a.get(`/api/tickets?from=${wibIso('2026-11-02', '00:00')}&to=${wibIso('2026-11-03', '00:00')}`);
    expect(ids(r2)).toEqual([ctx.inProgress]);
    expect((await a.get('/api/tickets?mode=chat')).body.tickets).toHaveLength(0);
    const unit = (db.prepare(`SELECT id FROM units WHERE name = 'Unit Daftar'`).get() as { id: number }).id;
    expect(ids(await a.get(`/api/tickets?unit=${unit}`))).toEqual(sorted([ctx.scheduled, ctx.completed, ctx.cancelled]));
    expect(ids(await a.get(`/api/tickets?psychologist=${ctx.p2}`))).toEqual([ctx.otherPsych]);
  });

  it('pencarian q (kode, nama, PN, nama panggilan) hanya untuk staf', async () => {
    const a = as(ctx.admin);
    expect(ids(await a.get('/api/tickets?q=andi'))).toEqual(sorted([ctx.scheduled, ctx.completed, ctx.cancelled]));
    expect(ids(await a.get('/api/tickets?q=5550002'))).toHaveLength(4);
    expect(ids(await a.get('/api/tickets?q=Kunang'))).toEqual([ctx.scheduled]);
    const code = (db.prepare('SELECT code FROM tickets WHERE id = ?').get(ctx.noShow) as { code: string }).code;
    expect(ids(await a.get(`/api/tickets?q=${code}`))).toEqual([ctx.noShow]);
    expect(ids(await as(ctx.p).get('/api/tickets?q=Budi'))).toEqual(sorted([ctx.inProgress, ctx.awaiting, ctx.noShow]));
    // Pekerja: q diabaikan.
    expect((await as(ctx.e1).get('/api/tickets?q=tidak-ada')).body.tickets).toHaveLength(3);
  });

  it('page & pageSize mengembalikan total sesuai filter', async () => {
    const a = as(ctx.admin);
    const p1 = await a.get('/api/tickets?page=1&pageSize=3');
    expect(p1.body).toMatchObject({ total: 7, page: 1, pageSize: 3 });
    expect(p1.body.tickets).toHaveLength(3);
    const p3 = await a.get('/api/tickets?page=3&pageSize=3');
    expect(p3.body.tickets).toHaveLength(1);
    const all = [...p1.body.tickets, ...(await a.get('/api/tickets?page=2&pageSize=3')).body.tickets, ...p3.body.tickets].map((t: T) => t.id);
    expect(new Set(all).size).toBe(7);
    expect((await a.get('/api/tickets?page=1&pageSize=2&status=history')).body).toMatchObject({ total: 3, pageSize: 2 });
    expect((await a.get('/api/tickets?page=1&q=andi')).body.total).toBe(3);
    // Total untuk psikolog & pekerja juga terbatas pada miliknya.
    expect((await as(ctx.p).get('/api/tickets?page=1&pageSize=1&status=upcoming')).body.total).toBe(2);
    expect((await as(ctx.e2).get('/api/tickets?page=1&pageSize=1')).body.total).toBe(4);
    expect((await a.get('/api/tickets')).body.total).toBeUndefined();
  });

  it('limit tanpa pagination dijepit 1–1000', async () => {
    const a = as(ctx.admin);
    expect((await a.get('/api/tickets?limit=2')).body.tickets).toHaveLength(2);
    expect((await a.get('/api/tickets?limit=0')).body.tickets).toHaveLength(7);
    expect((await a.get('/api/tickets?limit=abc')).body.tickets).toHaveLength(7);
    // SQLite memperlakukan LIMIT negatif sebagai tanpa batas.
    expect((await a.get('/api/tickets?limit=-1')).body.tickets).toHaveLength(1);
  });

  it('jumlah pesan belum dibaca per tiket', async () => {
    db.prepare(`INSERT INTO messages (ticket_id, sender_id, body, created_at) VALUES (?,?,?,?)`).run(ctx.scheduled, ctx.p, 'Halo', '2026-11-01');
    const t = (await as(ctx.e1).get('/api/tickets')).body.tickets.find((x: T) => x.id === ctx.scheduled);
    expect(t.unread).toBe(1);
    const own = (await as(ctx.p).get('/api/tickets')).body.tickets.find((x: T) => x.id === ctx.scheduled);
    expect(own.unread).toBe(0);
  });
});

describe('detail tiket & riwayat', () => {
  it('data rahasia sesuai peran; riwayat klinis untuk psikolog', async () => {
    const admin = makeUser('admin');
    const [p1, p2] = [makeUser('psychologist', { name: 'Psi Lama' }), makeUser('psychologist')];
    const e = makeUser('employee');
    const prev = insertTicket({ employeeId: e, psychologistId: p1, start: wibIso('2026-10-05', '09:00'), status: 'completed', screening: Array(16).fill(3) });
    insertReport(prev, p1, { summary: 'Ringkasan sesi lalu', goal: 'Tujuan lalu' });
    const cur = insertTicket({ employeeId: e, psychologistId: p2, start: wibIso('2026-11-09', '09:00') });
    insertReport(cur, p2, { outcome: 'terminasi', summary: 'Ringkasan kini', note: 'Untuk klien' });

    const emp = (await as(e).get(`/api/tickets/${cur}`)).body;
    expect(emp.ticket.complaint).toBe('Cerita rahasia klien');
    expect(emp.ticket.screening).toBeUndefined();
    expect(emp.ticket.screeningScore).toBeUndefined();
    expect(emp.ticket.employee.pn).toBeUndefined();
    expect(emp.report).toEqual({ outcome: 'terminasi', noteForClient: 'Untuk klien', createdAt: expect.any(String) });
    expect(emp.history).toEqual([]);

    const adm = (await as(admin).get(`/api/tickets/${cur}`)).body;
    expect(adm.ticket.complaint).toBeUndefined();
    expect(adm.ticket.expectation).toBeUndefined();
    expect(adm.ticket.screening).toBeUndefined();
    expect(adm.ticket.screeningScore).toBe(32);
    expect(adm.report).toEqual({ outcome: 'terminasi', category: 'beban_kerja', createdAt: expect.any(String) });
    expect(adm.history).toHaveLength(1);
    expect(adm.history[0]).toEqual({ id: prev, code: expect.any(String), status: 'completed', scheduledStart: expect.any(String), mode: 'offline', psychologistName: 'Psi Lama', outcome: 'lanjutan' });

    const psy = (await as(p2).get(`/api/tickets/${cur}`)).body;
    expect(psy.ticket.screening).toHaveLength(16);
    expect(psy.ticket.complaint).toBe('Cerita rahasia klien');
    expect(psy.report).toMatchObject({ summary: 'Ringkasan kini', goal: 'Tujuan', healthHistory: 'Riwayat', symptoms: 'Gejala' });
    expect(psy.history[0]).toMatchObject({
      id: prev,
      topic: 'work_stress',
      screening: Array(16).fill(3),
      screeningLevel: 'rendah',
      report: { outcome: 'lanjutan', summary: 'Ringkasan sesi lalu', goal: 'Tujuan lalu', category: 'beban_kerja' },
    });

    // Tiket orang lain tidak bisa dibuka.
    expect((await as(makeUser('employee')).get(`/api/tickets/${cur}`)).status).toBe(404);
    expect((await as(p1).get(`/api/tickets/${cur}`)).status).toBe(404);
    expect((await as(admin).get('/api/tickets/99999')).status).toBe(404);
    expect((await as(admin).get('/api/tickets/abc')).status).toBe(404);
  });

  it('riwayat tanpa laporan tidak menyertakan objek report', async () => {
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    insertTicket({ employeeId: e, psychologistId: p, start: wibIso('2026-10-05', '09:00'), status: 'cancelled' });
    const cur = insertTicket({ employeeId: e, psychologistId: p, start: wibIso('2026-11-09', '09:00') });
    const h = (await as(p).get(`/api/tickets/${cur}`)).body.history;
    expect(h[0].report).toBeUndefined();
    expect(h[0].status).toBe('cancelled');
  });
});

describe('alur sesi: mulai, selesai, hasil, feedback', () => {
  const report = { outcome: 'lanjutan', goal: 'Mengelola stres', summary: 'Klien bercerita tentang beban kerja.', category: 'beban_kerja', noteForClient: 'Jaga tidur ya' };

  it('scheduled → in_progress → awaiting_report → completed → feedback', async () => {
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    const id = insertTicket({ employeeId: e, psychologistId: p, start: wibIso(MONDAY, '08:00') });

    expect((await as(e).post(`/api/tickets/${id}/start`)).status).toBe(403);
    const early = await as(p).post(`/api/tickets/${id}/start`);
    expect(early.status).toBe(400);
    expect((await as(p).post(`/api/tickets/${id}/report`).send(report)).body.error).toMatch(/setelah jadwal sesi dimulai/);

    setNow(wibIso(MONDAY, '07:45'));
    expect((await as(p).post(`/api/tickets/${id}/start`)).status).toBe(200);
    expect((await as(p).post(`/api/tickets/${id}/start`)).status).toBe(400);
    expect((await as(p).post(`/api/tickets/${id}/end`)).body.error).toMatch(/belum dimulai/);

    setNow(wibIso(MONDAY, '08:50'));
    expect((await as(p).post(`/api/tickets/${id}/end`)).status).toBe(200);
    expect((await as(e).get(`/api/tickets/${id}`)).body.ticket.status).toBe('awaiting_report');
    expect((await as(p).post(`/api/tickets/${id}/end`)).status).toBe(400);

    expect((await as(e).post(`/api/tickets/${id}/feedback`).send({ answers: FEEDBACK_ITEMS.map(() => 4) })).status).toBe(400);

    const bad = await as(p).post(`/api/tickets/${id}/report`).send({ outcome: 'lanjutan', goal: '', summary: 'pendek', category: 'x' });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.fields)).toEqual(expect.arrayContaining(['goal', 'summary', 'category']));
    expect((await as(p).post(`/api/tickets/${id}/report`).send(report)).status).toBe(200);
    const d = (await as(e).get(`/api/tickets/${id}`)).body;
    expect(d.ticket).toMatchObject({ status: 'completed', outcome: 'lanjutan' });
    expect(d.report).toMatchObject({ outcome: 'lanjutan', noteForClient: 'Jaga tidur ya' });
    expect(d.events.map((x: { type: string }) => x.type)).toEqual(['started', 'ended', 'reported']);
    const notes = (db.prepare('SELECT type FROM notifications WHERE user_id = ? ORDER BY id').all(e) as { type: string }[]).map((x) => x.type);
    expect(notes).toEqual(['session.started', 'session.result']);

    // Perbarui hasil → tidak ada notifikasi baru.
    expect((await as(p).post(`/api/tickets/${id}/report`).send({ ...report, outcome: 'terminasi' })).status).toBe(200);
    expect((db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ?').get(e) as { n: number }).n).toBe(2);

    const answers = [4, 4, 3, 4, 4, 3, 4, 4];
    expect((await as(e).post(`/api/tickets/${id}/feedback`).send({ answers: [1, 2] })).status).toBe(400);
    expect((await as(e).post(`/api/tickets/${id}/feedback`).send({ answers, helpful: 'Didengar' })).status).toBe(200);
    expect((await as(e).post(`/api/tickets/${id}/feedback`).send({ answers })).status).toBe(409);
    const fe = (await as(e).get(`/api/tickets/${id}`)).body.feedback;
    expect(fe).toMatchObject({ score: 30, level: 'tinggi', helpful: 'Didengar', answers });
    const fp = (await as(p).get(`/api/tickets/${id}`)).body;
    expect(fp.feedback.answers).toBeUndefined();
    expect(fp.ticket.feedbackScore).toBe(30);
  });

  it('no show & hasil untuk sesi batal ditolak', async () => {
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    const id = insertTicket({ employeeId: e, psychologistId: p, start: wibIso('2026-10-30', '09:00') });
    expect((await as(p).post(`/api/tickets/${id}/report`).send({ outcome: 'no_show' })).status).toBe(200);
    const d = (await as(p).get(`/api/tickets/${id}`)).body;
    expect(d.ticket.status).toBe('no_show');
    expect(d.ticket.startedAt).toBeNull();
    expect(d.report).toMatchObject({ outcome: 'no_show', goal: null, summary: null });
    expect((db.prepare(`SELECT type FROM notifications WHERE user_id = ?`).get(e) as { type: string }).type).toBe('session.no_show');

    const c = insertTicket({ employeeId: e, psychologistId: p, start: wibIso('2026-10-29', '09:00'), status: 'cancelled' });
    expect((await as(p).post(`/api/tickets/${c}/report`).send({ outcome: 'no_show' })).status).toBe(400);
    expect((await as(makeUser('psychologist')).post(`/api/tickets/${id}/report`).send({ outcome: 'no_show' })).status).toBe(404);
  });

  it('tautan Teams hanya untuk sesi online yang belum selesai', async () => {
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    const off = insertTicket({ employeeId: e, psychologistId: p, start: wibIso('2026-11-09', '09:00') });
    const on = insertTicket({ employeeId: e, psychologistId: p, start: wibIso('2026-11-10', '09:00'), mode: 'online' });
    expect((await as(p).patch(`/api/tickets/${off}/meeting`).send({ meetingUrl: 'https://teams.microsoft.com/x' })).status).toBe(400);
    expect((await as(p).patch(`/api/tickets/${on}/meeting`).send({ meetingUrl: 'bukan-url' })).status).toBe(400);
    expect((await as(p).patch(`/api/tickets/${on}/meeting`).send({ meetingUrl: 'https://teams.microsoft.com/x' })).status).toBe(200);
    expect((await as(e).get(`/api/tickets/${on}`)).body.ticket.meetingUrl).toBe('https://teams.microsoft.com/x');
    expect((await as(e).patch(`/api/tickets/${on}/meeting`).send({ meetingUrl: 'https://x.y' })).status).toBe(403);
  });
});

describe('chat', () => {
  const setup = (mode: 'chat' | 'offline' = 'chat', status: Parameters<typeof insertTicket>[0]['status'] = 'scheduled') => {
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    const id = insertTicket({ employeeId: e, psychologistId: p, start: wibIso('2026-11-10', '09:00'), mode, status });
    return { p, e, id };
  };

  it('kirim pesan, notifikasi tidak menumpuk, tandai dibaca', async () => {
    const { p, e, id } = setup();
    const r = await as(e).post(`/api/tickets/${id}/messages`).send({ body: '  Halo kak  ' });
    expect(r.status).toBe(201);
    expect(r.body.message).toMatchObject({ ticketId: id, senderId: e, body: 'Halo kak', attachment: null, readAt: null });
    await as(e).post(`/api/tickets/${id}/messages`).send({ body: 'Pesan kedua' });
    const notes = db.prepare(`SELECT title, link FROM notifications WHERE user_id = ? AND type = 'chat.message'`).all(p) as { title: string; link: string }[];
    expect(notes).toHaveLength(1);
    expect(notes[0]).toEqual({ title: 'Pesan baru dari Klien', link: `/psikolog/sesi/${id}` });

    expect((await as(p).get('/api/tickets')).body.tickets[0].unread).toBe(2);
    expect((await as(p).post(`/api/tickets/${id}/messages/read`)).status).toBe(200);
    expect((await as(p).get('/api/tickets')).body.tickets[0].unread).toBe(0);
    expect((await as(p).get('/api/notifications')).body.unread).toBe(0);

    expect((await as(e).post(`/api/tickets/${id}/messages`).send({ body: '   ' })).status).toBe(400);
    expect((await as(makeUser('admin')).get(`/api/tickets/${id}/messages`)).status).toBe(403);
    expect((await as(makeUser('employee')).get(`/api/tickets/${id}/messages`)).status).toBe(404);
  });

  it('pagination limit/before/hasMore + state.attachments', async () => {
    const { p, e, id } = setup();
    const ins = db.prepare('INSERT INTO messages (ticket_id, sender_id, body, created_at) VALUES (?,?,?,?)');
    for (let i = 1; i <= 25; i++) ins.run(id, i % 2 ? e : p, `pesan ${i}`, new Date().toISOString());

    const first = await as(e).get(`/api/tickets/${id}/messages?limit=10`);
    expect(first.body.hasMore).toBe(true);
    expect(first.body.messages.map((m: { body: string }) => m.body)).toEqual(Array.from({ length: 10 }, (_, i) => `pesan ${16 + i}`));
    expect(first.body.state).toMatchObject({ canRead: true, canSend: true, attachments: { used: 0, max: 5, maxMB: 2 } });

    const second = await as(e).get(`/api/tickets/${id}/messages?limit=10&before=${first.body.messages[0].id}`);
    expect(second.body.messages.map((m: { body: string }) => m.body)).toEqual(Array.from({ length: 10 }, (_, i) => `pesan ${6 + i}`));
    expect(second.body.hasMore).toBe(true);
    const third = await as(e).get(`/api/tickets/${id}/messages?limit=10&before=${second.body.messages[0].id}`);
    expect(third.body.messages).toHaveLength(5);
    expect(third.body.hasMore).toBe(false);

    const all = await as(p).get(`/api/tickets/${id}/messages`);
    expect(all.body.messages).toHaveLength(25);
    expect(all.body.hasMore).toBe(false);
    expect((await as(p).get(`/api/tickets/${id}/messages?limit=999`)).body.messages).toHaveLength(25);
    expect((await as(p).get(`/api/tickets/${id}/messages?limit=25`)).body.hasMore).toBe(false);
    expect((await as(p).get(`/api/tickets/${id}/messages?limit=24`)).body.hasMore).toBe(true);
  });

  it('status ruang chat: media lain, batal, masa tenggang setelah selesai', async () => {
    const off = setup('offline');
    const s = (await as(off.e).get(`/api/tickets/${off.id}/messages`)).body.state;
    expect(s).toMatchObject({ canRead: false, canSend: false });
    expect(s.attachments).toBeUndefined();
    expect((await as(off.e).post(`/api/tickets/${off.id}/messages`).send({ body: 'Halo' })).status).toBe(400);

    const can = setup('chat', 'cancelled');
    expect((await as(can.e).post(`/api/tickets/${can.id}/messages`).send({ body: 'Halo' })).body.error).toMatch(/dibatalkan/);

    const done = setup('chat', 'completed');
    db.prepare('UPDATE tickets SET completed_at = ? WHERE id = ?').run(wibIso('2026-10-30', '10:00'), done.id);
    const st = (await as(done.e).get(`/api/tickets/${done.id}`)).body.chat;
    expect(st).toMatchObject({ canSend: true, closesAt: new Date(Date.parse(wibIso('2026-10-30', '10:00')) + 7 * 864e5).toISOString() });
    setNow(wibIso('2026-11-07', '10:01'));
    expect((await as(done.e).post(`/api/tickets/${done.id}/messages`).send({ body: 'Halo' })).body.error).toMatch(/ditutup/);
  });
});

describe('lampiran chat', () => {
  const upload = (uid: number, id: number, name: string, data: Buffer) =>
    as(uid).post(`/api/tickets/${id}/attachments`).set('Content-Type', 'application/octet-stream').set('x-file-name', encodeURIComponent(name)).send(data);

  it('unggah, unduh, jenis file, ukuran & kuota per sesi', async () => {
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    const id = insertTicket({ employeeId: e, psychologistId: p, start: wibIso('2026-11-10', '09:00'), mode: 'chat' });

    const r = await upload(e, id, 'foto saya.png', Buffer.from('PNGDATA'));
    expect(r.status).toBe(201);
    expect(r.body.message.attachment).toMatchObject({ name: 'foto saya.png', type: 'image/png', size: 7, kind: 'image' });
    const file = await as(p).get(r.body.message.attachment.url);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toContain('image/png');
    expect(file.headers['content-disposition']).toMatch(/^inline/);
    expect(Buffer.from(file.body).toString()).toBe('PNGDATA');
    expect((await as(p).get(`${r.body.message.attachment.url}?download`)).headers['content-disposition']).toMatch(/^attachment/);
    expect((await as(makeUser('employee')).get(r.body.message.attachment.url)).status).toBe(404);
    const note = db.prepare(`SELECT body FROM notifications WHERE user_id = ? AND type = 'chat.message'`).get(p) as { body: string };
    expect(note.body).toContain('Foto: foto saya.png');

    expect((await upload(e, id, 'skrip.exe', Buffer.from('x'))).status).toBe(400);
    expect((await upload(e, id, '', Buffer.from('x'))).status).toBe(400);
    // Nama tanpa ekstensi ("pdf") tidak boleh dianggap file PDF.
    expect((await upload(e, id, 'pdf', Buffer.from('x'))).status).toBe(400);
    expect((await upload(e, id, 'kosong.pdf', Buffer.alloc(0))).body.error).toMatch(/kosong|tidak didukung/);
    expect((await upload(e, id, '../../jahat.txt', Buffer.from('x'))).body.message.attachment.name).toBe('jahat.txt');

    const big = await upload(e, id, 'besar.pdf', Buffer.alloc(2 * 1024 * 1024 + 1)).catch((err) => err.response ?? { status: 'reset' });
    expect([413, 'reset']).toContain(big.status);

    for (const n of ['a.pdf', 'b.docx', 'c.mp4']) expect((await upload(p, id, n, Buffer.from('isi'))).status).toBe(201);
    const st = (await as(e).get(`/api/tickets/${id}/messages`)).body.state;
    expect(st.attachments).toEqual({ used: 5, max: 5, maxMB: 2 });
    const over = await upload(e, id, 'f.pdf', Buffer.from('isi'));
    expect(over.status).toBe(400);
    expect(over.body.code).toBe('ATTACHMENT_LIMIT');
    expect((await as(makeUser('admin')).get(r.body.message.attachment.url)).status).toBe(403);
  });
});

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '../../server/db.js';
import { wibIso } from '../../server/scheduling.js';
import { addBlock, as, bookingBody, freezeTime, insertTicket, makeUnit, makeUser, MONDAY } from './helpers.js';

beforeAll(() => freezeTime());
afterAll(() => vi.useRealTimers());

describe('booking: slot', () => {
  it('daftar psikolog, bulan & hari yang tersedia', async () => {
    const p = makeUser('psychologist', { name: 'Psi Booking' });
    const e = makeUser('employee');
    addBlock(p, '2026-11-11', '13:00', '15:00', ['chat']);
    const list = await as(e).get('/api/booking/psychologists');
    expect(list.body.psychologists.map((x: { name: string }) => x.name)).toContain('Psi Booking');

    const month = await as(e).get('/api/booking/month?month=2026-11');
    expect(month.body.days).toContain('2026-11-11');
    expect((await as(e).get('/api/booking/month?month=11-2026')).status).toBe(400);

    const day = await as(e).get('/api/booking/day?date=2026-11-11');
    const mine = day.body.psychologists.find((x: { psychologistId: number }) => x.psychologistId === p);
    expect(mine.slots).toEqual(['13:00', '13:30', '14:00'].map((time) => ({ time, modes: ['chat'] })));
    expect((await as(e).get('/api/booking/day?date=besok')).status).toBe(400);
  });

  it('admin hanya boleh melihat slot untuk memindahkan tiket', async () => {
    const admin = makeUser('admin');
    expect((await as(admin).get('/api/booking/day?date=2026-11-11')).status).toBe(400);
    expect((await as(admin).get('/api/booking/eligibility')).status).toBe(403);
    expect((await as(makeUser('psychologist')).get('/api/booking/psychologists')).status).toBe(403);
  });

  it('pekerja membuat janji: tiket, ruangan, notifikasi, nama panggilan', async () => {
    const unit = makeUnit();
    const p = makeUser('psychologist');
    const e = makeUser('employee', { unit_id: unit });
    addBlock(p, '2026-11-12');
    const res = await as(e).post('/api/tickets').send(bookingBody({ psychologistId: p, date: '2026-11-12', time: '09:00', nickname: 'Sekar' }));
    expect(res.status).toBe(201);
    const t = res.body.ticket;
    expect(t).toMatchObject({ status: 'scheduled', mode: 'offline', nickname: 'Sekar', scheduledStart: wibIso('2026-11-12', '09:00') });
    expect(t.code).toMatch(/^TC-\d{4}-00001$/);
    expect(t.location).toContain('Ruang 1');
    expect(t.screeningScore).toBeUndefined(); // pekerja tidak melihat skor skrining
    expect((db.prepare('SELECT nickname FROM users WHERE id = ?').get(e) as { nickname: string }).nickname).toBe('Sekar');
    const types = (uid: number) => (db.prepare('SELECT type FROM notifications WHERE user_id = ?').all(uid) as { type: string }[]).map((r) => r.type);
    expect(types(e)).toContain('ticket.booked');
    expect(types(p)).toContain('ticket.assigned');

    // Slot yang sama tidak bisa dipesan lagi.
    const e2 = makeUser('employee');
    const taken = await as(e2).post('/api/tickets').send(bookingBody({ psychologistId: p, date: '2026-11-12', time: '09:00' }));
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe('SLOT_TAKEN');
  });

  it('validasi formulir: consent, skrining lengkap, panjang cerita', async () => {
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    addBlock(p, '2026-11-13');
    const base = { psychologistId: p, date: '2026-11-13', time: '09:00' };
    expect((await as(e).post('/api/tickets').send(bookingBody({ ...base, consent: false }))).status).toBe(400);
    expect((await as(e).post('/api/tickets').send(bookingBody({ ...base, screening: [1, 2] }))).body.error).toMatch(/skrining/);
    expect((await as(e).post('/api/tickets').send(bookingBody({ ...base, complaint: 'pendek' }))).body.error).toMatch(/minimal 100/);
    expect((await as(e).post('/api/tickets').send(bookingBody({ ...base, topic: 'xxx' }))).status).toBe(400);
    expect((await as(e).post('/api/tickets').send(bookingBody({ ...base, mode: 'telepati' }))).status).toBe(400);
  });

  it('aturan H-4 jam', async () => {
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    addBlock(p, MONDAY);
    // Sekarang Senin 07.00 WIB: 10.30 kurang dari 4 jam, 11.00 boleh.
    const early = await as(e).post('/api/tickets').send(bookingBody({ psychologistId: p, date: MONDAY, time: '10:30' }));
    expect(early.status).toBe(409);
    const ok = await as(e).post('/api/tickets').send(bookingBody({ psychologistId: p, date: MONDAY, time: '11:00' }));
    expect(ok.status).toBe(201);
  });

  it('kuota: satu booking aktif & jeda 2 minggu', async () => {
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    for (const d of ['2026-11-16', '2026-11-17', '2026-11-30']) addBlock(p, d);
    expect((await as(e).post('/api/tickets').send(bookingBody({ psychologistId: p, date: '2026-11-16', time: '09:00' }))).status).toBe(201);
    const second = await as(e).post('/api/tickets').send(bookingBody({ psychologistId: p, date: '2026-11-30', time: '09:00' }));
    expect(second.status).toBe(409);
    expect(second.body.error).toMatch(/jadwal konseling aktif/);
    const el = await as(e).get('/api/booking/eligibility');
    expect(el.body).toMatchObject({ canBook: false, yearCount: 1 });

    // Sesi pertama selesai → booking baru harus berjarak 14 hari.
    db.prepare(`UPDATE tickets SET status = 'completed' WHERE employee_id = ?`).run(e);
    const near = await as(e).post('/api/tickets').send(bookingBody({ psychologistId: p, date: '2026-11-17', time: '09:00' }));
    expect(near.status).toBe(400);
    expect(near.body.code).toBe('GAP');
    expect((await as(e).get('/api/booking/eligibility')).body.earliestDate).toBe('2026-11-30');
    // Hari sebelum earliestDate tidak ditawarkan.
    expect((await as(e).get('/api/booking/day?date=2026-11-17')).body.psychologists).toEqual([]);
    expect((await as(e).get('/api/booking/month?month=2026-11')).body.days).toEqual(['2026-11-30']);
    expect((await as(e).post('/api/tickets').send(bookingBody({ psychologistId: p, date: '2026-11-30', time: '09:00' }))).status).toBe(201);
  });

  it('kuota tahunan 7x', async () => {
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    for (let m = 1; m <= 7; m++) insertTicket({ employeeId: e, psychologistId: p, start: wibIso(`2026-0${m}-06`, '09:00'), status: 'completed' });
    addBlock(p, '2026-11-18');
    const res = await as(e).post('/api/tickets').send(bookingBody({ psychologistId: p, date: '2026-11-18', time: '09:00' }));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Kuota/);
  });

  it('psikolog nonaktif tidak bisa dipilih', async () => {
    const p = makeUser('psychologist', { status: 'disabled' });
    addBlock(p, '2026-11-19');
    const res = await as(makeUser('employee')).post('/api/tickets').send(bookingBody({ psychologistId: p, date: '2026-11-19', time: '09:00' }));
    expect(res.status).toBe(400);
  });
});

describe('ubah jadwal & batal', () => {
  it('pekerja mengubah jadwal (H-4 jam) dan admin boleh mendadak', async () => {
    const p = makeUser('psychologist');
    const p2 = makeUser('psychologist');
    const e = makeUser('employee');
    const admin = makeUser('admin');
    addBlock(p, '2026-11-20');
    addBlock(p2, '2026-11-20');
    const t = (await as(e).post('/api/tickets').send(bookingBody({ psychologistId: p, date: '2026-11-20', time: '09:00' }))).body.ticket;
    const r = await as(e).post(`/api/tickets/${t.id}/reschedule`).send({ psychologistId: p2, date: '2026-11-20', time: '10:00', mode: 'chat' });
    expect(r.status).toBe(200);
    const after = (await as(e).get(`/api/tickets/${t.id}`)).body.ticket;
    expect(after).toMatchObject({ mode: 'chat', rescheduleCount: 1, scheduledStart: wibIso('2026-11-20', '10:00') });
    expect(after.psychologist.id).toBe(p2);
    const types = (db.prepare('SELECT type FROM notifications WHERE user_id = ?').all(p) as { type: string }[]).map((x) => x.type);
    expect(types).toContain('ticket.unassigned');

    // Pekerja lain tidak boleh menyentuh tiket ini.
    expect((await as(makeUser('employee')).post(`/api/tickets/${t.id}/reschedule`).send({ psychologistId: p, date: '2026-11-20', time: '13:00', mode: 'chat' })).status).toBe(404);
    // Psikolog tidak boleh mengubah jadwal.
    expect((await as(p2).post(`/api/tickets/${t.id}/reschedule`).send({ psychologistId: p, date: '2026-11-20', time: '13:00', mode: 'chat' })).status).toBe(403);

    // Kurang dari 4 jam sebelum sesi: pekerja ditolak, admin boleh.
    db.prepare('UPDATE tickets SET scheduled_start = ?, scheduled_end = ? WHERE id = ?').run(wibIso(MONDAY, '09:00'), wibIso(MONDAY, '10:00'), t.id);
    addBlock(p, MONDAY);
    const late = await as(e).post(`/api/tickets/${t.id}/reschedule`).send({ psychologistId: p, date: MONDAY, time: '13:00', mode: 'offline' });
    expect(late.status).toBe(400);
    expect(late.body.error).toMatch(/H-4/);
    const byAdmin = await as(admin).post(`/api/tickets/${t.id}/reschedule`).send({ psychologistId: p, date: MONDAY, time: '08:00', mode: 'offline' });
    expect(byAdmin.status).toBe(200);
    expect((await as(admin).get(`/api/booking/day?date=${MONDAY}&ticket=${t.id}`)).status).toBe(200);
  });

  it('pembatalan: alasan wajib, H-4 jam untuk pekerja, slot kembali tersedia', async () => {
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    addBlock(p, '2026-11-24');
    const t = (await as(e).post('/api/tickets').send(bookingBody({ psychologistId: p, date: '2026-11-24', time: '09:00' }))).body.ticket;
    expect((await as(e).post(`/api/tickets/${t.id}/cancel`).send({ reason: '' })).status).toBe(400);
    expect((await as(e).post(`/api/tickets/${t.id}/cancel`).send({ reason: 'Ada rapat mendadak' })).status).toBe(200);
    expect((await as(e).get(`/api/tickets/${t.id}`)).body.ticket).toMatchObject({ status: 'cancelled', cancelReason: 'Ada rapat mendadak' });
    expect((await as(e).post(`/api/tickets/${t.id}/cancel`).send({ reason: 'lagi' })).status).toBe(400);
    const day = (await as(e).get('/api/booking/day?date=2026-11-24')).body.psychologists.find((x: { psychologistId: number }) => x.psychologistId === p);
    expect(day.slots.map((s: { time: string }) => s.time)).toContain('09:00');

    const t2 = insertTicket({ employeeId: e, psychologistId: p, start: wibIso(MONDAY, '09:00') });
    expect((await as(e).post(`/api/tickets/${t2}/cancel`).send({ reason: 'Mendadak sakit' })).status).toBe(400);
    expect((await as(makeUser('admin')).post(`/api/tickets/${t2}/cancel`).send({ reason: 'Mendadak sakit' })).status).toBe(200);
  });
});

describe('ketersediaan psikolog', () => {
  it('psikolog menambah blok di hari kerja, bentrok ditolak', async () => {
    const p = makeUser('psychologist');
    const res = await as(p).post('/api/availability').send({ dates: ['2026-11-09', '2026-11-10', '2026-11-14'], start: '08:00', end: '12:00', modes: ['chat', 'offline'] });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(2); // Sabtu dibuang
    const clash = await as(p).post('/api/availability').send({ dates: ['2026-11-09'], start: '11:00', end: '14:00', modes: ['chat'] });
    expect(clash.status).toBe(409);
    const list = await as(p).get('/api/availability?from=2026-11-09&to=2026-11-13');
    expect(list.body.blocks).toHaveLength(2);
    expect(list.body.blocks[0]).toMatchObject({ psychologistId: p, start: '08:00', end: '12:00', modes: ['offline', 'chat'] });
  });

  it('validasi jam operasional, durasi, tanggal lampau & akhir pekan', async () => {
    const p = makeUser('psychologist');
    const post = (body: object) => as(p).post('/api/availability').send({ dates: ['2026-11-09'], start: '08:00', end: '12:00', modes: ['chat'], ...body });
    expect((await post({ start: '07:00' })).status).toBe(400);
    expect((await post({ end: '17:00' })).status).toBe(400);
    expect((await post({ start: '09:00', end: '09:30' })).status).toBe(400);
    expect((await post({ modes: [] })).status).toBe(400);
    expect((await post({ dates: ['2026-11-07'] })).body.error).toMatch(/hari kerja/);
    expect((await post({ dates: ['2026-10-30'] })).body.error).toMatch(/sudah lewat/);
  });

  it('admin mengatur ketersediaan psikolog tertentu; psikolog hanya melihat miliknya', async () => {
    const admin = makeUser('admin');
    const [p1, p2] = [makeUser('psychologist'), makeUser('psychologist')];
    expect((await as(admin).post('/api/availability').send({ dates: ['2026-11-23'], start: '08:00', end: '10:00', modes: ['chat'] })).status).toBe(400);
    expect((await as(admin).post('/api/availability').send({ psychologistId: admin, dates: ['2026-11-23'], start: '08:00', end: '10:00', modes: ['chat'] })).status).toBe(404);
    expect((await as(admin).post('/api/availability').send({ psychologistId: p1, dates: ['2026-11-23'], start: '08:00', end: '10:00', modes: ['chat'] })).status).toBe(201);
    addBlock(p2, '2026-11-23');
    const own = await as(p2).get('/api/availability?from=2026-11-23&to=2026-11-23&psychologistId=' + p1);
    expect(own.body.blocks.every((b: { psychologistId: number }) => b.psychologistId === p2)).toBe(true);
    const adm = await as(admin).get(`/api/availability?from=2026-11-23&to=2026-11-23&psychologistId=${p1}`);
    expect(adm.body.blocks).toHaveLength(1);
    expect((await as(makeUser('employee')).get('/api/availability')).status).toBe(403);
  });

  it('sesi tampil di kalender (nama panggilan hanya untuk psikolog)', async () => {
    const admin = makeUser('admin');
    const p = makeUser('psychologist');
    insertTicket({ employeeId: makeUser('employee'), psychologistId: p, start: wibIso('2026-11-25', '09:00'), nickname: 'Rahasia' });
    const ps = (await as(p).get('/api/availability?from=2026-11-25&to=2026-11-25')).body.sessions;
    expect(ps[0]).toMatchObject({ date: '2026-11-25', start: '09:00', end: '10:00', nickname: 'Rahasia' });
    const ad = (await as(admin).get(`/api/availability?from=2026-11-25&to=2026-11-25&psychologistId=${p}`)).body.sessions;
    expect(ad[0].nickname).toBeUndefined();
  });

  it('hapus blok: hanya milik sendiri, tidak bila ada sesi, tidak bila lampau', async () => {
    const p = makeUser('psychologist');
    const other = makeUser('psychologist');
    const b = addBlock(p, '2026-11-26');
    expect((await as(other).delete(`/api/availability/${b}`)).status).toBe(404);
    const t = insertTicket({ employeeId: makeUser('employee'), psychologistId: p, start: wibIso('2026-11-26', '09:00') });
    expect((await as(p).delete(`/api/availability/${b}`)).status).toBe(409);
    db.prepare(`UPDATE tickets SET status = 'cancelled' WHERE id = ?`).run(t);
    expect((await as(p).delete(`/api/availability/${b}`)).status).toBe(200);
    const old = addBlock(p, '2026-10-29');
    expect((await as(p).delete(`/api/availability/${old}`)).status).toBe(400);
  });
});

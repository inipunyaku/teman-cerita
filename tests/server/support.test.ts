import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../server/db.js';
import { notifySupportUnavailable } from '../../server/routes/support.js';
import { SUPPORT_DEFAULTS } from '../../shared/constants.js';
import { app, as, freezeTime, makeUser, NOW, setNow } from './helpers.js';

beforeEach(() => freezeTime());
afterAll(() => vi.useRealTimers());

const later = (min: number) => setNow(new Date(Date.parse(NOW) + min * 60e3).toISOString());

describe('chat bantuan', () => {
  it('tamu: isi identitas, kirim pesan, balasan otomatis, balasan admin', async () => {
    const admin = makeUser('admin');
    makeUser('employee', { name: 'Pekerja Asli', pn: '7770001' });
    expect((await request(app).post('/api/support/guest').send({ name: 'T', pn: '7770001' })).status).toBe(400);
    const g = await request(app).post('/api/support/guest').send({ name: 'Tamu Uji', pn: '7770001' });
    expect(g.status).toBe(201);
    const token = g.body.token as string;
    const guest = (r: request.Test) => r.set('x-support-token', token);

    expect((await request(app).post('/api/support/me/messages').send({ body: 'Halo' })).body.code).toBe('NO_THREAD');
    const m = await guest(request(app).post('/api/support/me/messages')).send({ body: 'Saya lupa password' });
    expect(m.status).toBe(201);
    const me = (await guest(request(app).get('/api/support/me'))).body;
    expect(me.messages.map((x: { body: string; fromAdmin: boolean; auto: boolean }) => [x.fromAdmin, x.auto])).toEqual([
      [false, false],
      [true, true],
    ]);
    expect(me.messages[1].body).toContain('±5 menit');
    expect(me.unread).toBe(1);
    expect(me.thread).toMatchObject({ name: 'Tamu Uji', pn: '7770001' });

    // Pesan berikutnya dalam 30 menit tidak memicu balasan otomatis lagi.
    later(5);
    await guest(request(app).post('/api/support/me/messages')).send({ body: 'Masih di sini' });
    expect((await guest(request(app).get('/api/support/me'))).body.messages).toHaveLength(3);

    const list = (await as(admin).get('/api/support/threads')).body;
    const th = list.threads.find((t: { name: string }) => t.name === 'Tamu Uji');
    expect(th).toMatchObject({ guest: true, roleLabel: 'Tamu', pnMatch: 'Pekerja Asli', unread: 2, lastMessage: { body: 'Masih di sini' } });
    expect(list.unread).toBeGreaterThanOrEqual(1);
    expect((await as(admin).get('/api/support/threads?q=tamu')).body.threads).toHaveLength(1);
    expect((await as(admin).get('/api/support/threads?q=zzz')).body.threads).toHaveLength(0);

    const reply = await as(admin).post(`/api/support/threads/${th.id}/messages`).send({ body: 'Silakan reset lewat admin ya' });
    expect(reply.body.message).toMatchObject({ fromAdmin: true, auto: false, senderName: expect.any(String) });
    await as(admin).post(`/api/support/threads/${th.id}/read`);
    expect((await as(admin).get(`/api/support/threads/${th.id}`)).body.thread.unread).toBe(0);
    await guest(request(app).post('/api/support/me/read'));
    expect((await guest(request(app).get('/api/support/me'))).body.unread).toBe(0);

    // Token tak dikenal.
    expect((await request(app).get('/api/support/me').set('x-support-token', 'salah')).status).toBe(404);
    expect((await request(app).get('/api/support/me')).body).toEqual({ thread: null, messages: [], unread: 0 });
  });

  it('pengguna login memakai akunnya; admin tidak bisa memakai sisi pengguna', async () => {
    const admin = makeUser('admin');
    const p = makeUser('psychologist', { name: 'Psi Bantuan' });
    expect((await as(p).post('/api/support/guest').send({ name: 'X Y', pn: '123' })).status).toBe(400);
    expect((await as(p).get('/api/support/me')).body.thread).toBeNull();
    expect((await as(p).post('/api/support/me/messages').send({ body: 'Butuh bantuan jadwal' })).status).toBe(201);
    const th = (await as(admin).get('/api/support/threads')).body.threads.find((t: { name: string }) => t.name === 'Psi Bantuan');
    expect(th).toMatchObject({ guest: false, role: 'psychologist', roleLabel: 'Psikolog' });
    expect((await as(admin).get('/api/support/me')).status).toBe(403);
    expect((await as(admin).get('/api/support/threads/99999')).status).toBe(404);
    expect((await as(p).post('/api/support/me/messages').send({ body: '' })).status).toBe(400);
  });

  it('info "admin tidak tersedia" setelah batas tunggu, sekali saja', async () => {
    const e = makeUser('employee');
    await as(e).post('/api/support/me/messages').send({ body: 'Halo admin' });
    const thread = db.prepare('SELECT id FROM support_threads WHERE user_id = ?').pluck().get(e) as number;
    const count = () => db.prepare('SELECT COUNT(*) FROM support_messages WHERE thread_id = ?').pluck().get(thread) as number;
    expect(count()).toBe(2);
    later(SUPPORT_DEFAULTS.waitMinutes - 1);
    notifySupportUnavailable();
    expect(count()).toBe(2);
    later(SUPPORT_DEFAULTS.waitMinutes + 1);
    notifySupportUnavailable();
    notifySupportUnavailable();
    expect(count()).toBe(3);
    const last = (await as(e).get('/api/support/me')).body.messages.at(-1);
    expect(last).toMatchObject({ fromAdmin: true, auto: true, body: SUPPORT_DEFAULTS.unavailable });
  });

  it('pengaturan balasan otomatis', async () => {
    const admin = makeUser('admin');
    const s = (await as(admin).get('/api/support/threads/settings')).body;
    expect(s.settings).toEqual(SUPPORT_DEFAULTS);
    const bad = await as(admin).put('/api/support/threads/settings').send({ ...SUPPORT_DEFAULTS, responseMinutes: 30, waitMinutes: 10 });
    expect(bad.status).toBe(400);
    expect((await as(admin).put('/api/support/threads/settings').send({ ...SUPPORT_DEFAULTS, greeting: '' })).status).toBe(400);
    const ok = await as(admin).put('/api/support/threads/settings').send({ ...SUPPORT_DEFAULTS, autoReply: false, responseMinutes: '15', waitMinutes: 20, greeting: 'Tunggu {waktu_respons} menit' });
    expect(ok.body.settings).toMatchObject({ autoReply: false, responseMinutes: 15, greeting: 'Tunggu {waktu_respons} menit' });
    expect((await request(app).get('/api/support/info')).body).toEqual({ responseMinutes: 15, autoReply: false });

    // Tanpa balasan otomatis.
    const e = makeUser('employee');
    await as(e).post('/api/support/me/messages').send({ body: 'Halo' });
    expect((await as(e).get('/api/support/me')).body.messages).toHaveLength(1);
  });
});

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { db } from '../../server/db.js';
import { app, as, makeUnit, makeUser, PASSWORD } from './helpers.js';

const sessionCookie = (res: request.Response) =>
  ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('tc_session='));

describe('auth', () => {
  it('pendaftaran pekerja oleh admin lalu login dengan password awal (tanggal lahir)', async () => {
    const admin = makeUser('admin');
    const unit = makeUnit('Divisi Uji');
    const reg = await as(admin)
      .post('/api/admin/employees')
      .send({ pn: '7654321', name: 'Rina Lestari', email: 'Rina@Test.id', unitId: unit, birthDate: '1990-05-17', gender: 'P' });
    expect(reg.status).toBe(201);
    expect(reg.body.user).toMatchObject({ role: 'employee', email: 'rina@test.id', pn: '7654321', unitName: 'Divisi Uji', status: 'verified' });
    expect(reg.body.user.password_hash).toBeUndefined();

    const dup = await as(admin).post('/api/admin/employees').send({ pn: '7654321', name: 'Lain', email: 'lain@test.id', unitId: unit });
    expect(dup.status).toBe(409);

    const bad = await request(app).post('/api/auth/login').send({ identifier: '7654321', password: 'salah' });
    expect(bad.status).toBe(401);

    const login = await request(app).post('/api/auth/login').send({ identifier: '7654321', password: '17051990' });
    expect(login.status).toBe(200);
    expect(login.body.user.name).toBe('Rina Lestari');
    const cookie = sessionCookie(login)!;
    expect(cookie).toMatch(/HttpOnly/i);

    const viaEmail = await request(app).post('/api/auth/login').send({ identifier: 'RINA@test.id', password: '17051990' });
    expect(viaEmail.status).toBe(200);

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie.split(';')[0]);
    expect(me.body.user).toMatchObject({ name: 'Rina Lestari', role: 'employee' });
  });

  it('staf (psikolog) dibuat admin dengan password minimal 8 karakter', async () => {
    const admin = makeUser('admin');
    const short = await as(admin).post('/api/admin/staff').send({ role: 'psychologist', name: 'Psi Baru', email: 'psi@test.id', password: '123' });
    expect(short.status).toBe(400);
    const ok = await as(admin).post('/api/admin/staff').send({ role: 'psychologist', name: 'Psi Baru', email: 'psi@test.id', password: 'katasandi1' });
    expect(ok.status).toBe(201);
    const login = await request(app).post('/api/auth/login').send({ identifier: 'psi@test.id', password: 'katasandi1' });
    expect(login.body.user.role).toBe('psychologist');
  });

  it('me tanpa sesi → null; logout menghapus cookie', async () => {
    expect((await request(app).get('/api/auth/me')).body).toEqual({ user: null });
    const out = await as(makeUser('employee')).post('/api/auth/logout');
    expect(out.body).toEqual({ ok: true });
    expect(sessionCookie(out)).toMatch(/tc_session=;/);
  });

  it('akun nonaktif tidak bisa login dan sesinya diabaikan', async () => {
    const id = makeUser('employee', { email: 'off@test.id' });
    db.prepare(`UPDATE users SET status = 'disabled' WHERE id = ?`).run(id);
    const login = await request(app).post('/api/auth/login').send({ identifier: 'off@test.id', password: PASSWORD });
    expect(login.status).toBe(403);
    expect((await as(id).get('/api/auth/me')).body.user).toBeNull();
  });

  it('cookie rusak atau token palsu diabaikan; cookie valid kedua tetap dipakai', async () => {
    const id = makeUser('employee');
    const good = (await import('./helpers.js')).cookieFor(id);
    const res = await request(app).get('/api/auth/me').set('Cookie', `tc_session=palsu; ${good}`);
    expect(res.body.user.id).toBe(id);
  });

  it('ubah profil & password', async () => {
    const id = makeUser('employee');
    const p = await as(id).patch('/api/auth/profile').send({ name: 'Nama Baru', phone: '081234567890', nickname: 'Nabu', title: 'diabaikan' });
    expect(p.status).toBe(200);
    expect(p.body.user).toMatchObject({ name: 'Nama Baru', phone: '081234567890', nickname: 'Nabu', title: null });
    expect((await as(id).patch('/api/auth/profile').send({ name: 'Nama Baru', phone: '12' })).status).toBe(400);

    expect((await as(id).post('/api/auth/password').send({ current: 'salah', next: 'passwordbaru' })).status).toBe(400);
    expect((await as(id).post('/api/auth/password').send({ current: PASSWORD, next: 'passwordbaru' })).status).toBe(200);
    const email = (db.prepare('SELECT email FROM users WHERE id = ?').get(id) as { email: string }).email;
    expect((await request(app).post('/api/auth/login').send({ identifier: email, password: 'passwordbaru' })).status).toBe(200);
  });

  it('endpoint yang butuh login → 401', async () => {
    for (const url of ['/api/tickets', '/api/notifications', '/api/booking/psychologists', '/api/availability', '/api/admin/employees', '/api/stats']) {
      expect((await request(app).get(url)).status, url).toBe(401);
    }
    expect((await request(app).get('/api/tidak-ada')).status).toBe(404);
    expect((await request(app).get('/api/health')).body).toMatchObject({ ok: true, email: false });
  });

  it('meta: config & unit aktif', async () => {
    makeUnit('Unit Aktif');
    db.prepare(`INSERT INTO units (name, active, created_at) VALUES ('Unit Mati', 0, '')`).run();
    const cfg = await request(app).get('/api/meta/config');
    expect(cfg.body.schedule.leadHours).toBe(4);
    const units = (await request(app).get('/api/meta/units')).body.units.map((u: { name: string }) => u.name);
    expect(units).toContain('Unit Aktif');
    expect(units).not.toContain('Unit Mati');
  });
});

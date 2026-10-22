import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { db } from '../../server/db.js';
import { app, as, makeUnit, makeUser } from './helpers.js';

describe('admin: master data pekerja', () => {
  const c = {} as Record<string, number>;
  beforeAll(() => {
    c.admin = makeUser('admin');
    c.u1 = makeUnit('Unit A');
    c.u2 = makeUnit('Unit B');
    const people: [string, number, string | null, string | null, string | null, string][] = [
      ['Anita', c.u1, 'Band 1', 'Jakarta', 'P', 'verified'],
      ['Bagus', c.u1, 'Band 2', 'Jakarta', 'L', 'verified'],
      ['Citra', c.u2, 'Band 1', 'Bandung', 'P', 'verified'],
      ['Dodi', c.u2, 'Band 3', 'Surabaya', 'L', 'disabled'],
      ['Eka', c.u2, null, '', 'P', 'verified'],
    ];
    for (const [name, unit, band, region, gender, status] of people) {
      c[name] = makeUser('employee', { name, unit_id: unit, band, region, gender, status });
    }
    db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run('Kupu', c.Eka);
    makeUser('psychologist', { name: 'Bukan Pekerja', band: 'Band 9' });
  });
  const names = (r: { body: { users: { name: string }[] } }) => r.body.users.map((u) => u.name);

  it('tanpa page → semua (tanpa total/facets)', async () => {
    const r = await as(c.admin).get('/api/admin/employees');
    expect(names(r)).toEqual(['Anita', 'Bagus', 'Citra', 'Dodi', 'Eka']);
    expect(r.body.total).toBeUndefined();
    expect(r.body.facets).toBeUndefined();
  });

  it('pagination & facets band/region', async () => {
    const p1 = await as(c.admin).get('/api/admin/employees?page=1&pageSize=2');
    expect(p1.body).toMatchObject({ total: 5, page: 1, pageSize: 2 });
    expect(names(p1)).toEqual(['Anita', 'Bagus']);
    expect(names(await as(c.admin).get('/api/admin/employees?page=3&pageSize=2'))).toEqual(['Eka']);
    // Facet dari seluruh pekerja (bukan staf), tanpa nilai kosong.
    expect(p1.body.facets).toEqual({ bands: ['Band 1', 'Band 2', 'Band 3'], regions: ['Bandung', 'Jakarta', 'Surabaya'] });
  });

  it('filter status, unit, gender, band, region, q', async () => {
    const get = (qs: string) => as(c.admin).get(`/api/admin/employees?page=1&${qs}`);
    expect((await get('status=active')).body.total).toBe(4);
    expect(names(await get('status=disabled'))).toEqual(['Dodi']);
    expect(names(await get(`unit=${c.u1}`))).toEqual(['Anita', 'Bagus']);
    expect(names(await get('gender=P&band=Band%201'))).toEqual(['Anita', 'Citra']);
    expect(names(await get('region=Jakarta'))).toEqual(['Anita', 'Bagus']);
    expect(names(await get('q=kupu'))).toEqual(['Eka']);
    const pn = (db.prepare('SELECT pn FROM users WHERE id = ?').get(c.Citra) as { pn: string }).pn;
    const r = await get(`q=${pn}`);
    expect(names(r)).toEqual(['Citra']);
    expect(r.body.total).toBe(1);
    expect(r.body.users[0].ticketCount).toBe(0);
  });

  it('ubah pekerja, validasi, nonaktifkan', async () => {
    const base = { pn: '99887766', name: 'Fajar', email: 'fajar@test.id', unitId: c.u1 };
    const created = await as(c.admin).post('/api/admin/employees').send(base);
    expect(created.status).toBe(201);
    const id = created.body.user.id;
    expect((await as(c.admin).post('/api/admin/employees').send({ ...base, pn: '12' })).status).toBe(400);
    expect((await as(c.admin).post('/api/admin/employees').send({ ...base, pn: '11223344', unitId: 9999 })).status).toBe(400);
    expect((await as(c.admin).post('/api/admin/employees').send({ ...base, pn: '11223344', email: 'baru@test.id', password: 'pendek' })).status).toBe(400);

    const upd = await as(c.admin).patch(`/api/admin/employees/${id}`).send({ ...base, name: 'Fajar Baru', unitId: c.u2, band: 'Band 4' });
    expect(upd.body.user).toMatchObject({ name: 'Fajar Baru', unitName: 'Unit B', band: 'Band 4' });
    expect((await as(c.admin).patch(`/api/admin/employees/${c.admin}`).send(base)).status).toBe(404);
    expect((await as(c.admin).patch(`/api/admin/employees/${id}`).send({ ...base, email: db.prepare('SELECT email FROM users WHERE id = ?').pluck().get(c.Anita) })).status).toBe(409);

    expect((await as(c.admin).post(`/api/admin/users/${id}/status`).send({ active: false })).status).toBe(200);
    expect((await as(id).get('/api/auth/me')).body.user).toBeNull();
    expect((await as(c.admin).post(`/api/admin/users/${c.admin}/status`).send({ active: false })).status).toBe(400);
  });

  it('impor CSV: buat, perbarui, laporkan baris salah', async () => {
    const r = await as(c.admin).post('/api/admin/employees/import').send({
      rows: [
        { pn: '55500001', nama: 'Impor Satu', email: 'impor1@test.id', unit: 'unit a', jenis_kelamin: 'laki-laki' },
        { pn: '55500002', nama: 'Impor Dua', email: 'impor2@test.id', unit: 'Tidak Ada' },
        { pn: '99887766', nama: 'Fajar Impor', email: 'fajar@test.id', unit: 'Unit A' },
      ],
    });
    expect(r.body).toEqual({ created: 1, updated: 1, errors: [{ row: 3, error: 'Pilih unit kerja.' }] });
    const one = db.prepare(`SELECT gender, unit_id FROM users WHERE pn = '55500001'`).get() as { gender: string; unit_id: number };
    expect(one).toEqual({ gender: 'L', unit_id: c.u1 });
  });

  it('unit kerja', async () => {
    expect((await as(c.admin).post('/api/admin/units').send({ name: 'Unit A' })).status).toBe(409);
    expect((await as(c.admin).post('/api/admin/units').send({ name: 'Unit C', code: 'UC' })).status).toBe(201);
    const units = (await as(c.admin).get('/api/admin/units')).body.units;
    expect(units.find((u: { name: string }) => u.name === 'Unit B')).toMatchObject({ employees: 3, tickets: 0 });
    expect((await as(c.admin).patch(`/api/admin/units/99999`).send({ name: 'X Unit' })).status).toBe(404);
    expect((await as(c.admin).patch(`/api/admin/units/${c.u2}`).send({ name: 'Unit B', active: false })).status).toBe(200);
    expect((await request(app).get('/api/meta/units')).body.units.map((u: { name: string }) => u.name)).not.toContain('Unit B');
  });

  it('staf: ubah & daftar admin; psikolog dengan sesi aktif tidak bisa dinonaktifkan', async () => {
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    db.prepare(
      `INSERT INTO tickets (code, employee_id, psychologist_id, status, mode, scheduled_start, scheduled_end, nickname, topic, complaint, impact, expectation, screening, screening_score, screening_level, consent_at, created_at, updated_at)
       VALUES ('TX-A1', ?, ?, 'scheduled', 'chat', '2099-01-01', '2099-01-01', 'n', 't', 'c', 5, 'e', '[]', 16, 'rendah', '', '', '')`,
    ).run(e, p);
    expect((await as(c.admin).post(`/api/admin/users/${p}/status`).send({ active: false })).body.error).toMatch(/1 sesi akan datang/);
    const upd = await as(c.admin).patch(`/api/admin/staff/${p}`).send({ name: 'Psi Diubah', email: 'psi.diubah@test.id', title: 'M.Psi.' });
    expect(upd.body.user).toMatchObject({ name: 'Psi Diubah', title: 'M.Psi.' });
    expect((await as(c.admin).patch(`/api/admin/staff/${e}`).send({ name: 'Xyz', email: 'x@test.id' })).status).toBe(404);
    expect((await as(c.admin).get('/api/admin/admins')).body.users.every((u: { role: string }) => u.role === 'admin')).toBe(true);
  });
});

describe('otorisasi peran', () => {
  it('matriks akses endpoint', async () => {
    const e = makeUser('employee');
    const p = makeUser('psychologist');
    const a = makeUser('admin');
    const cases: [string, 'get' | 'post' | 'put', string, Record<string, number>][] = [
      ['admin employees', 'get', '/api/admin/employees', { [e]: 403, [p]: 403, [a]: 200 }],
      ['admin overview', 'get', '/api/admin/overview', { [e]: 403, [p]: 403, [a]: 200 }],
      ['stats', 'get', '/api/stats', { [e]: 403, [p]: 403, [a]: 200 }],
      ['availability', 'get', '/api/availability', { [e]: 403, [p]: 200, [a]: 200 }],
      ['booking eligibility', 'get', '/api/booking/eligibility', { [e]: 200, [p]: 403, [a]: 403 }],
      ['booking psychologists', 'get', '/api/booking/psychologists', { [e]: 200, [p]: 403, [a]: 200 }],
      ['buat tiket', 'post', '/api/tickets', { [p]: 403, [a]: 403 }],
      ['support threads', 'get', '/api/support/threads', { [e]: 403, [p]: 403, [a]: 200 }],
      ['support settings', 'put', '/api/support/threads/settings', { [e]: 403, [p]: 403 }],
      ['notifikasi', 'get', '/api/notifications', { [e]: 200, [p]: 200, [a]: 200 }],
      ['daftar tiket', 'get', '/api/tickets', { [e]: 200, [p]: 200, [a]: 200 }],
    ];
    for (const [label, method, url, expected] of cases) {
      for (const [uid, status] of Object.entries(expected)) {
        const res = await as(Number(uid))[method](url).send({});
        expect(res.status, `${label} sebagai user ${uid}`).toBe(status);
      }
    }
  });

  it('akun status lama (pending) ditolak endpoint yang butuh akun aktif', async () => {
    const pending = makeUser('employee', { status: 'pending' });
    const r = await as(pending).get('/api/tickets');
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('NOT_VERIFIED');
    expect((await as(pending).get('/api/booking/eligibility')).body.code).toBe('NOT_VERIFIED');
  });
});

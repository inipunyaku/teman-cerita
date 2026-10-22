import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ZodError, z } from 'zod';
import { errorHandler, fail, HttpError, intParam, pageParams, parse } from '../../server/util.js';
import { SERVICE_CONFIG } from '../../server/serviceConfig.js';
import {
  addDays,
  availableDays,
  dayCapacity,
  eligibility,
  assertSlotEligible,
  reserveSlot,
  slotsOn,
  wibIso,
  wibParts,
  wibToday,
} from '../../server/scheduling.js';
import { ELIGIBILITY, ROOMS, SCHEDULE } from '../../shared/constants.js';
import { addBlock, freezeTime, insertTicket, makeUser, MONDAY } from './helpers.js';

const mockRes = () => {
  const res = { statusCode: 0, body: undefined as unknown, status: vi.fn(), json: vi.fn() };
  res.status.mockImplementation((s: number) => ((res.statusCode = s), res));
  res.json.mockImplementation((b: unknown) => ((res.body = b), res));
  return res;
};

describe('util', () => {
  it('fail melempar HttpError dengan status & kode', () => {
    expect(() => fail(409, 'Bentrok', 'X')).toThrow(HttpError);
    try {
      fail(409, 'Bentrok', 'X');
    } catch (e) {
      expect(e).toMatchObject({ status: 409, message: 'Bentrok', code: 'X' });
    }
  });

  it('parse memakai skema zod', () => {
    expect(parse(z.object({ a: z.number() }), { a: 1 })).toEqual({ a: 1 });
    expect(() => parse(z.object({ a: z.number() }), {})).toThrow(ZodError);
  });

  it('intParam hanya menerima bilangan bulat positif', () => {
    expect(intParam('12')).toBe(12);
    for (const bad of ['0', '-1', '1.5', 'abc', '']) expect(() => intParam(bad)).toThrow(HttpError);
  });

  it('pageParams: null bila tanpa page, default & batas ukuran', () => {
    expect(pageParams({})).toBeNull();
    expect(pageParams({ page: '' })).toBeNull();
    expect(pageParams({ page: '1' })).toEqual({ page: 1, size: 20, offset: 0 });
    expect(pageParams({ page: '3', pageSize: '10' })).toEqual({ page: 3, size: 10, offset: 20 });
    expect(pageParams({ page: '2', pageSize: '500' })).toEqual({ page: 2, size: 100, offset: 100 });
    expect(pageParams({ page: '-4', pageSize: '-3' })).toEqual({ page: 1, size: 1, offset: 0 });
    expect(pageParams({ page: 'abc', pageSize: 'x' })).toEqual({ page: 1, size: 20, offset: 0 });
    expect(pageParams({ page: '2.9' })).toMatchObject({ page: 2 });
  });

  it('errorHandler memetakan HttpError, ZodError, dan error lain', () => {
    const r1 = mockRes();
    errorHandler(new HttpError(404, 'Hilang', 'NF'), {} as never, r1 as never, vi.fn());
    expect(r1.statusCode).toBe(404);
    expect(r1.body).toEqual({ error: 'Hilang', code: 'NF' });

    const r2 = mockRes();
    const zerr = z.object({ name: z.string().min(3, 'Nama minimal 3 karakter.') }).safeParse({ name: 'a' }).error!;
    errorHandler(zerr, {} as never, r2 as never, vi.fn());
    expect(r2.statusCode).toBe(400);
    expect(r2.body).toMatchObject({ error: 'Nama minimal 3 karakter.', fields: { name: ['Nama minimal 3 karakter.'] } });

    const r3 = mockRes();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(new Error('boom'), {} as never, r3 as never, vi.fn());
    spy.mockRestore();
    expect(r3.statusCode).toBe(500);
    expect((r3.body as { error: string }).error).not.toContain('boom');
  });
});

describe('serviceConfig', () => {
  it('mencerminkan konstanta bersama', () => {
    expect(SERVICE_CONFIG.schedule).toMatchObject({ open: '08:00', close: '16:30', durationMin: 60, leadHours: 4, maxPerPsychPerDay: 4 });
    expect(SERVICE_CONFIG.schedule.workDays).toEqual([1, 2, 3, 4, 5]);
    expect(SERVICE_CONFIG.schedule.workDays).not.toBe(SCHEDULE.workDays);
    expect(SERVICE_CONFIG.schedule.breaks['5']).toEqual({ start: '11:30', end: '13:30' });
    expect(SERVICE_CONFIG.rooms).toEqual(ROOMS);
    expect(SERVICE_CONFIG.maxPerYear).toBe(ELIGIBILITY.maxPerYear);
    expect(SERVICE_CONFIG.attachmentMaxMB).toBe(2);
    expect(SERVICE_CONFIG.attachmentsPerTicket).toBe(5);
  });
});

describe('scheduling: tanggal WIB', () => {
  it('wibIso / wibParts / addDays', () => {
    expect(wibIso('2026-11-02', '08:00')).toBe('2026-11-02T01:00:00.000Z');
    expect(wibParts('2026-11-02T17:30:00.000Z')).toEqual({ date: '2026-11-03', time: '00:30' });
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('dayCapacity menghitung sesi tanpa back-to-back, maks. 4', () => {
    expect(dayCapacity(MONDAY, [{ start_time: '08:00', end_time: '16:30' }])).toBe(4);
    expect(dayCapacity(MONDAY, [{ start_time: '08:00', end_time: '09:00' }])).toBe(1);
    // 08.00–10.30: 08.00–09.00 lalu jeda 30 menit, 09.30–10.30.
    expect(dayCapacity(MONDAY, [{ start_time: '08:00', end_time: '10:30' }])).toBe(2);
    expect(dayCapacity('2026-11-07', [{ start_time: '08:00', end_time: '16:30' }])).toBe(0); // Sabtu
    expect(dayCapacity(MONDAY, [])).toBe(0);
  });
});

describe('scheduling: slot & eligibility (database)', () => {
  beforeAll(() => freezeTime());
  afterAll(() => vi.useRealTimers());

  it('wibToday mengikuti jam WIB', () => {
    expect(wibToday()).toBe(MONDAY);
  });

  it('slotsOn menghormati H-4 jam, istirahat, dan blok ketersediaan', () => {
    const p = makeUser('psychologist');
    addBlock(p, MONDAY, '08:00', '16:30', ['offline', 'chat']);
    const slots = slotsOn(MONDAY, { psychologistId: p }).get(p)!;
    const times = slots.map((s) => s.time);
    // Sekarang 07.00 WIB → paling cepat 11.00.
    expect(times[0]).toBe('11:00');
    expect(times).not.toContain('10:30');
    expect(times).not.toContain('11:30'); // menabrak istirahat 12.00–13.00
    expect(times).toContain('13:00');
    expect(times.at(-1)).toBe('15:30');
    expect(slots[0].modes).toEqual(['offline', 'chat']);
    // Admin boleh mengabaikan H-4 jam.
    expect(slotsOn(MONDAY, { psychologistId: p, ignoreLead: true }).get(p)![0].time).toBe('08:00');
  });

  it('slotsOn menolak tumpang tindih/back-to-back & membatasi 4 sesi per hari', () => {
    const date = '2026-11-03';
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    addBlock(p, date);
    insertTicket({ employeeId: e, psychologistId: p, start: wibIso(date, '09:00') });
    const times = slotsOn(date, { psychologistId: p }).get(p)!.map((s) => s.time);
    expect(times).not.toContain('08:00'); // berakhir 09.00 → back-to-back
    expect(times).not.toContain('09:30');
    expect(times).not.toContain('10:00'); // jeda 30 menit belum terpenuhi
    expect(times).toContain('10:30');
    for (const hm of ['10:30', '13:00', '15:00']) insertTicket({ employeeId: e, psychologistId: p, start: wibIso(date, hm) });
    expect(slotsOn(date, { psychologistId: p }).has(p)).toBe(false);
  });

  it('slotsOn membatasi sesi bersamaan sesuai jumlah ruangan', () => {
    const date = '2026-11-04';
    const e = makeUser('employee');
    const psychs = Array.from({ length: ROOMS.length + 1 }, () => makeUser('psychologist'));
    for (const p of psychs) addBlock(p, date);
    for (const p of psychs.slice(0, ROOMS.length)) insertTicket({ employeeId: e, psychologistId: p, start: wibIso(date, '09:00') });
    const free = slotsOn(date, { psychologistId: psychs.at(-1) }).get(psychs.at(-1)!)!.map((s) => s.time);
    expect(free).not.toContain('09:00');
    expect(free).not.toContain('08:30');
    expect(free).toContain('08:00');
  });

  it('reserveSlot memilih ruangan kosong & menolak slot/media tidak tersedia', () => {
    const date = '2026-11-05';
    const [p1, p2] = [makeUser('psychologist'), makeUser('psychologist')];
    const e = makeUser('employee');
    addBlock(p1, date, '08:00', '16:30', ['offline']);
    addBlock(p2, date);
    insertTicket({ employeeId: e, psychologistId: p1, start: wibIso(date, '09:00') });
    const r = reserveSlot({ psychologistId: p2, date, time: '09:00', mode: 'chat' });
    expect(r).toEqual({ start: wibIso(date, '09:00'), end: wibIso(date, '10:00'), room: ROOMS[1] });
    expect(() => reserveSlot({ psychologistId: p1, date, time: '13:00', mode: 'chat' })).toThrow(/Media konseling/);
    expect(() => reserveSlot({ psychologistId: p1, date, time: '09:00', mode: 'offline' })).toThrow(/sudah tidak tersedia/);
  });

  it('availableDays hanya tanggal yang punya slot', () => {
    const p = makeUser('psychologist');
    addBlock(p, '2026-11-10');
    addBlock(p, '2026-10-30'); // sudah lewat
    const days = availableDays('2026-11', { psychologistId: p });
    expect(days).toEqual(['2026-11-10']);
    expect(availableDays('2026-11', { psychologistId: p, minDate: '2026-11-11' })).toEqual([]);
  });

  it('eligibility: satu booking aktif, kuota tahunan, jeda 2 minggu', () => {
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    expect(eligibility(e)).toMatchObject({ canBook: true, yearCount: 0, activeTicket: null, earliestDate: null });

    const past = insertTicket({ employeeId: e, psychologistId: p, start: wibIso('2026-10-26', '09:00'), status: 'completed' });
    const el = eligibility(e);
    expect(el.canBook).toBe(true);
    expect(el.yearCount).toBe(1);
    expect(el.earliestDate).toBe('2026-11-09');
    expect(() => assertSlotEligible(e, '2026-11-06')).toThrow(/minimal 2 minggu/);
    expect(() => assertSlotEligible(e, '2026-11-09')).not.toThrow();
    // Tiket yang sedang diubah jadwalnya dikecualikan.
    expect(() => assertSlotEligible(e, '2026-11-06', past)).not.toThrow();

    const active = insertTicket({ employeeId: e, psychologistId: p, start: wibIso('2026-11-20', '09:00') });
    expect(eligibility(e)).toMatchObject({ canBook: false, activeTicket: { id: active } });
    expect(eligibility(e, active).canBook).toBe(true);
  });

  it('eligibility: maks. 7 sesi setahun (batal tidak dihitung)', () => {
    const p = makeUser('psychologist');
    const e = makeUser('employee');
    for (let i = 0; i < ELIGIBILITY.maxPerYear; i++) {
      insertTicket({ employeeId: e, psychologistId: p, start: wibIso(`2026-${String(i + 1).padStart(2, '0')}-05`, '09:00'), status: 'completed' });
    }
    insertTicket({ employeeId: e, psychologistId: p, start: wibIso('2026-09-07', '09:00'), status: 'cancelled' });
    expect(eligibility(e)).toMatchObject({ canBook: false, yearCount: 7 });
    expect(() => assertSlotEligible(e, '2026-12-14')).toThrow(/Kuota/);
    expect(() => assertSlotEligible(e, '2027-01-11')).not.toThrow();
  });
});

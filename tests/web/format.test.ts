import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addMinutes,
  ageOf,
  firstName,
  fmtBytes,
  fmtDate,
  fmtDay,
  fmtSchedule,
  fmtTime,
  fmtYmd,
  fullPsychName,
  greeting,
  hmDot,
  todayWib,
  wib,
  ymd,
} from '@/lib/format';

afterEach(() => vi.useRealTimers());
const at = (iso: string) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
};

describe('format: WIB di zona waktu perangkat mana pun', () => {
  it('wib menggeser jam dinding ke WIB', () => {
    const d = wib('2026-11-02T01:00:00.000Z');
    expect([d.getHours(), d.getMinutes(), d.getDate()]).toEqual([8, 0, 2]);
    expect(fmtTime('2026-11-02T01:30:00.000Z')).toBe('08.30');
    expect(fmtDate('2026-11-02T18:00:00.000Z')).toBe('3 Nov 2026');
    expect(fmtDate('2026-11-02T01:00:00.000Z', 'EEEE')).toBe('Senin');
  });

  it('todayWib & greeting memakai tanggal/jam WIB', () => {
    at('2026-11-02T18:30:00.000Z'); // 3 Nov 01.30 WIB
    expect(todayWib()).toBe('2026-11-03');
    expect(greeting()).toBe('Selamat malam');
    at('2026-11-02T01:00:00.000Z'); // 08.00 WIB
    expect(greeting()).toBe('Selamat pagi');
    at('2026-11-02T06:00:00.000Z'); // 13.00 WIB
    expect(greeting()).toBe('Selamat siang');
    at('2026-11-02T09:00:00.000Z'); // 16.00 WIB
    expect(greeting()).toBe('Selamat sore');
  });

  it('fmtDay: hari ini / besok / kemarin menurut WIB', () => {
    at('2026-11-02T03:00:00.000Z'); // Senin 10.00 WIB
    expect(fmtDay('2026-11-02T08:00:00.000Z')).toBe('Hari ini');
    expect(fmtDay('2026-11-03T02:00:00.000Z')).toBe('Besok');
    expect(fmtDay('2026-11-01T02:00:00.000Z')).toBe('Kemarin');
    expect(fmtDay('2026-11-05T02:00:00.000Z')).toBe('Kamis, 5 Nov');
  });

  it('fmtDay tetap benar saat tanggal UTC dan WIB berbeda', () => {
    at('2026-11-02T18:00:00.000Z'); // Selasa 3 Nov 01.00 WIB (masih 2 Nov di UTC)
    expect(fmtDay('2026-11-03T02:00:00.000Z')).toBe('Hari ini'); // 3 Nov 09.00 WIB
    expect(fmtDay('2026-11-02T03:00:00.000Z')).toBe('Kemarin'); // 2 Nov 10.00 WIB
    expect(fmtDay('2026-11-04T02:00:00.000Z')).toBe('Besok');
  });

  it('fmtSchedule', () => {
    at('2026-11-02T00:00:00.000Z');
    expect(fmtSchedule(null)).toBe('Belum dijadwalkan');
    expect(fmtSchedule('2026-11-02T02:00:00.000Z', '2026-11-02T03:00:00.000Z')).toBe('Hari ini · 09.00–10.00');
    expect(fmtSchedule('2026-11-02T02:00:00.000Z')).toBe('Hari ini · 09.00');
  });

  it('helper tanggal & teks', () => {
    expect(fmtYmd('2026-11-02')).toBe('Senin, 2 November 2026');
    expect(fmtYmd('2026-11-02', 'd MMM')).toBe('2 Nov');
    expect(hmDot('08:30')).toBe('08.30');
    expect(addMinutes('08:30', 60)).toBe('09:30');
    expect(addMinutes('11:45', 30)).toBe('12:15');
    expect(ymd(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(firstName('Vanda Violetta')).toBe('Vanda');
    expect(fullPsychName({ name: 'Vanda', title: 'S.Psi., Psikolog' })).toBe('Vanda, S.Psi., Psikolog');
    expect(fullPsychName({ name: 'Vanda', title: null })).toBe('Vanda');
  });

  it('ageOf', () => {
    at('2026-11-02T00:00:00.000Z');
    expect(ageOf(null)).toBeNull();
    expect(ageOf('1990-11-01')).toBe(36);
    expect(ageOf('1990-12-01')).toBe(35);
  });

  it('fmtBytes', () => {
    expect(fmtBytes(512)).toBe('512 B');
    expect(fmtBytes(2048)).toBe('2 KB');
    expect(fmtBytes(1.5 * 1024 * 1024)).toBe('1,5 MB');
    expect(fmtBytes(2 * 1024 * 1024)).toBe('2,0 MB');
  });
});

import { describe, expect, it } from 'vitest';
import { breaksText, candidateStarts, dayName, DEFAULT_CONFIG, fillInfo, gapText, timeOptions, type ServiceConfig } from '@/lib/config';
import { candidateStarts as sharedStarts, TIME_OPTIONS } from '@shared/constants';

const cfg = (over: Partial<ServiceConfig['schedule']> = {}, rest: Partial<ServiceConfig> = {}): ServiceConfig => ({
  ...DEFAULT_CONFIG,
  ...rest,
  schedule: { ...DEFAULT_CONFIG.schedule, ...over },
});

describe('lib/config', () => {
  it('DEFAULT_CONFIG sama dengan bentuk GET /api/meta/config', async () => {
    const { SERVICE_CONFIG } = await import('../../server/serviceConfig');
    expect(DEFAULT_CONFIG).toEqual(SERVICE_CONFIG);
  });

  it('gapText', () => {
    expect(gapText(14)).toBe('2 minggu');
    expect(gapText(7)).toBe('1 minggu');
    expect(gapText(10)).toBe('10 hari');
    expect(gapText(0)).toBe('0 hari');
  });

  it('timeOptions mengikuti jam buka/tutup & langkah', () => {
    expect(timeOptions(DEFAULT_CONFIG)).toEqual(TIME_OPTIONS);
    expect(timeOptions(cfg({ open: '09:00', close: '10:00', stepMin: 15 }))).toEqual(['09:00', '09:15', '09:30', '09:45', '10:00']);
    // Langkah < 5 menit dibatasi supaya tidak berulang tanpa henti.
    expect(timeOptions(cfg({ open: '09:00', close: '09:10', stepMin: 0 }))).toEqual(['09:00', '09:05', '09:10']);
  });

  it('candidateStarts sama dengan versi server untuk konfigurasi bawaan', () => {
    for (const d of ['2026-11-02', '2026-11-06', '2026-11-07', '2026-11-08']) {
      expect(candidateStarts(DEFAULT_CONFIG, d)).toEqual(sharedStarts(d));
    }
    expect(candidateStarts(DEFAULT_CONFIG, '2026-11-07')).toEqual([]);
  });

  it('candidateStarts: hari tanpa istirahat & hari layanan khusus', () => {
    const c = cfg({ workDays: [6], breaks: {}, open: '08:00', close: '10:00' });
    expect(candidateStarts(c, '2026-11-07')).toEqual([480, 510, 540]);
    expect(candidateStarts(c, '2026-11-02')).toEqual([]);
  });

  it('breaksText mengelompokkan hari berurutan dengan jam sama', () => {
    expect(breaksText(DEFAULT_CONFIG)).toBe('Senin–Kamis 12.00–13.00, Jumat 11.30–13.30');
    const c = cfg({ workDays: [1, 3, 4], breaks: { '1': { start: '12:00', end: '13:00' }, '3': { start: '12:00', end: '13:00' }, '4': { start: '12:00', end: '13:00' } } });
    expect(breaksText(c)).toBe('Senin 12.00–13.00, Rabu–Kamis 12.00–13.00');
    expect(breaksText(cfg({ breaks: {} }))).toBe('');
  });

  it('dayName & fillInfo', () => {
    expect(dayName(0)).toBe('Minggu');
    expect(dayName(5)).toBe('Jumat');
    expect(dayName(9)).toBe('9');
    expect(fillInfo('{durasi} menit, toleransi {toleransi}, jeda {jeda}, H-{lead} jam, {durasi}', DEFAULT_CONFIG)).toBe(
      '60 menit, toleransi 15, jeda 2 minggu, H-4 jam, 60',
    );
  });
});

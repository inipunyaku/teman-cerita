import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_TYPES,
  attachmentExt,
  candidateStarts,
  CASE_CATEGORIES,
  fillSupportText,
  FEEDBACK_ITEMS,
  OCCUPYING_STATUSES,
  OUTCOME_LABEL,
  OUTCOMES,
  satisfactionLevel,
  SCHEDULE,
  scoreScreening,
  SCREENING_ITEMS,
  SUPPORT_DEFAULTS,
  TICKET_STATUS_LABEL,
  TIME_OPTIONS,
  toHM,
  toMin,
  weekday,
} from '@shared/constants';

describe('shared/constants', () => {
  it('toMin / toHM', () => {
    expect(toMin('08:30')).toBe(510);
    expect(toHM(510)).toBe('08:30');
    expect(toHM(0)).toBe('00:00');
    for (const hm of ['00:00', '12:05', '23:59']) expect(toHM(toMin(hm))).toBe(hm);
  });

  it('weekday tidak bergantung zona waktu perangkat', () => {
    expect(weekday('2026-11-02')).toBe(1);
    expect(weekday('2026-11-08')).toBe(0);
  });

  it('candidateStarts: jam operasional & istirahat', () => {
    const mon = candidateStarts('2026-11-02').map(toHM);
    expect(mon).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30']);
    const fri = candidateStarts('2026-11-06').map(toHM);
    expect(fri).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '13:30', '14:00', '14:30', '15:00', '15:30']);
    expect(candidateStarts('2026-11-07')).toEqual([]);
    expect(candidateStarts('2026-11-08')).toEqual([]);
    // Semua sesi selesai paling lambat jam tutup.
    expect(Math.max(...candidateStarts('2026-11-03')) + SCHEDULE.durationMin).toBeLessThanOrEqual(toMin(SCHEDULE.close));
  });

  it('TIME_OPTIONS 08.00–16.30 tiap 30 menit', () => {
    expect(TIME_OPTIONS[0]).toBe('08:00');
    expect(TIME_OPTIONS.at(-1)).toBe('16:30');
    expect(TIME_OPTIONS).toHaveLength(18);
  });

  it('scoreScreening membalik item favorable & menentukan level', () => {
    expect(SCREENING_ITEMS).toHaveLength(16);
    // Paling sehat: setuju penuh pada item positif, tidak setuju pada item negatif.
    const best = SCREENING_ITEMS.map((i) => (i.favorable ? 4 : 1));
    const worst = SCREENING_ITEMS.map((i) => (i.favorable ? 1 : 4));
    expect(scoreScreening(best)).toEqual({ score: 16, level: 'rendah' });
    expect(scoreScreening(worst)).toEqual({ score: 64, level: 'tinggi' });
    const all2 = scoreScreening(SCREENING_ITEMS.map(() => 2));
    const favorable = SCREENING_ITEMS.filter((i) => i.favorable).length;
    expect(all2.score).toBe(favorable * 3 + (16 - favorable) * 2);
  });

  it('scoreScreening: batas kategori 32 / 44', () => {
    const at = (target: number) => {
      // Mulai dari skor 16 lalu naikkan item demi item.
      const a = SCREENING_ITEMS.map((i) => (i.favorable ? 4 : 1));
      let s = 16;
      for (let i = 0; s < target; i = (i + 1) % 16) {
        const item = SCREENING_ITEMS[i];
        if (item.favorable ? a[i] > 1 : a[i] < 4) {
          a[i] += item.favorable ? -1 : 1;
          s++;
        }
      }
      return scoreScreening(a);
    };
    expect(at(32)).toEqual({ score: 32, level: 'rendah' });
    expect(at(33)).toEqual({ score: 33, level: 'sedang' });
    expect(at(44)).toEqual({ score: 44, level: 'sedang' });
    expect(at(45)).toEqual({ score: 45, level: 'tinggi' });
  });

  it('satisfactionLevel: ≤20 rendah, 21–26 sedang, ≥27 tinggi', () => {
    expect(FEEDBACK_ITEMS).toHaveLength(8);
    expect(satisfactionLevel(8)).toBe('rendah');
    expect(satisfactionLevel(20)).toBe('rendah');
    expect(satisfactionLevel(21)).toBe('sedang');
    expect(satisfactionLevel(26)).toBe('sedang');
    expect(satisfactionLevel(27)).toBe('tinggi');
    expect(satisfactionLevel(32)).toBe('tinggi');
  });

  it('attachmentExt', () => {
    expect(attachmentExt('Laporan.Final.PDF')).toBe('pdf');
    expect(attachmentExt('foto.jpeg')).toBe('jpeg');
    expect(attachmentExt('.env')).toBe('env');
    expect(attachmentExt('')).toBe('');
    // Nama tanpa titik tidak punya ekstensi (bukan seluruh nama file).
    expect(attachmentExt('pdf')).toBe('');
    expect(attachmentExt('README')).toBe('');
    expect(ATTACHMENT_TYPES[attachmentExt('png')]).toBeUndefined();
  });

  it('fillSupportText', () => {
    expect(fillSupportText('±{waktu_respons} menit, tunggu {batas_tunggu}; {waktu_respons}', { responseMinutes: 5, waitMinutes: 10 })).toBe('±5 menit, tunggu 10; 5');
    expect(SUPPORT_DEFAULTS.waitMinutes).toBeGreaterThanOrEqual(SUPPORT_DEFAULTS.responseMinutes);
  });

  it('label lengkap untuk semua status, hasil, kategori', () => {
    expect(Object.keys(TICKET_STATUS_LABEL)).toHaveLength(6);
    expect(OCCUPYING_STATUSES).not.toContain('cancelled');
    for (const o of OUTCOMES) expect(OUTCOME_LABEL[o]).toBeTruthy();
    for (const c of Object.values(CASE_CATEGORIES)) expect(c.label && c.desc).toBeTruthy();
  });
});

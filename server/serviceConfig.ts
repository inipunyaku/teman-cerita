import {
  CHAT_GRACE_DAYS,
  COMPLAINT_MIN,
  ELIGIBILITY,
  ROOMS,
  ROOM_PREFIX,
  SCHEDULE,
  SCREENING_CUTOFF,
} from '../shared/constants.js';

/**
 * Pengaturan layanan untuk tampilan (GET /api/meta/config). Di app (be-teman-cerita) nilai ini bisa diubah super
 * admin; mockup memakai nilai tetap dengan bentuk data yang sama supaya kode tampilan seragam.
 */
export const SERVICE_CONFIG = {
  schedule: {
    open: SCHEDULE.open,
    close: SCHEDULE.close,
    stepMin: SCHEDULE.stepMin,
    durationMin: SCHEDULE.durationMin,
    gapMin: SCHEDULE.gapMin,
    leadHours: SCHEDULE.leadHours,
    maxPerPsychPerDay: SCHEDULE.maxPerPsychPerDay,
    workDays: [...SCHEDULE.workDays],
    breaks: Object.fromEntries(Object.entries(SCHEDULE.breaks).map(([d, [start, end]]) => [d, { start, end }])),
  },
  roomPrefix: ROOM_PREFIX,
  rooms: ROOMS,
  maxPerYear: ELIGIBILITY.maxPerYear,
  minGapDays: ELIGIBILITY.minGapDays,
  chatGraceDays: CHAT_GRACE_DAYS,
  attachmentMaxMB: 2,
  /** Maksimal file lampiran per sesi chat. */
  attachmentsPerTicket: 5,
  /** Foto profil dikompres di browser sampai di bawah batas ini. */
  avatarMaxKB: 150,
  complaintMin: COMPLAINT_MIN,
  lateToleranceMin: SCHEDULE.lateToleranceMin,
  screeningCutoffLow: SCREENING_CUTOFF.rendah,
  screeningCutoffMid: SCREENING_CUTOFF.sedang,
  satisfactionLow: 20,
  satisfactionMid: 26,
};

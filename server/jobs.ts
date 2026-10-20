/** Tugas berkala: menutup sesi yang sudah lewat waktunya dan mengirim pengingat H-1. */
import { db, now } from './db.js';
import { formatWhen, notify } from './notify.js';
import { broadcastTicket, linkFor, logEvent } from './routes/tickets.js';
import { notifySupportUnavailable } from './routes/support.js';
import { MODE_LABEL, ROOM_PREFIX, type Mode } from '../shared/constants.js';

interface Due {
  id: number;
  code: string;
  employee_id: number;
  psychologist_id: number;
  nickname: string;
  mode: Mode;
  room: string | null;
  scheduled_start: string;
  created_at: string;
  psychologist_name: string;
}

const DUE_COLS = `t.id, t.code, t.employee_id, t.psychologist_id, t.nickname, t.mode, t.room, t.scheduled_start, t.created_at, p.name AS psychologist_name`;

function closeEndedSessions() {
  const ended = db
    .prepare(`SELECT ${DUE_COLS} FROM tickets t JOIN users p ON p.id = t.psychologist_id WHERE t.status IN ('scheduled','in_progress') AND t.scheduled_end <= ?`)
    .all(now()) as Due[];
  for (const t of ended) {
    db.prepare(`UPDATE tickets SET status = 'awaiting_report', ended_at = COALESCE(ended_at, scheduled_end), updated_at = ? WHERE id = ?`).run(now(), t.id);
    logEvent(t.id, null, 'ended', 'Waktu sesi berakhir. Menunggu hasil dari psikolog.');
    notify(t.psychologist_id, {
      type: 'session.report_due',
      title: `Isi hasil sesi ${t.code}`,
      body: `Sesi dengan ${t.nickname} sudah berakhir. Lengkapi form pasca-sesi (atau tandai no show).`,
      link: linkFor('psychologist', t.id),
      email: false,
    });
    broadcastTicket(t);
  }
}

function sendReminders() {
  const ts = Date.now();
  const due = db
    .prepare(
      `SELECT ${DUE_COLS} FROM tickets t JOIN users p ON p.id = t.psychologist_id
       WHERE t.status = 'scheduled' AND t.reminder_sent_at IS NULL AND t.scheduled_start > ? AND t.scheduled_start <= ?`,
    )
    .all(new Date(ts).toISOString(), new Date(ts + 24 * 3600e3).toISOString()) as Due[];
  for (const t of due) {
    db.prepare('UPDATE tickets SET reminder_sent_at = ? WHERE id = ?').run(now(), t.id);
    // Booking yang dibuat kurang dari 24 jam sebelum sesi sudah mendapat konfirmasi; tidak perlu pengingat lagi.
    if (Date.parse(t.scheduled_start) - Date.parse(t.created_at) < 24 * 3600e3) continue;
    const where = t.mode === 'offline' ? ` di ${ROOM_PREFIX} – ${t.room}` : t.mode === 'online' ? ' lewat Microsoft Teams' : ' lewat ruang chat aplikasi';
    notify(t.employee_id, {
      type: 'ticket.reminder',
      title: 'Pengingat: sesi konselingmu besok',
      body: `${MODE_LABEL[t.mode]} bersama ${t.psychologist_name}, ${formatWhen(t.scheduled_start)}${where}. Toleransi keterlambatan maksimal 15 menit ya.`,
      link: linkFor('employee', t.id),
    });
    notify(t.psychologist_id, {
      type: 'ticket.reminder',
      title: `Pengingat sesi ${t.code}`,
      body: `${t.nickname} · ${MODE_LABEL[t.mode]}, ${formatWhen(t.scheduled_start)}.`,
      link: linkFor('psychologist', t.id),
      email: false,
    });
  }
}

export function startJobs() {
  const run = () => {
    try {
      closeEndedSessions();
      sendReminders();
    } catch (e) {
      console.error('[jobs]', e);
    }
  };
  run();
  setInterval(run, 60_000).unref();
  // Info "admin tidak tersedia" di chat bantuan dicek lebih sering supaya tepat waktu.
  setInterval(() => {
    try {
      notifySupportUnavailable();
    } catch (e) {
      console.error('[jobs] chat bantuan', e);
    }
  }, 20_000).unref();
}

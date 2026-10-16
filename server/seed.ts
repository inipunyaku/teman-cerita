/**
 * Mengisi database dengan akun demo + data contoh.
 * Jalankan: npm run seed            (hanya jika database kosong)
 *           npm run seed -- --reset (hapus semua data lalu isi ulang)
 */
import bcrypt from 'bcryptjs';
import { db, tx } from './db.js';
import type { Mode, Severity, TicketStatus } from '../shared/constants.js';

const reset = process.argv.includes('--reset');
const hasUsers = (db.prepare('SELECT COUNT(*) n FROM users').get() as { n: number }).n > 0;
if (hasUsers && !reset) {
  console.log('Database sudah berisi data. Pakai --reset untuk mengisi ulang.');
  process.exit(0);
}

// PRNG deterministik supaya data demo selalu sama.
let s = 20261015;
const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const weighted = <T>(pairs: [T, number][]) => {
  const total = pairs.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[0][0];
};

const HASH = bcrypt.hashSync('demo1234', 10);
const DAY = 864e5;
const NOW = Date.now();
/** Waktu dalam WIB (UTC+7) → ISO UTC. */
const wib = (dayOffset: number, hour: number, minute = 0) => {
  const d = new Date(NOW + dayOffset * DAY);
  const ymd = new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
  return new Date(`${ymd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+07:00`).toISOString();
};

tx(() => {
  if (reset) {
    for (const t of ['notifications', 'messages', 'reviews', 'report_topics', 'reports', 'reschedule_requests', 'ticket_events', 'tickets', 'users', 'units']) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
  }
  const created = new Date(NOW - 200 * DAY).toISOString();

  // ---- Unit kerja
  const UNITS: [string, string][] = [
    ['Divisi Human Capital', 'HC'],
    ['Divisi Teknologi Informasi', 'TI'],
    ['Divisi Operasional', 'OPS'],
    ['Divisi Bisnis Mikro', 'MKR'],
    ['Divisi Manajemen Risiko', 'RSK'],
    ['Divisi Keuangan', 'KEU'],
    ['Divisi Digital Banking', 'DGB'],
    ['Kantor Wilayah Jakarta', 'KWJ'],
    ['Kantor Cabang Bandung', 'KCB'],
    ['Corporate University', 'CU'],
  ];
  const unitId: Record<string, number> = {};
  for (const [name, code] of UNITS) {
    unitId[code] = Number(db.prepare('INSERT INTO units (name, code, active, created_at) VALUES (?,?,1,?)').run(name, code, created).lastInsertRowid);
  }

  // ---- Akun
  const insUser = db.prepare(
    `INSERT INTO users (role, name, email, pn, phone, unit_id, title, bio, avatar_tone, status_text, password_hash, status, reject_reason, verified_at, created_at, updated_at)
     VALUES (@role, @name, @email, @pn, @phone, @unit, @title, @bio, @tone, @statusText, @hash, @status, @reject, @verified, @created, @created)`,
  );
  const user = (u: Partial<Record<string, unknown>> & { role: string; name: string; email: string }) =>
    Number(
      insUser.run({
        pn: null, phone: null, unit: null, title: null, bio: null, tone: null, statusText: null, hash: HASH, status: 'verified', reject: null,
        verified: created, created, ...u,
      }).lastInsertRowid,
    );

  const admin = user({ role: 'admin', name: 'Admin Teman Cerita', email: 'admin@temancerita.id', phone: '081200000001' });
  const psych = [
    user({ role: 'psychologist', name: 'Nadia Pramesti', email: 'psikolog@temancerita.id', phone: '081200000011', tone: 'mint', statusText: 'Siap mendengarkan, pelan-pelan saja', title: 'M.Psi., Psikolog', bio: 'Psikolog klinis dewasa. Fokus pada stres kerja, kecemasan, dan keseimbangan hidup.' }),
    user({ role: 'psychologist', name: 'Bima Adiwangsa', email: 'psikolog2@temancerita.id', phone: '081200000012', tone: 'sun', statusText: 'Kopi dulu, baru ngobrol', title: 'M.Psi., Psikolog', bio: 'Psikolog industri & organisasi. Senang membahas karier, relasi kerja, dan burnout.' }),
    user({ role: 'psychologist', name: 'Sekar Ayuningtyas', email: 'psikolog3@temancerita.id', phone: '081200000013', tone: 'peach', statusText: 'Hari ini sesi tatap muka', title: 'M.Psi., Psikolog', bio: 'Pendampingan keluarga, pasangan, serta duka dan kehilangan.' }),
  ];

  const demoEmployee = user({ role: 'employee', name: 'Rani Kusumawardani', email: 'karyawan@temancerita.id', pn: '90001234', phone: '081234567890', tone: 'lilac', statusText: 'Lagi belajar istirahat', unit: unitId.TI, verified: new Date(NOW - 150 * DAY).toISOString() });
  user({ role: 'employee', name: 'Dimas Pratama', email: 'baru@temancerita.id', pn: '90005678', phone: '081298765432', unit: unitId.OPS, status: 'pending', verified: null, created: new Date(NOW - 2 * 3600e3).toISOString() });
  user({ role: 'employee', name: 'Putri Maharani', email: 'putri.m@temancerita.id', pn: '90005679', phone: '081377788899', unit: unitId.KCB, status: 'pending', verified: null, created: new Date(NOW - 26 * 3600e3).toISOString() });
  user({ role: 'employee', name: 'Yoga Saputra', email: 'yoga.s@temancerita.id', pn: '9000567', phone: '081311122233', unit: unitId.DGB, status: 'rejected', reject: 'PN tidak ditemukan di data kepegawaian. Mohon cek kembali PN kamu.', verified: null });

  const FIRST = ['Andi', 'Bayu', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Galih', 'Hana', 'Indra', 'Joko', 'Kirana', 'Laras', 'Made', 'Nanda', 'Oki', 'Prita', 'Raka', 'Salsa', 'Tegar', 'Utami', 'Vina', 'Wulan', 'Yudha', 'Zahra', 'Arif', 'Bunga', 'Cahya', 'Damar', 'Elsa', 'Farhan', 'Gita', 'Hendra', 'Intan', 'Kevin', 'Lina', 'Mira'];
  const LAST = ['Santoso', 'Wijaya', 'Lestari', 'Hidayat', 'Permata', 'Nugroho', 'Kurniawan', 'Rahmawati', 'Siregar', 'Pangestu', 'Anggraini', 'Saputri', 'Halim', 'Wibowo', 'Utomo'];
  const unitCodes = Object.keys(unitId);
  const unitWeight: Record<string, number> = { TI: 5, OPS: 5, MKR: 6, DGB: 4, KWJ: 4, KCB: 3, RSK: 2, KEU: 2, HC: 2, CU: 1 };
  const employees: { id: number; unit: string }[] = [{ id: demoEmployee, unit: 'TI' }];
  FIRST.forEach((first, i) => {
    const unit = weighted(unitCodes.map((c) => [c, unitWeight[c]] as [string, number]));
    const name = `${first} ${pick(LAST)}`;
    const id = user({
      role: 'employee', name, email: `${first.toLowerCase()}${i}@temancerita.id`, pn: String(90010000 + i * 37),
      phone: `0812${String(30000000 + i * 1291).slice(0, 8)}`, unit: unitId[unit],
    });
    employees.push({ id, unit });
  });

  // ---- Tiket
  const insTicket = db.prepare(
    `INSERT INTO tickets (code, employee_id, unit_id, psychologist_id, topic, story, preferred_mode, mode, urgency, preferred_slots, status,
       scheduled_start, scheduled_end, location, meeting_url, admin_note, cancel_reason, cancelled_by, first_scheduled_at, started_at, completed_at, created_at, updated_at)
     VALUES (@code, @employee, @unit, @psych, @topic, @story, @mode, @mode, @urgency, @slots, @status,
       @start, @end, @location, @meeting, @note, @cancelReason, @cancelledBy, @firstScheduled, @started, @completed, @created, @updated)`,
  );
  const insEvent = db.prepare('INSERT INTO ticket_events (ticket_id, actor_id, type, message, created_at) VALUES (?,?,?,?,?)');
  const insReport = db.prepare(
    'INSERT INTO reports (ticket_id, psychologist_id, severity, summary, recommendation, note_for_employee, follow_up, created_at) VALUES (?,?,?,?,?,?,?,?)',
  );
  const insTopic = db.prepare('INSERT OR IGNORE INTO report_topics (ticket_id, topic) VALUES (?,?)');
  const insReview = db.prepare('INSERT INTO reviews (ticket_id, rating, comment, created_at) VALUES (?,?,?,?)');
  const insMsg = db.prepare('INSERT INTO messages (ticket_id, sender_id, body, read_at, created_at) VALUES (?,?,?,?,?)');

  const year = new Date().getFullYear();
  let seq = 0;
  const MODE_TEXT: Record<Mode, string> = { chat: 'Chat', online: 'Online meeting', offline: 'Tatap muka' };
  const psychName = (id: number) => (db.prepare('SELECT name FROM users WHERE id = ?').get(id) as { name: string }).name;
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(iso)) + ' WIB';

  const STORIES: Record<string, string[]> = {
    pekerjaan: ['Akhir-akhir ini target makin berat dan aku sering lembur sampai malam. Rasanya capek terus.', 'Aku baru dipindah ke tim baru dan merasa kewalahan dengan tanggung jawabnya.', 'Susah fokus kerja, sering merasa tidak cukup baik.'],
    relasi_kerja: ['Ada konflik dengan atasan yang bikin aku tidak nyaman datang ke kantor.', 'Komunikasi di tim lagi kurang baik, aku merasa dikucilkan.'],
    keluarga: ['Orang tua sedang sakit dan aku harus membagi waktu antara kerja dan merawat mereka.', 'Sedang ada masalah dengan pasangan dan berpengaruh ke pekerjaan.'],
    keuangan: ['Cicilan menumpuk dan aku jadi susah tidur memikirkannya.', 'Aku sedang kesulitan mengatur keuangan setelah ada kebutuhan mendadak.'],
    kesehatan_mental: ['Sering cemas tanpa alasan jelas, kadang jantung berdebar sebelum rapat.', 'Mood naik-turun beberapa minggu ini, aku ingin ngobrol dengan ahlinya.'],
    pengembangan_diri: ['Aku bingung arah karier ke depan, butuh teman diskusi.', 'Ingin belajar mengelola emosi dan stres dengan lebih baik.'],
    lainnya: ['Ada yang mengganjal tapi aku belum tahu cara menjelaskannya.'],
  };
  const reqTopicFor = (unit: string) =>
    weighted<string>(
      unit === 'TI' || unit === 'DGB'
        ? [['pekerjaan', 6], ['kesehatan_mental', 3], ['relasi_kerja', 2], ['pengembangan_diri', 2], ['keluarga', 1], ['keuangan', 1]]
        : unit === 'MKR' || unit === 'OPS'
          ? [['pekerjaan', 4], ['keuangan', 4], ['relasi_kerja', 3], ['keluarga', 2], ['kesehatan_mental', 2]]
          : unit === 'KWJ' || unit === 'KCB'
            ? [['keluarga', 4], ['pekerjaan', 3], ['relasi_kerja', 3], ['keuangan', 2], ['kesehatan_mental', 1]]
            : [['pekerjaan', 3], ['pengembangan_diri', 3], ['kesehatan_mental', 2], ['keluarga', 2], ['lainnya', 1]],
    );
  const REPORT_MAP: Record<string, string[]> = {
    pekerjaan: ['stres_kerja', 'beban_kerja', 'burnout'],
    relasi_kerja: ['relasi_kerja', 'stres_kerja'],
    keluarga: ['keluarga', 'pasangan', 'duka'],
    keuangan: ['keuangan', 'kecemasan'],
    kesehatan_mental: ['kecemasan', 'suasana_hati', 'kesehatan_fisik'],
    pengembangan_diri: ['karier', 'stres_kerja'],
    lainnya: ['lainnya', 'kecemasan'],
  };
  const SUMMARIES = [
    'Klien menceritakan tekanan target dan pola lembur. Dieksplorasi pemicu stres, pola tidur, dan dukungan sosial. Klien kooperatif dan reflektif.',
    'Klien menunjukkan gejala kecemasan ringan terkait pekerjaan. Diajarkan teknik pernapasan dan grounding. Klien menyatakan lebih lega.',
    'Fokus sesi pada konflik interpersonal dengan rekan kerja. Disusun strategi komunikasi asertif.',
    'Klien sedang menghadapi masalah keluarga yang berdampak pada konsentrasi kerja. Dilakukan validasi emosi dan pemetaan sumber dukungan.',
    'Klien mengalami kelelahan emosional berkepanjangan. Indikasi burnout. Disarankan diskusi beban kerja dengan atasan dan sesi lanjutan.',
  ];
  const RECS = ['Latihan pernapasan 4-7-8 setiap malam; jurnal singkat 5 menit.', 'Sesi lanjutan 2 minggu lagi untuk evaluasi.', 'Diskusikan prioritas pekerjaan dengan atasan; batasi lembur.', 'Pertimbangkan rujukan ke psikiater bila gejala menetap.'];
  const NOTES = ['Terima kasih sudah berani cerita. Coba latihan napas yang kita bahas tadi ya, pelan-pelan saja.', 'Kamu sudah melakukan yang terbaik. Ingat untuk istirahat cukup, dan kabari kalau butuh ngobrol lagi.', ''];
  const COMMENTS = ['Psikolognya sabar banget, aku merasa didengar.', 'Sangat membantu, terima kasih!', 'Jadwalnya fleksibel dan nyaman.', 'Lega setelah cerita.', null, null];

  type Spec = {
    employee: number; unit: string; createdDay: number; status: TicketStatus; mode?: Mode; psych?: number; topic?: string;
    urgency?: string; schedDay?: number; hour?: number; severity?: Severity; review?: boolean; story?: string;
  };

  const makeTicket = (sp: Spec) => {
    seq += 1;
    const code = `TC-${year}-${String(seq).padStart(4, '0')}`;
    const topic = sp.topic ?? reqTopicFor(sp.unit);
    const mode = sp.mode ?? weighted<Mode>([['chat', 4], ['online', 4], ['offline', 3]]);
    const urgency = sp.urgency ?? weighted([['low', 3], ['normal', 6], ['high', 1]]);
    const createdAt = wib(sp.createdDay, 8 + Math.floor(rand() * 9), Math.floor(rand() * 60));
    const hasSchedule = sp.status !== 'pending' && !(sp.status === 'cancelled' && !sp.psych);
    const psychId = hasSchedule ? (sp.psych ?? pick(psych)) : null;
    let schedDay = sp.schedDay ?? sp.createdDay + 2 + Math.floor(rand() * 4);
    // Sesi hanya di hari kerja.
    while ([0, 6].includes(new Date(NOW + schedDay * DAY + 7 * 3600e3).getUTCDay())) schedDay += 1;
    const hour = sp.hour ?? 9 + Math.floor(rand() * 7);
    const start = hasSchedule ? wib(schedDay, hour) : null;
    const end = hasSchedule ? wib(schedDay, hour + 1) : null;
    const firstScheduled = hasSchedule ? new Date(Date.parse(createdAt) + (4 + rand() * 30) * 3600e3).toISOString() : null;
    const started = sp.status === 'in_progress' || sp.status === 'completed' ? start : null;
    const completed = sp.status === 'completed' ? end : null;
    const slots: unknown[] = []; // jadwal ditentukan admin
    const id = Number(
      insTicket.run({
        code, employee: sp.employee, unit: unitId[sp.unit], psych: psychId, topic,
        story: sp.story ?? (rand() < 0.8 ? pick(STORIES[topic]) : null), mode, urgency, slots: JSON.stringify(slots),
        status: sp.status, start, end,
        location: hasSchedule && mode === 'offline' ? pick(['Ruang Konseling Lt. 3, Gedung Pusat', 'Ruang Teduh Lt. 5', 'Ruang Konseling Kanwil Jakarta']) : null,
        meeting: hasSchedule && mode === 'online' ? `https://meet.google.com/tcr-${code.slice(-4)}-sesi` : null,
        note: hasSchedule && rand() < 0.3 ? 'Mohon hadir 5 menit lebih awal ya.' : null,
        cancelReason: sp.status === 'cancelled' ? pick(['Sudah merasa lebih baik, terima kasih.', 'Ada tugas dinas mendadak.', 'Ingin mengajukan ulang di lain waktu.']) : null,
        cancelledBy: sp.status === 'cancelled' ? sp.employee : null,
        firstScheduled, started, completed, created: createdAt, updated: completed ?? firstScheduled ?? createdAt,
      }).lastInsertRowid,
    );
    insEvent.run(id, sp.employee, 'created', `Permintaan diajukan (${MODE_TEXT[mode]}).`, createdAt);
    if (hasSchedule && firstScheduled) insEvent.run(id, admin, 'scheduled', `Dijadwalkan dengan ${psychName(psychId!)} — ${fmt(start!)} (${MODE_TEXT[mode]}).`, firstScheduled);
    if (started) insEvent.run(id, psychId, 'started', 'Sesi dimulai.', started);
    if (sp.status === 'cancelled') insEvent.run(id, sp.employee, 'cancelled', 'Dibatalkan oleh karyawan.', new Date(Date.parse(createdAt) + 30 * 3600e3).toISOString());

    if (sp.status === 'completed') {
      const severity = sp.severity ?? weighted<Severity>([['ringan', 40], ['sedang', 35], ['berat', 19], ['kritis', 6]]);
      const followUp = severity === 'berat' || severity === 'kritis' || rand() < 0.25;
      insReport.run(id, psychId, severity, pick(SUMMARIES), pick(RECS), pick(NOTES) || null, followUp ? 1 : 0, completed);
      const pool = REPORT_MAP[topic];
      insTopic.run(id, pool[0]);
      if (rand() < 0.6) insTopic.run(id, pick(pool));
      if (rand() < 0.25) insTopic.run(id, pick(['stres_kerja', 'kecemasan', 'keluarga', 'keuangan', 'burnout']));
      insEvent.run(id, psychId, 'completed', 'Sesi selesai dan laporan diisi.', completed);
      if (sp.review ?? rand() < 0.7) {
        const rating = weighted([[5, 6], [4, 3], [3, 1]]);
        insReview.run(id, rating, pick(COMMENTS), new Date(Date.parse(completed!) + 3 * 3600e3).toISOString());
        insEvent.run(id, sp.employee, 'reviewed', `Memberi ulasan ${rating}/5.`, new Date(Date.parse(completed!) + 3 * 3600e3).toISOString());
      }
    }
    return { id, psych: psychId, start };
  };

  // Riwayat 6 bulan — volume naik menjelang bulan ini supaya tren terlihat.
  const pool = employees.slice(1);
  for (let i = 0; i < 64; i++) {
    const e = pick(pool);
    const createdDay = -Math.floor(Math.pow(rand(), 0.8) * 175) - 6;
    const status = weighted<TicketStatus>([['completed', 88], ['cancelled', 8]]);
    makeTicket({ employee: e.id, unit: e.unit, createdDay, status });
  }

  // Riwayat demo karyawan.
  makeTicket({ employee: demoEmployee, unit: 'TI', createdDay: -95, status: 'completed', topic: 'pekerjaan', mode: 'online', psych: psych[0], severity: 'sedang', review: true });
  makeTicket({ employee: demoEmployee, unit: 'TI', createdDay: -40, status: 'completed', topic: 'kesehatan_mental', mode: 'chat', psych: psych[0], severity: 'ringan', review: false });

  // Tiket aktif: antrean admin & jadwal psikolog.
  const others = pool.filter((e) => e.id !== demoEmployee);
  let k = 0;
  const next = () => others[k++ % others.length];
  for (const urgency of ['high', 'normal', 'normal', 'low', 'normal']) {
    const e = next();
    makeTicket({ employee: e.id, unit: e.unit, createdDay: -Math.floor(rand() * 2), status: 'pending', urgency });
  }
  // Sesi psikolog demo hari ini dan mendatang.
  const today = [
    { hour: 9, status: 'completed' as TicketStatus },
    { hour: 13, status: 'scheduled' as TicketStatus },
    { hour: 15, status: 'scheduled' as TicketStatus },
  ];
  for (const t of today) {
    const e = next();
    makeTicket({ employee: e.id, unit: e.unit, createdDay: -3, status: t.status, psych: psych[0], schedDay: 0, hour: t.hour, mode: t.hour === 13 ? 'chat' : 'online' });
  }
  for (const d of [1, 2, 4]) {
    const e = next();
    makeTicket({ employee: e.id, unit: e.unit, createdDay: -2, status: 'scheduled', psych: psych[d % 2], schedDay: d });
  }
  for (const d of [1, 3]) {
    const e = next();
    makeTicket({ employee: e.id, unit: e.unit, createdDay: -1, status: 'scheduled', psych: psych[2], schedDay: d, mode: 'offline' });
  }
  // Satu permintaan jadwal ulang.
  {
    const e = next();
    const t = makeTicket({ employee: e.id, unit: e.unit, createdDay: -4, status: 'reschedule_requested', psych: psych[1], schedDay: 1, hour: 10, mode: 'offline' });
    const at = new Date(NOW - 5 * 3600e3).toISOString();
    db.prepare('INSERT INTO reschedule_requests (ticket_id, requested_by, reason, proposed_slots, created_at) VALUES (?,?,?,?,?)').run(
      t.id, e.id, 'Ada rapat evaluasi kuartal yang tidak bisa ditinggal.', '[]', at,
    );
    insEvent.run(t.id, e.id, 'reschedule_requested', 'Mengajukan jadwal ulang: Ada rapat evaluasi kuartal yang tidak bisa ditinggal.', at);
  }

  // Tiket aktif demo karyawan: chat dengan psikolog demo, besok.
  const active = makeTicket({
    employee: demoEmployee, unit: 'TI', createdDay: -1, status: 'scheduled', topic: 'pekerjaan', mode: 'chat', psych: psych[0], schedDay: 1, hour: 10, urgency: 'normal',
    story: 'Belakangan aku susah tidur karena kepikiran deadline rilis aplikasi. Rasanya kayak nggak pernah benar-benar istirahat.',
  });
  const t0 = NOW - 20 * 3600e3;
  const chat: [number, string, number][] = [
    [psych[0], 'Halo Rani, saya Nadia. Sesi kita dijadwalkan besok jam 10 lewat chat di sini ya. Kalau sebelum itu ada yang ingin kamu sampaikan, boleh langsung tulis.', 0],
    [demoEmployee, 'Halo Bu Nadia, terima kasih. Aku agak gugup karena ini pertama kali konseling lewat chat 😅', 0.4],
    [psych[0], 'Wajar sekali kok. Tidak ada jawaban benar atau salah, kita ngobrol pelan-pelan saja. Sampai besok ya.', 0.6],
  ];
  for (const [sender, body, h] of chat) {
    const at = new Date(t0 + h * 3600e3).toISOString();
    insMsg.run(active.id, sender, body, at, at);
  }

  // Urutkan nomor tiket sesuai waktu pengajuan.
  const ordered = db.prepare('SELECT id FROM tickets ORDER BY created_at').all() as { id: number }[];
  db.prepare(`UPDATE tickets SET code = 'tmp-' || id`).run();
  ordered.forEach((r, i) => db.prepare('UPDATE tickets SET code = ? WHERE id = ?').run(`TC-${year}-${String(i + 1).padStart(4, '0')}`, r.id));

  // Notifikasi contoh.
  const insNotif = db.prepare('INSERT INTO notifications (user_id, type, title, body, link, priority, read_at, created_at) VALUES (?,?,?,?,?,?,?,?)');
  const at = (h: number) => new Date(NOW - h * 3600e3).toISOString();
  insNotif.run(demoEmployee, 'ticket.scheduled', 'Sesimu sudah dijadwalkan', `Chat bersama Nadia Pramesti, ${fmt(active.start!)}. Sesi berlangsung lewat chat di aplikasi.`, `/tiket/${active.id}`, 0, null, at(18));
  insNotif.run(demoEmployee, 'account.verified', 'Akunmu sudah diverifikasi', 'Sekarang kamu bisa mengajukan sesi konseling kapan pun kamu butuh teman cerita.', '/', 0, at(140 * 24), at(150 * 24));
  insNotif.run(psych[0], 'ticket.assigned', `Sesi baru dijadwalkan`, `Chat dengan Rani Kusumawardani (Divisi Teknologi Informasi), ${fmt(active.start!)}.`, `/psikolog/sesi/${active.id}`, 0, null, at(18));
  insNotif.run(admin, 'account.pending', 'Akun baru menunggu verifikasi', 'Dimas Pratama (PN 90005678) mendaftar dan menunggu verifikasi.', '/admin/akun?status=pending', 0, null, at(2));
  insNotif.run(admin, 'ticket.created', 'Permintaan MENDESAK masuk', 'Ada permintaan dengan urgensi Mendesak yang menunggu penjadwalan.', '/admin/tiket?status=pending', 1, null, at(1));
});

const count = (t: string) => (db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n;
console.log(`Seed selesai: ${count('users')} akun, ${count('tickets')} tiket, ${count('reports')} laporan.`);
console.log('Login demo (password: demo1234): admin@temancerita.id · psikolog@temancerita.id · karyawan@temancerita.id · baru@temancerita.id');

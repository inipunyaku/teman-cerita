/**
 * Mengisi database dengan akun demo + data contoh.
 * Jalankan: npm run seed            (hanya jika database kosong)
 *           npm run seed -- --reset (hapus semua data lalu isi ulang)
 */
import bcrypt from 'bcryptjs';
import { db, tx } from './db.js';
import { addDays, wibIso, wibToday } from './scheduling.js';
import {
  candidateStarts,
  CASE_CATEGORIES,
  ROOMS,
  SCHEDULE,
  satisfactionLevel,
  scoreScreening,
  SCREENING_ITEMS,
  toHM,
  toMin,
  weekday,
  type ClientTopic,
  type Mode,
  type Outcome,
  type TicketStatus,
} from '../shared/constants.js';

const reset = process.argv.includes('--reset');
const hasUsers = (db.prepare('SELECT COUNT(*) n FROM users').get() as { n: number }).n > 0;
if (hasUsers && !reset) {
  console.log('Database sudah berisi data. Pakai --reset untuk mengisi ulang.');
  process.exit(0);
}

// PRNG deterministik supaya data demo selalu sama.
let s = 20261019;
const rand = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const weighted = <T>(pairs: [T, number][]) => {
  const total = pairs.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[0][0];
};

const HASH = bcrypt.hashSync('demo1234', 10);
const NOW = Date.now();
const TODAY = wibToday();
const day = (offset: number) => addDays(TODAY, offset);
const iso = (ms: number) => new Date(ms).toISOString();

tx(() => {
  if (reset) {
    for (const t of ['notifications', 'messages', 'feedback', 'reports', 'ticket_events', 'tickets', 'availability', 'users', 'units']) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
  }
  const created = iso(NOW - 400 * 864e5);

  // ---- Unit kerja (region mengikuti lokasi unit)
  const UNITS: [string, string, string][] = [
    ['Divisi Human Capital', 'HC', 'Kantor Pusat'],
    ['Divisi Teknologi Informasi', 'TI', 'Kantor Pusat'],
    ['Divisi Operasional', 'OPS', 'Kantor Pusat'],
    ['Divisi Bisnis Mikro', 'MKR', 'Kantor Pusat'],
    ['Divisi Manajemen Risiko', 'RSK', 'Kantor Pusat'],
    ['Divisi Digital Banking', 'DGB', 'Kantor Pusat'],
    ['Kantor Wilayah Jakarta 1', 'KWJ', 'Regional Jakarta 1'],
    ['Kantor Cabang Bandung', 'KCB', 'Regional Bandung'],
    ['Kantor Wilayah Surabaya', 'KWS', 'Regional Surabaya'],
    ['Kantor Cabang Medan', 'KCM', 'Regional Medan'],
    ['Corporate University', 'CU', 'Kantor Pusat'],
  ];
  const unitId: Record<string, number> = {};
  const unitRegion: Record<string, string> = {};
  for (const [name, code, region] of UNITS) {
    unitId[code] = Number(db.prepare('INSERT INTO units (name, code, active, created_at) VALUES (?,?,1,?)').run(name, code, created).lastInsertRowid);
    unitRegion[code] = region;
  }

  // ---- Akun
  const insUser = db.prepare(
    `INSERT INTO users (role, name, email, pn, phone, unit_id, title, bio, specialization, approach, languages, meeting_url,
       nickname, band, region, gender, birth_date, avatar_tone, status_text, password_hash, status, verified_at, created_at, updated_at)
     VALUES (@role, @name, @email, @pn, @phone, @unit, @title, @bio, @specialization, @approach, @languages, @meeting,
       @nickname, @band, @region, @gender, @birth, @tone, @statusText, @hash, 'verified', @created, @created, @created)`,
  );
  const user = (u: Partial<Record<string, unknown>> & { role: string; name: string; email: string }) =>
    Number(
      insUser.run({
        pn: null, phone: null, unit: null, title: null, bio: null, specialization: null, approach: null, languages: null, meeting: null,
        nickname: null, band: null, region: null, gender: null, birth: null, tone: null, statusText: null, hash: HASH, created, ...u,
      }).lastInsertRowid,
    );

  const admin = user({ role: 'admin', name: 'Admin Teman Cerita', email: 'admin@temancerita.id', phone: '081200000001' });

  type Psych = { id: number; name: string; days: number[]; blocks: (d: number) => [string, string, Mode[]][] };
  const morningAfternoon = (modesAm: Mode[], modesPm: Mode[]) => (d: number): [string, string, Mode[]][] =>
    d === 5 ? [['08:00', '11:30', modesAm], ['13:30', '16:30', modesPm]] : [['08:00', '12:00', modesAm], ['13:00', '16:30', modesPm]];
  const ALL: Mode[] = ['offline', 'chat', 'online'];
  const PSYCHS: (Omit<Psych, 'id'> & Record<string, unknown>)[] = [
    {
      name: 'Vanda Violetta Nidhar', email: 'psikolog@temancerita.id', title: 'S.Psi., Psikolog', tone: 'mint', phone: '081200000011',
      specialization: 'Personal Growth, Relasi', approach: 'Cognitive Behavioral Therapy (CBT), Person-Centered', languages: 'Indonesia, English',
      bio: 'Psikolog klinis dewasa yang berfokus pada pengembangan diri, relasi interpersonal, dan pengelolaan emosi.',
      statusText: 'Siap mendengarkan, pelan-pelan saja', days: [1, 2, 3, 4, 5], blocks: morningAfternoon(ALL, ALL),
    },
    {
      name: 'Ayuning Sekar Putih', email: 'psikolog2@temancerita.id', title: 'S.Psi., Psikolog', tone: 'peach', phone: '081200000012',
      specialization: 'Dewasa, Karier, Manajemen Stres', approach: 'Cognitive Behavioral Therapy (CBT), Solution Focused Therapy', languages: 'Indonesia, English',
      bio: 'Berpengalaman dalam memberikan layanan konseling bagi individu dewasa dengan fokus pada pengembangan diri, karier, dan manajemen stres.',
      statusText: 'Hari ini sesi tatap muka', days: [1, 2, 3, 4], blocks: morningAfternoon(['offline', 'online'], ['chat', 'online']),
    },
    {
      name: 'Made Ngurah Bagus', email: 'psikolog3@temancerita.id', title: 'M.A., M.Psi., Psikolog', tone: 'sun', phone: '081200000013',
      specialization: 'Kecemasan, Stres Kerja', approach: 'Acceptance and Commitment Therapy (ACT), Mindfulness', languages: 'Indonesia, English, Bali',
      bio: 'Psikolog klinis yang mendampingi pekerja menghadapi kecemasan, stres kerja, dan masa transisi.',
      statusText: 'Kopi dulu, baru ngobrol', days: [2, 3, 4, 5], blocks: () => [['09:00', '16:30', ALL]],
    },
    {
      name: 'Hendriasari Oktaviani', email: 'psikolog4@temancerita.id', title: 'S.Psi., Psikolog', tone: 'lilac', phone: '081200000014',
      specialization: 'Keluarga, Relasi, Duka', approach: 'Family Systems, Emotion-Focused Therapy', languages: 'Indonesia',
      bio: 'Pendampingan dinamika keluarga, relasi pasangan, serta duka dan kehilangan.',
      statusText: 'Ruang aman untuk bercerita', days: [1, 3, 5], blocks: () => [['08:00', '16:30', ['offline', 'chat']]],
    },
  ];
  const psychs: Psych[] = PSYCHS.map((p, i) => ({
    id: user({
      role: 'psychologist', name: p.name, email: p.email as string, title: p.title, tone: p.tone, phone: p.phone, bio: p.bio, statusText: p.statusText,
      specialization: p.specialization, approach: p.approach, languages: p.languages,
      meeting: `https://teams.microsoft.com/l/meetup-join/teman-cerita-psikolog-${i + 1}`,
    }),
    name: `${p.name}, ${p.title}`,
    days: p.days,
    blocks: p.blocks,
  }));

  const BANDS = ['Band 1', 'Band 2', 'Band 3', 'Band 4', 'Band 5'];
  const birth = (age: number) => `${new Date().getFullYear() - age}-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 28)).padStart(2, '0')}`;

  const demo = user({
    role: 'employee', name: 'Rani Kusumawardani', nickname: 'Rani', email: 'karyawan@temancerita.id', pn: '90001234', phone: '081234567890',
    unit: unitId.TI, band: 'Band 3', region: unitRegion.TI, gender: 'P', birth: '1996-04-12', tone: 'lilac', statusText: 'Lagi belajar istirahat',
  });

  const FIRST: [string, 'L' | 'P'][] = [
    ['Andi', 'L'], ['Bayu', 'L'], ['Citra', 'P'], ['Dewi', 'P'], ['Eka', 'P'], ['Fajar', 'L'], ['Galih', 'L'], ['Hana', 'P'], ['Indra', 'L'],
    ['Joko', 'L'], ['Kirana', 'P'], ['Laras', 'P'], ['Made', 'L'], ['Nanda', 'P'], ['Oki', 'L'], ['Prita', 'P'], ['Raka', 'L'], ['Salsa', 'P'],
    ['Tegar', 'L'], ['Utami', 'P'], ['Vina', 'P'], ['Wulan', 'P'], ['Yudha', 'L'], ['Zahra', 'P'], ['Arif', 'L'], ['Bunga', 'P'], ['Cahya', 'P'],
    ['Damar', 'L'], ['Elsa', 'P'], ['Farhan', 'L'], ['Gita', 'P'], ['Hendra', 'L'], ['Intan', 'P'], ['Kevin', 'L'], ['Lina', 'P'], ['Mira', 'P'],
    ['Nadia', 'P'], ['Putra', 'L'], ['Rizky', 'L'], ['Sinta', 'P'], ['Taufik', 'L'], ['Yuni', 'P'], ['Bagas', 'L'], ['Dinda', 'P'], ['Gilang', 'L'],
    ['Ratna', 'P'], ['Wahyu', 'L'], ['Ayu', 'P'], ['Dimas', 'L'], ['Fitri', 'P'],
  ];
  const LAST = ['Santoso', 'Wijaya', 'Lestari', 'Hidayat', 'Permata', 'Nugroho', 'Kurniawan', 'Rahmawati', 'Siregar', 'Pangestu', 'Anggraini', 'Saputri', 'Halim', 'Wibowo', 'Utomo'];
  const unitWeight: Record<string, number> = { TI: 5, OPS: 5, MKR: 6, DGB: 4, KWJ: 4, KCB: 3, KWS: 3, KCM: 2, RSK: 2, HC: 2, CU: 1 };
  const employees: { id: number; unit: string; nick: string }[] = [{ id: demo, unit: 'TI', nick: 'Rani' }];
  Array.from({ length: 240 }, (_, i) => FIRST[i % FIRST.length]).forEach(([first, gender], i) => {
    const unit = weighted(Object.entries(unitWeight));
    const id = user({
      role: 'employee', name: `${first} ${pick(LAST)}`, nickname: first, email: `${first.toLowerCase()}${i}@temancerita.id`,
      pn: String(90010000 + i * 37), phone: `0812${String(30000000 + i * 1291).slice(0, 8)}`, unit: unitId[unit], region: unitRegion[unit],
      band: weighted(BANDS.map((b, k) => [b, [2, 5, 6, 3, 1][k]] as [string, number])), gender, birth: birth(23 + Math.floor(rand() * 33)),
    });
    employees.push({ id, unit, nick: first });
  });

  // ---- Ketersediaan psikolog: ±8 bulan ke belakang sampai 5 minggu ke depan
  const insBlock = db.prepare('INSERT INTO availability (psychologist_id, date, start_time, end_time, modes, created_by, created_at) VALUES (?,?,?,?,?,?,?)');
  const blocksOf = new Map<string, [string, string, Mode[]][]>();
  for (let off = -240; off <= 35; off++) {
    const date = day(off);
    const wd = weekday(date);
    for (const p of psychs) {
      if (!p.days.includes(wd)) continue;
      const bs = p.blocks(wd);
      blocksOf.set(`${p.id}|${date}`, bs);
      for (const [a, b, modes] of bs) insBlock.run(p.id, date, a, b, JSON.stringify(modes), p.id, wibIso(addDays(date, -14), '09:00'));
    }
  }

  // ---- Tiket
  const insTicket = db.prepare(
    `INSERT INTO tickets (code, employee_id, unit_id, psychologist_id, status, mode, scheduled_start, scheduled_end, room, meeting_url,
       nickname, topic, complaint, impact, expectation, screening, screening_score, screening_level, consent_at, reschedule_count, reminder_sent_at,
       cancel_reason, cancelled_by, cancelled_at, started_at, ended_at, completed_at, created_at, updated_at)
     VALUES (@code, @employee, @unit, @psych, @status, @mode, @start, @end, @room, @meeting,
       @nickname, @topic, @complaint, @impact, @expectation, @screening, @score, @level, @created, @reschedules, @reminder,
       @cancelReason, @cancelledBy, @cancelledAt, @started, @ended, @completed, @created, @updated)`,
  );
  const insEvent = db.prepare('INSERT INTO ticket_events (ticket_id, actor_id, type, message, created_at) VALUES (?,?,?,?,?)');
  const insReport = db.prepare(
    `INSERT INTO reports (ticket_id, psychologist_id, outcome, goal, health_history, symptoms, summary, category, note_for_client, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const insFeedback = db.prepare('INSERT INTO feedback (ticket_id, answers, score, level, helpful, suggestion, created_at) VALUES (?,?,?,?,?,?,?)');
  const insMsg = db.prepare('INSERT INTO messages (ticket_id, sender_id, body, read_at, created_at) VALUES (?,?,?,?,?)');

  const COMPLAINTS: Record<ClientTopic, string[]> = {
    work_stress: [
      'Beberapa bulan terakhir target kerja terasa makin berat dan saya hampir setiap hari lembur sampai malam. Saya jadi mudah lelah, sulit tidur, dan merasa tidak pernah benar-benar istirahat.',
      'Sejak dipindah ke tim baru, tanggung jawab saya bertambah banyak dan saya merasa kewalahan. Saya sering merasa tidak cukup baik dan takut membuat kesalahan di depan atasan.',
    ],
    emotional_resilience: [
      'Akhir-akhir ini emosi saya naik turun dan saya mudah tersinggung, bahkan untuk hal kecil. Saya ingin belajar mengelola perasaan supaya tidak berdampak ke pekerjaan dan keluarga.',
      'Saya baru kehilangan anggota keluarga dan masih sulit fokus. Saya merasa harus terlihat baik-baik saja di kantor, padahal di dalam rasanya berat sekali.',
    ],
    personal_growth: [
      'Saya merasa stagnan dan bingung dengan arah hidup saya beberapa tahun ke depan. Saya ingin lebih mengenal diri sendiri, kekuatan, dan hal yang sebenarnya penting buat saya.',
      'Saya ingin membangun kebiasaan yang lebih sehat dan rasa percaya diri. Sering kali saya ragu mengambil keputusan dan terlalu memikirkan pendapat orang lain.',
    ],
    interpersonal: [
      'Ada konflik dengan rekan satu tim yang membuat suasana kerja tidak nyaman. Komunikasi kami sering salah paham dan saya jadi enggan datang ke kantor.',
      'Hubungan saya dengan pasangan sedang renggang dan itu terbawa ke pekerjaan. Saya ingin belajar berkomunikasi dengan lebih baik tanpa harus selalu bertengkar.',
    ],
    lainnya: [
      'Ada hal yang mengganjal di pikiran saya beberapa minggu ini tetapi saya belum tahu cara menjelaskannya. Saya ingin punya ruang untuk bercerita dengan orang yang netral.',
    ],
  };
  const EXPECT = [
    'Bisa lebih tenang dan punya cara mengelola stres yang praktis.',
    'Mendapat sudut pandang baru dan langkah konkret yang bisa saya coba.',
    'Merasa didengar dan lebih lega setelah bercerita.',
    'Bisa memahami diri sendiri dan tahu apa yang perlu saya ubah.',
  ];
  const TOPIC_CATEGORY: Record<ClientTopic, string[]> = {
    work_stress: ['beban_kerja', 'jam_kerja', 'beban_kerja', 'transisi'],
    emotional_resilience: ['kehidupan_pribadi', 'beban_kerja', 'transisi'],
    personal_growth: ['karier', 'transisi', 'kehidupan_pribadi'],
    interpersonal: ['rekan_kerja', 'kehidupan_pribadi', 'rekan_kerja'],
    lainnya: ['kehidupan_pribadi', 'transisi'],
  };
  const SUMMARIES = [
    'Klien menceritakan tekanan target dan pola lembur. Dieksplorasi pemicu stres, pola tidur, dan dukungan sosial. Klien kooperatif dan reflektif.',
    'Klien menunjukkan kecemasan terkait pekerjaan. Diajarkan teknik pernapasan dan grounding. Klien menyatakan lebih lega di akhir sesi.',
    'Fokus sesi pada konflik interpersonal dengan rekan kerja. Disusun strategi komunikasi asertif dan latihan role-play singkat.',
    'Klien menghadapi masalah keluarga yang berdampak pada konsentrasi kerja. Dilakukan validasi emosi dan pemetaan sumber dukungan.',
    'Klien mengalami kelelahan emosional berkepanjangan. Didiskusikan batasan kerja dan prioritas; disepakati evaluasi pada sesi berikutnya.',
  ];
  const SYMPTOMS = ['Sulit tidur, mudah lelah', 'Cemas sebelum rapat, jantung berdebar', 'Sulit konsentrasi, mudah tersinggung', 'Nafsu makan menurun', 'Sakit kepala tegang'];
  const NOTES = [
    'Terima kasih sudah berani bercerita. Coba latihan napas 4-7-8 yang kita bahas setiap malam sebelum tidur, pelan-pelan saja ya.',
    'Kamu sudah melakukan yang terbaik. Ingat untuk menyisihkan waktu istirahat di sela pekerjaan, dan kabari kalau butuh ngobrol lagi.',
    'Teruskan menulis jurnal singkat 5 menit setiap hari. Kamu sudah melakukan progres yang baik.',
  ];

  const EMP_LAST = new Map<number, string>(); // tanggal sesi terakhir (untuk aturan jeda 2 minggu)
  const EMP_YEAR = new Map<string, number>(); // jumlah sesi per pekerja per tahun (maks. 7)
  const EMP_ACTIVE = new Set<number>();
  const dayBookings = new Map<string, { psych: number; s: number; e: number; room: string }[]>();
  const pending: { created: string; id: number }[] = [];

  /** Cari jam kosong yang memenuhi aturan pada hari & psikolog tersebut. */
  function findSlot(psych: Psych, date: string, prefer?: number) {
    const bs = blocksOf.get(`${psych.id}|${date}`);
    if (!bs) return null;
    const booked = dayBookings.get(date) ?? [];
    const mine = booked.filter((b) => b.psych === psych.id);
    if (mine.length >= SCHEDULE.maxPerPsychPerDay) return null;
    const starts = candidateStarts(date).sort(() => rand() - 0.5);
    if (prefer != null && starts.includes(prefer)) starts.unshift(prefer);
    for (const st of starts) {
      const en = st + SCHEDULE.durationMin;
      const block = bs.find(([a, b]) => toMin(a) <= st && en <= toMin(b));
      if (!block) continue;
      if (mine.some((b) => st < b.e + SCHEDULE.gapMin && b.s < en + SCHEDULE.gapMin)) continue;
      const overlap = booked.filter((b) => b.s < en && st < b.e);
      const room = ROOMS.find((r) => !overlap.some((b) => b.room === r));
      if (!room) continue;
      return { s: st, e: en, room, modes: block[2] };
    }
    return null;
  }

  interface Spec {
    employee: (typeof employees)[number];
    psych: Psych;
    date: string;
    status: TicketStatus;
    outcome?: Outcome;
    feedback?: boolean;
    mode?: Mode;
    prefer?: number;
    topic?: ClientTopic;
    note?: string;
  }

  function makeTicket(sp: Spec) {
    const slot = findSlot(sp.psych, sp.date, sp.prefer);
    if (!slot) return null;
    const mode = sp.mode && slot.modes.includes(sp.mode) ? sp.mode : pick(slot.modes);
    const start = wibIso(sp.date, toHM(slot.s));
    const end = wibIso(sp.date, toHM(slot.e));
    const startMs = Date.parse(start);
    const createdAt = iso(startMs - (1 + Math.floor(rand() * 9)) * 864e5 - Math.floor(rand() * 8) * 3600e3);
    const topic = sp.topic ?? weighted<ClientTopic>([['work_stress', 5], ['emotional_resilience', 3], ['interpersonal', 3], ['personal_growth', 2], ['lainnya', 1]]);
    // Jawaban skrining: sebagian klien dengan tekanan lebih tinggi.
    const strain = Math.pow(rand(), 1.6);
    const answers = SCREENING_ITEMS.map((item) => {
      const distress = Math.min(4, Math.max(1, Math.round(1 + strain * 3 + (rand() - 0.5) * 1.6)));
      return item.favorable ? 5 - distress : distress;
    });
    const { score, level } = scoreScreening(answers);
    const cancelled = sp.status === 'cancelled';
    const held = ['completed', 'no_show', 'awaiting_report', 'in_progress'].includes(sp.status);
    const completedAt = sp.status === 'completed' || sp.status === 'no_show' ? iso(Date.parse(end) + (1 + rand() * 20) * 3600e3) : null;
    const reschedules = !cancelled && rand() < 0.12 ? 1 : 0;
    const id = Number(
      insTicket.run({
        code: `tmp-${pending.length}`, employee: sp.employee.id, unit: unitId[sp.employee.unit], psych: sp.psych.id, status: sp.status, mode,
        start, end, room: slot.room, meeting: mode === 'online' ? `https://teams.microsoft.com/l/meetup-join/teman-cerita-psikolog-${psychs.indexOf(sp.psych) + 1}` : null,
        nickname: sp.employee.nick, topic, complaint: pick(COMPLAINTS[topic]), impact: 3 + Math.floor(rand() * 7), expectation: pick(EXPECT),
        screening: JSON.stringify(answers), score, level, created: createdAt, reschedules,
        reminder: startMs - Date.parse(createdAt) > 864e5 && startMs < NOW + 864e5 ? iso(startMs - 864e5) : null,
        cancelReason: cancelled ? pick(['Ada tugas dinas mendadak.', 'Sudah merasa lebih baik, terima kasih.', 'Bentrok dengan rapat penting.']) : null,
        cancelledBy: cancelled ? sp.employee.id : null,
        cancelledAt: cancelled ? iso(startMs - (6 + rand() * 40) * 3600e3) : null,
        started: held && sp.status !== 'no_show' ? start : null,
        ended: held && sp.status !== 'in_progress' ? end : null,
        completed: completedAt,
        updated: completedAt ?? createdAt,
      }).lastInsertRowid,
    );
    pending.push({ created: createdAt, id });
    if (!cancelled) {
      dayBookings.set(sp.date, [...(dayBookings.get(sp.date) ?? []), { psych: sp.psych.id, s: slot.s, e: slot.e, room: slot.room }]);
      EMP_LAST.set(sp.employee.id, sp.date);
      const yk = `${sp.employee.id}|${sp.date.slice(0, 4)}`;
      EMP_YEAR.set(yk, (EMP_YEAR.get(yk) ?? 0) + 1);
      if (sp.status === 'scheduled') EMP_ACTIVE.add(sp.employee.id);
    }

    insEvent.run(id, sp.employee.id, 'created', `Pendaftaran konseling dibuat bersama ${sp.psych.name}.`, createdAt);
    if (reschedules) insEvent.run(id, sp.employee.id, 'rescheduled', 'Jadwal diubah oleh pekerja.', iso(Date.parse(createdAt) + 6 * 3600e3));
    if (cancelled) insEvent.run(id, sp.employee.id, 'cancelled', 'Dibatalkan oleh pekerja.', iso(startMs - 8 * 3600e3));
    if (held && sp.status !== 'no_show') insEvent.run(id, sp.psych.id, 'started', 'Sesi dimulai.', start);
    if (held && sp.status !== 'in_progress') insEvent.run(id, null, 'ended', 'Sesi selesai. Menunggu hasil dari psikolog.', end);

    if (sp.status === 'completed' || sp.status === 'no_show') {
      const outcome: Outcome = sp.status === 'no_show' ? 'no_show' : (sp.outcome ?? weighted<Outcome>([['terminasi', 52], ['lanjutan', 34], ['referral', 9]]));
      const category = pick(TOPIC_CATEGORY[topic]);
      if (outcome === 'no_show') {
        insReport.run(id, sp.psych.id, outcome, null, null, null, null, null, null, completedAt, completedAt);
      } else {
        insReport.run(
          id, sp.psych.id, outcome, `Membantu klien ${pick(['mengelola stres kerja', 'memahami pola emosinya', 'menyusun strategi komunikasi', 'menemukan arah pengembangan diri'])}.`,
          rand() < 0.3 ? 'Riwayat maag; tidak ada riwayat gangguan psikologis sebelumnya.' : 'Tidak ada riwayat penyakit berat.',
          pick(SYMPTOMS), pick(SUMMARIES), category in CASE_CATEGORIES ? category : 'beban_kerja', sp.note ?? (rand() < 0.7 ? pick(NOTES) : null), completedAt, completedAt,
        );
      }
      insEvent.run(id, sp.psych.id, 'reported', `Hasil sesi diisi.`, completedAt);
      if (sp.status === 'completed' && (sp.feedback ?? rand() < 0.65)) {
        const tone = rand();
        const fa = Array.from({ length: 8 }, () => Math.min(4, Math.max(1, Math.round(2.6 + tone * 1.6 + (rand() - 0.5)))));
        const sc = fa.reduce((a, b) => a + b, 0);
        const at = iso(Date.parse(completedAt!) + 5 * 3600e3);
        insFeedback.run(id, JSON.stringify(fa), sc, satisfactionLevel(sc), pick(['Psikolognya sabar dan mendengarkan.', 'Teknik pernapasannya membantu.', 'Saya merasa lebih lega.', null]), pick(['Jadwal sore lebih banyak.', null, null]), at);
        insEvent.run(id, sp.employee.id, 'feedback', 'Mengisi feedback sesi.', at);
      }
    }
    return { id, start, mode };
  }

  const eligible = (e: (typeof employees)[number], date: string) => {
    if (EMP_ACTIVE.has(e.id)) return false;
    if ((EMP_YEAR.get(`${e.id}|${date.slice(0, 4)}`) ?? 0) >= 7) return false;
    const last = EMP_LAST.get(e.id);
    return !last || Date.parse(date) - Date.parse(last) >= 14 * 864e5;
  };
  const others = employees.slice(1);

  // Riwayat: tiap hari kerja beberapa sesi, volume naik menjelang bulan ini.
  for (let off = -235; off <= -1; off++) {
    const date = day(off);
    for (const p of psychs) {
      if (!blocksOf.has(`${p.id}|${date}`)) continue;
      const load = 0.5 + 0.4 * (1 - Math.abs(off) / 240);
      const n = rand() < load ? 1 + Math.floor(rand() * 3) : 0;
      for (let k = 0; k < n; k++) {
        const candidates = others.filter((e) => eligible(e, date));
        if (!candidates.length) break;
        const status: TicketStatus =
          off >= -4 && rand() < 0.5 ? 'awaiting_report' : weighted<TicketStatus>([['completed', 84], ['no_show', 6], ['cancelled', 10]]);
        makeTicket({ employee: pick(candidates), psych: p, date, status });
      }
    }
  }

  // Riwayat demo pekerja: terminasi (sudah feedback) dan sesi lanjutan (belum feedback).
  const demoEmp = employees[0];
  const findDay = (from: number, p: Psych) => {
    for (let off = from; off < from + 10; off++) if (blocksOf.has(`${p.id}|${day(off)}`)) return day(off);
    return day(from);
  };
  makeTicket({ employee: demoEmp, psych: psychs[0], date: findDay(-80, psychs[0]), status: 'completed', outcome: 'terminasi', feedback: true, mode: 'online', topic: 'work_stress' });
  const lanjut = makeTicket({
    employee: demoEmp, psych: psychs[0], date: findDay(-19, psychs[0]), status: 'completed', outcome: 'lanjutan', feedback: false, mode: 'chat', topic: 'emotional_resilience',
    note: 'Terima kasih sudah terbuka hari ini, Rani. Coba catat momen ketika emosi terasa memuncak dan apa yang memicunya — kita bahas bersama di sesi lanjutan ya.',
  });
  if (lanjut) {
    const t0 = Date.parse(lanjut.start);
    const chat: [number, string, number][] = [
      [psychs[0].id, 'Halo Rani, saya Vanda. Sesi kita lewat chat di sini ya. Ceritakan pelan-pelan saja, tidak ada jawaban benar atau salah.', 0],
      [demo, 'Halo Bu Vanda, terima kasih. Aku agak gugup karena ini pertama kali konseling lewat chat 😅', 0.05],
      [psychs[0].id, 'Wajar sekali kok. Boleh ceritakan apa yang paling terasa berat minggu ini?', 0.08],
    ];
    for (const [sender, body, h] of chat) insMsg.run(lanjut.id, sender, body, iso(t0 + h * 3600e3), iso(t0 + h * 3600e3));
  }

  // Hari ini & mendatang.
  const todayDate = day(0);
  if (blocksOf.has(`${psychs[0].id}|${todayDate}`)) {
    for (const [hour, status] of [[8, 'scheduled'], [10, 'scheduled'], [14, 'scheduled']] as [number, TicketStatus][]) {
      const e = pick(others.filter((x) => eligible(x, todayDate)));
      if (e) makeTicket({ employee: e, psych: psychs[0], date: todayDate, status, prefer: hour * 60 });
    }
  }
  for (let off = 1; off <= 30; off++) {
    const date = day(off);
    for (const p of psychs) {
      if (!blocksOf.has(`${p.id}|${date}`)) continue;
      const n = rand() < 0.55 - off * 0.012 ? 1 + Math.floor(rand() * 2) : 0;
      for (let k = 0; k < n; k++) {
        const candidates = others.filter((e) => eligible(e, date));
        if (!candidates.length) break;
        makeTicket({ employee: pick(candidates), psych: p, date, status: 'scheduled' });
      }
    }
  }

  // Nomor tiket berurutan sesuai waktu pendaftaran.
  pending.sort((a, b) => a.created.localeCompare(b.created));
  const seqByYear: Record<string, number> = {};
  for (const r of pending) {
    const y = r.created.slice(0, 4);
    seqByYear[y] = (seqByYear[y] ?? 0) + 1;
    db.prepare('UPDATE tickets SET code = ? WHERE id = ?').run(`TC-${y}-${String(seqByYear[y]).padStart(5, '0')}`, r.id);
  }

  // Notifikasi contoh.
  const insNotif = db.prepare('INSERT INTO notifications (user_id, type, title, body, link, priority, read_at, created_at) VALUES (?,?,?,?,?,?,?,?)');
  const at = (h: number) => iso(NOW - h * 3600e3);
  if (lanjut) {
    insNotif.run(demo, 'session.result', 'Hasil & tindak lanjut sesimu sudah tersedia', 'Vanda Violetta Nidhar sudah mengisi hasil sesi. Yuk lihat, lalu bantu kami dengan mengisi feedback singkat.', `/pendaftaran/${lanjut.id}`, 0, null, at(18 * 24));
  }
  insNotif.run(admin, 'info', 'Selamat datang di dashboard Teman Cerita', 'Pantau layanan dari menu Dashboard dan kelola ketersediaan psikolog.', '/admin', 0, null, at(1));
});

const count = (t: string, where = '') => (db.prepare(`SELECT COUNT(*) n FROM ${t} ${where}`).get() as { n: number }).n;
console.log(`Seed selesai: ${count('users')} akun, ${count('tickets')} tiket, ${count('availability')} blok ketersediaan.`);
console.log('Login demo (password: demo1234): PN 90001234 (pekerja) · psikolog@temancerita.id · admin@temancerita.id');

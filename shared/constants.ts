export type Role = 'employee' | 'psychologist' | 'admin';
/** Pekerja berasal dari master data (langsung aktif); `pending`/`rejected` hanya tersisa dari versi lama. */
export type AccountStatus = 'pending' | 'verified' | 'rejected' | 'disabled';
export type TicketStatus = 'scheduled' | 'in_progress' | 'awaiting_report' | 'completed' | 'no_show' | 'cancelled';
export type Mode = 'offline' | 'chat' | 'online';
export type Outcome = 'terminasi' | 'lanjutan' | 'referral' | 'no_show';
export type Gender = 'L' | 'P';

export const ROLE_LABEL: Record<Role, string> = {
  employee: 'Pekerja',
  psychologist: 'Psikolog',
  admin: 'Admin',
};

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  pending: 'Menunggu',
  verified: 'Aktif',
  rejected: 'Ditolak',
  disabled: 'Nonaktif',
};

export const GENDER_LABEL: Record<Gender, string> = { L: 'Laki-laki', P: 'Perempuan' };

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  scheduled: 'Akan datang',
  in_progress: 'Berlangsung',
  awaiting_report: 'Menunggu hasil psikolog',
  completed: 'Selesai',
  no_show: 'Tidak hadir',
  cancelled: 'Dibatalkan',
};

/** Booking yang masih berjalan — pekerja hanya boleh punya satu. */
export const ACTIVE_STATUSES: TicketStatus[] = ['scheduled', 'in_progress'];
/** Status yang menempati slot psikolog & ruangan (semua kecuali batal). */
export const OCCUPYING_STATUSES: TicketStatus[] = ['scheduled', 'in_progress', 'awaiting_report', 'completed', 'no_show'];

export const MODES: Mode[] = ['offline', 'chat', 'online'];
export const MODE_LABEL: Record<Mode, string> = {
  offline: 'Tatap muka',
  chat: 'Chat',
  online: 'Video/Voice Call',
};
export const MODE_HINT: Record<Mode, string> = {
  offline: 'Bertemu langsung di Well-being Corner',
  chat: 'Ngobrol lewat ruang chat di aplikasi',
  online: 'Lewat Microsoft Teams Meeting',
};

// ---------------------------------------------------------------------------
// Data diri & kebutuhan (diisi pekerja)

export const CLIENT_TOPICS = {
  work_stress: 'Work Stress Management',
  emotional_resilience: 'Emotional Resilience',
  personal_growth: 'Personal Growth',
  interpersonal: 'Interpersonal Relations',
  lainnya: 'Lainnya',
} as const;
export type ClientTopic = keyof typeof CLIENT_TOPICS;

export const COMPLAINT_MIN = 100;
export const IMPACT_LABEL = { 1: 'Tidak mengganggu sama sekali', 10: 'Sangat mengganggu sekali' } as const;

// ---------------------------------------------------------------------------
// Form pasca-sesi (diisi psikolog)

export const CASE_CATEGORIES = {
  beban_kerja: {
    label: 'Beban Kerja',
    desc: 'Jumlah pekerjaan yang didelegasikan serta tingkat kompleksitas tugas.',
  },
  kehidupan_pribadi: {
    label: 'Kehidupan Pribadi',
    desc: 'Dinamika keluarga, hubungan interpersonal atau konflik di luar pekerjaan, serta aspek personal.',
  },
  jam_kerja: {
    label: 'Jam Kerja',
    desc: 'Durasi dan pengaturan waktu kerja yang mengganggu batas kehidupan kerja dan pribadi.',
  },
  rekan_kerja: {
    label: 'Isu dengan Rekan Kerja',
    desc: 'Perbedaan karakter, gaya kerja, komunikasi, nilai, maupun dinamika hubungan dengan rekan kerja.',
  },
  transisi: {
    label: 'Transisi dan Adaptasi',
    desc: 'Perubahan peran, lingkungan kerja, atau tanggung jawab pekerjaan.',
  },
  karier: {
    label: 'Perkembangan Karier',
    desc: 'Perencanaan karier, peluang pengembangan diri, serta arah karier.',
  },
} as const;
export type CaseCategory = keyof typeof CASE_CATEGORIES;

export const OUTCOMES: Outcome[] = ['terminasi', 'lanjutan', 'referral', 'no_show'];
export const OUTCOME_LABEL: Record<Outcome, string> = {
  terminasi: 'Terminasi',
  lanjutan: 'Sesi lanjutan',
  referral: 'Referral',
  no_show: 'No show',
};
export const OUTCOME_HINT: Record<Outcome, string> = {
  terminasi: 'Proses konseling dinyatakan selesai',
  lanjutan: 'Klien direkomendasikan mengikuti sesi berikutnya',
  referral: 'Klien dirujuk ke layanan yang lebih sesuai',
  no_show: 'Klien tidak hadir hingga batas toleransi 15 menit',
};

/** Teks yang tampil ke pekerja di halaman tiket sesuai hasil sesi. */
export const RESULT_TEXT = {
  pending: {
    title: 'Sesi kamu sudah selesai 💙',
    body: 'Terima kasih sudah berbagi cerita hari ini. Mohon menunggu hasil dan tindak lanjut dari psikolog. Informasi akan tersedia setelah psikolog menyelesaikan prosesnya.',
  },
  terminasi: {
    title: 'Terima kasih sudah menjadikan Teman Cerita BRILiaN sebagai ruang untuk bercerita. 💙',
    body: 'Sesi konseling kamu telah selesai. Semoga sesi ini dapat memberikan perspektif dan langkah baru dalam menghadapi hal-hal yang sedang kamu jalani.\n\nJangan lupa untuk tetap memberikan waktu dan perhatian untuk dirimu sendiri. 🌱',
    nextTitle: 'Ingin kembali bercerita?',
    next: 'Kamu dapat mengikuti sesi konseling kembali setelah jeda minimal 2 minggu dari sesi sebelumnya. Sampai saat itu, tetap jaga diri dan jangan ragu untuk memberikan ruang bagi dirimu sendiri.',
  },
  lanjutan: {
    title: 'Terima kasih sudah menjadikan Teman Cerita BRILiaN sebagai ruang untuk bercerita. 💙',
    body: 'Berdasarkan sesi hari ini, psikolog merekomendasikan sesi lanjutan untuk melanjutkan proses konseling dan membahas hal-hal yang masih perlu kamu eksplorasi bersama.',
    nextTitle: 'Ingin melanjutkan ceritamu?',
    next: 'Kamu dapat mengikuti sesi konseling lanjutan setelah jeda minimal 2 minggu dari sesi sebelumnya. Pilih jadwal yang sesuai ketika kamu siap untuk melanjutkan prosesnya.\n\nSampai saat itu, tetap jaga diri dan berikan ruang untuk dirimu sendiri. 🌱',
  },
  referral: {
    title: 'Terima kasih sudah menjadikan Teman Cerita BRILiaN sebagai ruang untuk bercerita. 💙',
    body: 'Berdasarkan sesi hari ini, psikolog merekomendasikan tindak lanjut melalui layanan yang lebih sesuai dengan kebutuhanmu agar kamu dapat memperoleh dukungan yang tepat.',
    nextTitle: 'Ingin melanjutkan langkahmu?',
    next: 'Kamu dapat melihat rekomendasi tindak lanjut dari psikolog dan mengikuti arahan yang diberikan sesuai dengan kebutuhanmu.\n\nSemoga langkah selanjutnya dapat membantu kamu mendapatkan dukungan yang kamu butuhkan. Tetap jaga diri dan berikan ruang untuk dirimu sendiri. 🌱',
  },
  no_show: {
    title: 'Kamu tercatat tidak hadir pada sesi ini',
    body: 'Sesi melewati batas toleransi keterlambatan 15 menit sehingga dinyatakan hangus. Tidak apa-apa — kalau kamu masih butuh teman cerita, kamu bisa membuat janji baru setelah jeda minimal 2 minggu.',
  },
} as const;

// ---------------------------------------------------------------------------
// Informed consent

export const CONSENT_INTRO =
  'Dalam mendukung penerapan Employee Well-being di lingkungan pekerja BRI khususnya di aspek mental, dengan ini Human Capital Service Group menyediakan program “Teman Cerita BRILiaN” dengan penjelasan sebagai berikut:';

export const CONSENT_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Proses Konseling',
    body: 'Teman Cerita BRILiaN merupakan layanan konseling individual selama 60 menit bersama psikolog profesional bagi Pekerja BRI untuk memperoleh dukungan psikologis terkait pekerjaan maupun kehidupan pribadi agar pekerja dapat menjaga kesehatan mental serta mengoptimalkan produktivitas. Konseling dilakukan untuk memahami concerns, mengeksplorasi kondisi yang dihadapi, dan mengembangkan strategi dengan topik meliputi work stress management, emotional resilience, personal growth, dan interpersonal relationship, maupun topik lainnya sesuai dengan kebutuhan klien.',
  },
  {
    title: 'Kerahasiaan',
    body: 'Seluruh informasi yang disampaikan selama proses konseling bersifat RAHASIA dan dijaga sesuai dengan kode etik profesi psikologi serta ketentuan perlindungan data yang berlaku. Informasi konseling hanya dapat digunakan untuk kepentingan profesional yang diperlukan dalam pemberian layanan.',
  },
  {
    title: 'Dokumentasi dan Penggunaan Data',
    body: 'Dokumentasi hasil konseling digunakan untuk keperluan internal dan pelaporan layanan, sesuai dengan kode etik psikologi dan kebijakan perlindungan data yang berlaku di lingkungan BRI.',
  },
  {
    title: 'Batasan Kerahasiaan',
    body: 'Kerahasiaan dapat memiliki batasan dalam kondisi tertentu sesuai dengan kode etik profesi dan ketentuan yang berlaku, termasuk apabila terdapat risiko serius terhadap keselamatan diri atau orang lain atau terdapat kewajiban berdasarkan hukum.',
  },
  {
    title: 'Ketentuan Layanan',
    body: 'Sesi berlangsung selama 60 menit dengan toleransi keterlambatan maksimal 15 menit, melebihi batas tersebut maka mohon maaf sesi akan hangus. Perubahan jadwal atau pembatalan diharapkan dilakukan paling lambat H-4 Jam dari penjadwalan yang sudah dibuat. Teman Cerita BRILiaN tidak diperuntukkan sebagai sarana pengaduan maupun konsultasi terkait jenjang karier.',
  },
];

export const CONSENT_STATEMENT =
  'Saya telah MEMBACA dan MEMAHAMI informasi mengenai layanan Teman Cerita BRILiaN yang diberikan oleh Human Capital Services Group, termasuk tujuan dan proses konseling, kerahasiaan informasi, batasan kerahasiaan, penggunaan data, serta hak dan tanggung jawab saya sebagai klien. Saya memahami bahwa informasi yang saya sampaikan dalam proses konseling akan dijaga kerahasiaannya sesuai dengan kode etik profesi psikologi dan ketentuan perlindungan data yang berlaku.\n\nDemikian persetujuan ini saya buat dengan penuh kesadaran dan tanpa paksaan dari pihak manapun.';

// ---------------------------------------------------------------------------
// Skrining kesehatan mental (EANSCALE)

export const LIKERT = ['Sangat Tidak Setuju', 'Tidak Setuju', 'Setuju', 'Sangat Setuju'] as const;

/**
 * `favorable: true` = pernyataan positif; skornya dibalik supaya skor tinggi selalu berarti
 * kondisi yang lebih membutuhkan perhatian.
 */
export const SCREENING_ITEMS: { text: string; favorable: boolean }[] = [
  { text: 'Saya memahami arah dan tujuan dari pekerjaan yang ditugaskan kepada saya', favorable: true },
  { text: 'Saya merasa rutinitas harian pekerjaan menjadi beban yang melelahkan', favorable: false },
  { text: 'Rutinitas harian pekerjaan bukan merupakan beban yang melelahkan bagi saya', favorable: true },
  { text: 'Saya merasa bahwa pekerjaan yang ditugaskan kepada saya tidak jelas arah dan tujuannya', favorable: false },
  { text: 'Selama setahun kebelakang, ada anggota keluarga saya yang meninggal dunia', favorable: false },
  { text: 'Akhir-akhir ini saya merasa tertekan dan tidak berdaya', favorable: false },
  { text: 'Tidak ada perubahan pola makan dan pola tidur yang saya rasakan sampai dengan saat ini', favorable: true },
  { text: 'Akhir-akhir ini saya mengalami kesulitan dalam berkonsentrasi, yang berdampak pada hasil kerja saya', favorable: false },
  { text: 'Saya merasa tidak ada perubahan dalam kemampuan konsentrasi saya', favorable: true },
  { text: 'Sejauh ini, saya tidak mengalami kejadian traumatis yang berdampak pada hasil kerja saya', favorable: true },
  { text: 'Baru-baru ini saya mendapatkan diagnosa penyakit berat', favorable: false },
  { text: 'Selama setahun ini, saya pernah mengalami kejadian traumatis yang berdampak pada pekerjaan saya', favorable: false },
  { text: 'Sampai dengan saat ini, saya merasa tubuh saya dalam keadaan sehat', favorable: true },
  { text: 'Sampai dengan saat ini, saya masih berada di tempat kerja yang sama', favorable: true },
  { text: 'Saya merasakan adanya perubahan pola makan dan pola tidur beberapa waktu kebelakang', favorable: false },
  { text: 'Sampai dengan saat ini, belum ada anggota keluarga saya yang meninggal dunia', favorable: true },
];

export type ScreeningLevel = 'rendah' | 'sedang' | 'tinggi';
export const SCREENING_LEVELS: ScreeningLevel[] = ['rendah', 'sedang', 'tinggi'];
export const SCREENING_LEVEL_LABEL: Record<ScreeningLevel, string> = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi' };
/** Batas atas skor untuk tiap kategori (rentang skor 16–64). Sesuaikan bila ada norma resmi. */
export const SCREENING_CUTOFF = { rendah: 32, sedang: 44 };

/** `answers` berisi 1–4 sesuai urutan LIKERT. */
export function scoreScreening(answers: number[]) {
  const score = SCREENING_ITEMS.reduce((sum, item, i) => sum + (item.favorable ? 5 - answers[i] : answers[i]), 0);
  const level: ScreeningLevel = score <= SCREENING_CUTOFF.rendah ? 'rendah' : score <= SCREENING_CUTOFF.sedang ? 'sedang' : 'tinggi';
  return { score, level };
}

// ---------------------------------------------------------------------------
// Feedback pasca-sesi (CSQ, 8 item, skor 1–4 per item)
// Ganti teks item dengan versi resmi di bbri.id/FeedbackTemanCeritaBRILiaN bila berbeda.

export const FEEDBACK_ITEMS: { q: string; options: [string, string, string, string] }[] = [
  { q: 'Bagaimana kamu menilai kualitas layanan konseling yang kamu terima?', options: ['Buruk', 'Cukup', 'Baik', 'Sangat baik'] },
  { q: 'Apakah kamu mendapatkan layanan yang kamu harapkan?', options: ['Sama sekali tidak', 'Kurang sesuai', 'Umumnya sesuai', 'Sangat sesuai'] },
  { q: 'Sejauh mana layanan ini memenuhi kebutuhanmu?', options: ['Tidak ada yang terpenuhi', 'Hanya sebagian kecil', 'Sebagian besar', 'Hampir semuanya'] },
  { q: 'Jika ada teman yang membutuhkan bantuan serupa, apakah kamu akan merekomendasikan layanan ini?', options: ['Tidak akan', 'Mungkin tidak', 'Mungkin ya', 'Pasti ya'] },
  { q: 'Seberapa puas kamu dengan bantuan yang kamu terima?', options: ['Tidak puas', 'Kurang puas', 'Cukup puas', 'Sangat puas'] },
  { q: 'Apakah sesi ini membantumu menghadapi masalah dengan lebih baik?', options: ['Tidak membantu sama sekali', 'Kurang membantu', 'Cukup membantu', 'Sangat membantu'] },
  { q: 'Secara keseluruhan, seberapa puas kamu dengan layanan Teman Cerita BRILiaN?', options: ['Tidak puas', 'Kurang puas', 'Cukup puas', 'Sangat puas'] },
  { q: 'Jika suatu saat membutuhkan bantuan lagi, apakah kamu akan kembali menggunakan layanan ini?', options: ['Tidak akan', 'Mungkin tidak', 'Mungkin ya', 'Pasti ya'] },
];

export type SatisfactionLevel = 'rendah' | 'sedang' | 'tinggi';
export const SATISFACTION_LABEL: Record<SatisfactionLevel, string> = {
  rendah: 'Kepuasan Rendah',
  sedang: 'Kepuasan Sedang',
  tinggi: 'Kepuasan Tinggi',
};
/** Total 8–32: ≤ 20 rendah · 21–26 sedang · 27–32 tinggi. */
export function satisfactionLevel(score: number): SatisfactionLevel {
  return score <= 20 ? 'rendah' : score <= 26 ? 'sedang' : 'tinggi';
}

// ---------------------------------------------------------------------------
// Aturan penjadwalan (semua jam dalam WIB)

export const SCHEDULE = {
  /** Jam operasional 08.00–16.30. */
  open: '08:00',
  close: '16:30',
  /** Pilihan jam mulai tiap 30 menit: 08.00, 08.30, 09.00, … */
  stepMin: 30,
  durationMin: 60,
  /** Tidak boleh back-to-back: sesi berikutnya paling cepat 30 menit setelah sesi sebelumnya selesai. */
  gapMin: 30,
  /** Booking, perubahan jadwal, dan pembatalan paling lambat H-4 jam. */
  leadHours: 4,
  maxPerPsychPerDay: 4,
  lateToleranceMin: 15,
  /** Hari kerja Senin–Jumat (0 = Minggu). */
  workDays: [1, 2, 3, 4, 5],
  /** Istirahat: Senin–Kamis 12.00–13.00, Jumat 11.30–13.30. */
  breaks: { 1: ['12:00', '13:00'], 2: ['12:00', '13:00'], 3: ['12:00', '13:00'], 4: ['12:00', '13:00'], 5: ['11:30', '13:30'] } as Record<number, [string, string]>,
};

/** Ruang konseling sesuai urutan prioritas. Jumlahnya sekaligus batas sesi yang berjalan bersamaan. */
export const ROOM_PREFIX = 'Well-being Corner – Teman Cerita BRILiaN';
export const ROOMS = ['Ruang 1', 'Ruang 2', 'Ruang Terhubung', 'Ruang 4'];

export const ELIGIBILITY = { maxPerYear: 7, minGapDays: 14 };

export const CHAT_GRACE_DAYS = 7;

export const toMin = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};
export const toHM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
/** Hari dalam seminggu untuk tanggal "YYYY-MM-DD" (tidak terpengaruh zona waktu perangkat). */
export const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** Jam mulai yang mungkin pada suatu tanggal: dalam jam operasional, tidak menabrak istirahat. */
export function candidateStarts(date: string): number[] {
  const day = weekday(date);
  if (!SCHEDULE.workDays.includes(day)) return [];
  const [bs, be] = (SCHEDULE.breaks[day] ?? ['00:00', '00:00']).map(toMin);
  const out: number[] = [];
  for (let s = toMin(SCHEDULE.open); s + SCHEDULE.durationMin <= toMin(SCHEDULE.close); s += SCHEDULE.stepMin) {
    const e = s + SCHEDULE.durationMin;
    if (s < be && bs < e) continue;
    out.push(s);
  }
  return out;
}

/** Pilihan jam untuk blok ketersediaan (08.00 … 16.30). */
export const TIME_OPTIONS = (() => {
  const out: string[] = [];
  for (let m = toMin(SCHEDULE.open); m <= toMin(SCHEDULE.close); m += SCHEDULE.stepMin) out.push(toHM(m));
  return out;
})();

// ---------------------------------------------------------------------------
// Lampiran chat: foto, dokumen, dan video pendek.

export const ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;
export type AttachmentKind = 'image' | 'video' | 'document';
export const ATTACHMENT_TYPES: Record<string, { mime: string; kind: AttachmentKind }> = {
  jpg: { mime: 'image/jpeg', kind: 'image' },
  jpeg: { mime: 'image/jpeg', kind: 'image' },
  png: { mime: 'image/png', kind: 'image' },
  webp: { mime: 'image/webp', kind: 'image' },
  gif: { mime: 'image/gif', kind: 'image' },
  mp4: { mime: 'video/mp4', kind: 'video' },
  webm: { mime: 'video/webm', kind: 'video' },
  mov: { mime: 'video/quicktime', kind: 'video' },
  pdf: { mime: 'application/pdf', kind: 'document' },
  doc: { mime: 'application/msword', kind: 'document' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'document' },
  xls: { mime: 'application/vnd.ms-excel', kind: 'document' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'document' },
  ppt: { mime: 'application/vnd.ms-powerpoint', kind: 'document' },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'document' },
  txt: { mime: 'text/plain', kind: 'document' },
};
export const ATTACHMENT_KIND_LABEL: Record<AttachmentKind, string> = { image: 'Foto', video: 'Video', document: 'Dokumen' };
export const attachmentExt = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

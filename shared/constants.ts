export type Role = 'employee' | 'psychologist' | 'admin';
export type AccountStatus = 'pending' | 'verified' | 'rejected' | 'disabled';
export type TicketStatus =
  | 'pending'
  | 'scheduled'
  | 'reschedule_requested'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
export type Mode = 'chat' | 'online' | 'offline';
export type Urgency = 'low' | 'normal' | 'high';
export type Severity = 'ringan' | 'sedang' | 'berat' | 'kritis';

export const ROLE_LABEL: Record<Role, string> = {
  employee: 'Karyawan',
  psychologist: 'Psikolog',
  admin: 'Admin',
};

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  pending: 'Menunggu verifikasi',
  verified: 'Terverifikasi',
  rejected: 'Ditolak',
  disabled: 'Nonaktif',
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  pending: 'Menunggu',
  scheduled: 'Dijadwalkan',
  reschedule_requested: 'Minta jadwal ulang',
  in_progress: 'Berlangsung',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export const ACTIVE_STATUSES: TicketStatus[] = ['pending', 'scheduled', 'reschedule_requested', 'in_progress'];

export const MODE_LABEL: Record<Mode, string> = {
  chat: 'Chat',
  online: 'Online meeting',
  offline: 'Tatap muka',
};

export const MODE_HINT: Record<Mode, string> = {
  chat: 'Ngobrol lewat ruang chat di aplikasi',
  online: 'Video call lewat tautan meeting',
  offline: 'Bertemu langsung di ruang konseling',
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  low: 'Bisa menunggu',
  normal: 'Secepatnya',
  high: 'Mendesak',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  ringan: 'Ringan',
  sedang: 'Sedang',
  berat: 'Berat',
  kritis: 'Kritis',
};
export const SEVERITIES: Severity[] = ['ringan', 'sedang', 'berat', 'kritis'];

/** Topik yang dipilih karyawan saat mengajukan. */
export const REQUEST_TOPICS = {
  pekerjaan: 'Pekerjaan & beban kerja',
  relasi_kerja: 'Relasi kerja',
  keluarga: 'Keluarga',
  keuangan: 'Keuangan',
  kesehatan_mental: 'Kesehatan mental',
  pengembangan_diri: 'Pengembangan diri',
  lainnya: 'Lainnya',
} as const;
export type RequestTopic = keyof typeof REQUEST_TOPICS;

/** Topik yang dicatat psikolog di laporan (lebih rinci). */
export const REPORT_TOPICS = {
  stres_kerja: 'Stres kerja',
  burnout: 'Burnout',
  beban_kerja: 'Beban kerja',
  relasi_kerja: 'Relasi kerja',
  keluarga: 'Keluarga',
  pasangan: 'Pasangan',
  keuangan: 'Keuangan',
  kecemasan: 'Kecemasan',
  suasana_hati: 'Suasana hati / depresi',
  duka: 'Duka & kehilangan',
  karier: 'Karier & pengembangan diri',
  kesehatan_fisik: 'Kesehatan fisik',
  lainnya: 'Lainnya',
} as const;
export type ReportTopic = keyof typeof REPORT_TOPICS;

export const CHAT_GRACE_DAYS = 7;

/** Lampiran chat: foto, dokumen, dan video pendek. */
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

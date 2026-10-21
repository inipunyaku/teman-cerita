import type { AccountStatus, AttachmentKind, Mode, Outcome, Role, TicketStatus } from '@shared/constants';

export interface User {
  id: number;
  role: Role;
  name: string;
  email: string;
  pn: string | null;
  phone: string | null;
  unitId: number | null;
  unitName: string | null;
  title: string | null;
  bio: string | null;
  avatarUrl: string | null;
  avatarTone: string | null;
  statusText: string | null;
  nickname: string | null;
  band: string | null;
  region: string | null;
  gender: string | null;
  birthDate: string | null;
  specialization: string | null;
  approach: string | null;
  languages: string | null;
  meetingUrl: string | null;
  status: AccountStatus;
  createdAt: string;
  ticketCount?: number;
}

export interface PsychProfile {
  id: number;
  name: string;
  title: string | null;
  bio: string | null;
  specialization: string | null;
  approach: string | null;
  languages: string | null;
  avatarUrl: string | null;
  avatarTone: string | null;
  statusText: string | null;
}

export interface Ticket {
  id: number;
  code: string;
  status: TicketStatus;
  mode: Mode;
  scheduledStart: string;
  scheduledEnd: string;
  room?: string | null;
  location: string | null;
  meetingUrl: string | null;
  nickname: string;
  topic: string;
  impact: number;
  complaint?: string;
  expectation?: string;
  screening?: number[];
  screeningScore?: number;
  screeningLevel?: string;
  rescheduleCount: number;
  cancelReason: string | null;
  cancelledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  outcome: Outcome | null;
  category?: string | null;
  hasFeedback: boolean;
  feedbackScore?: number | null;
  employee: {
    id: number;
    name: string;
    pn?: string | null;
    phone?: string | null;
    email?: string;
    band?: string | null;
    region?: string | null;
    gender?: string | null;
    birthDate?: string | null;
    unitName: string | null;
    avatarUrl: string | null;
    avatarTone: string | null;
    statusText: string | null;
  };
  psychologist: {
    id: number;
    name: string;
    title: string | null;
    specialization: string | null;
    avatarUrl: string | null;
    avatarTone: string | null;
    statusText: string | null;
  };
  unread: number;
}

export interface TicketEvent {
  id: number;
  type: string;
  message: string;
  createdAt: string;
  actorName: string | null;
  actorRole: Role | null;
}

export interface Report {
  outcome: Outcome;
  goal?: string | null;
  healthHistory?: string | null;
  symptoms?: string | null;
  summary?: string | null;
  category?: string | null;
  noteForClient?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface Feedback {
  score: number;
  level: string;
  helpful: string | null;
  suggestion: string | null;
  answers?: number[];
  createdAt: string;
}

export interface ChatState {
  canRead: boolean;
  canSend: boolean;
  reason: string | null;
  closesAt?: string;
  /** Kuota lampiran per sesi chat. */
  attachments?: { used: number; max: number; maxMB: number };
}

export interface HistoryItem {
  id: number;
  code: string;
  status: TicketStatus;
  scheduledStart: string;
  mode: Mode;
  psychologistName: string;
  outcome: Outcome | null;
  /** Hanya untuk psikolog: konteks klinis sesi sebelumnya (termasuk dari psikolog lain). */
  topic?: string;
  screening?: number[];
  screeningScore?: number;
  screeningLevel?: string;
  report?: {
    outcome: Outcome;
    goal: string | null;
    healthHistory: string | null;
    symptoms: string | null;
    summary: string | null;
    category: string | null;
    noteForClient: string | null;
  };
}

export interface TicketDetail {
  ticket: Ticket;
  events: TicketEvent[];
  report: Report | null;
  feedback: Feedback | null;
  history: HistoryItem[];
  chat: ChatState;
}

export interface Eligibility {
  canBook: boolean;
  reason: string | null;
  activeTicket: { id: number; code: string } | null;
  yearCount: number;
  maxPerYear: number;
  earliestDate: string | null;
}

export interface DaySlot {
  time: string;
  modes: Mode[];
}

export interface AvailabilityBlock {
  id: number;
  psychologistId: number;
  date: string;
  start: string;
  end: string;
  modes: Mode[];
}

export interface AvailabilitySession {
  id: number;
  code: string;
  psychologistId: number;
  date: string;
  start: string;
  end: string;
  mode: Mode;
  status: TicketStatus;
  nickname?: string;
}

export interface Message {
  id: number;
  ticketId?: number;
  senderId: number;
  body: string;
  readAt: string | null;
  createdAt: string;
  attachment: Attachment | null;
}

export interface Attachment {
  name: string;
  type: string;
  size: number;
  kind: AttachmentKind;
  url: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  priority: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface Unit {
  id: number;
  name: string;
  code: string | null;
  active?: number;
  employees?: number;
  tickets?: number;
}

export interface Psychologist extends PsychProfile {
  email: string;
  phone: string | null;
  meetingUrl: string | null;
  status: AccountStatus;
  upcoming: number;
  awaiting: number;
  completed: number;
  openBlocks: number;
  satisfaction: number | null;
}

// ---------------------------------------------------------------------------
// Chat bantuan ke admin (tombol chat melayang)

export interface SupportMessage {
  id: number;
  threadId: number;
  fromAdmin: boolean;
  /** Pesan otomatis sistem (mohon tunggu / admin tidak tersedia). */
  auto: boolean;
  senderName: string | null;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface SupportThread {
  id: number;
  guest: boolean;
  name: string;
  pn: string | null;
  role: string | null;
  roleLabel: string;
  email: string | null;
  unitName: string | null;
  avatarUrl: string | null;
  avatarTone: string | null;
  /** Nama pekerja di master data bila PN yang diketik tamu cocok. */
  pnMatch: string | null;
  lastMessage: SupportMessage | null;
  lastMessageAt: string | null;
  /** Sejak kapan pesan pengguna menunggu balasan admin; null bila sudah dibalas. */
  awaitingSince: string | null;
  unread: number;
  createdAt: string;
}

export interface SupportEvent {
  threadId: number;
  message: SupportMessage;
  name: string | null;
}

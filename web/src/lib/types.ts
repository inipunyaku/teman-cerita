import type { AccountStatus, AttachmentKind, Mode, Role, Severity, TicketStatus, Urgency } from '@shared/constants';

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
  status: AccountStatus;
  rejectReason: string | null;
  verifiedAt: string | null;
  createdAt: string;
  ticketCount?: number;
}

export interface Slot {
  date: string;
  from: string;
  to: string;
}

export interface Ticket {
  id: number;
  code: string;
  status: TicketStatus;
  topic: string;
  story: string | null;
  preferredMode: Mode;
  mode: Mode;
  urgency: Urgency;
  preferredSlots: Slot[];
  scheduledStart: string | null;
  scheduledEnd: string | null;
  location: string | null;
  meetingUrl: string | null;
  adminNote: string | null;
  cancelReason: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  employee: {
    id: number;
    name: string;
    pn?: string;
    phone?: string;
    unitName: string | null;
    avatarUrl: string | null;
    avatarTone: string | null;
    statusText: string | null;
  };
  psychologist: {
    id: number;
    name: string;
    title: string | null;
    avatarUrl: string | null;
    avatarTone: string | null;
    statusText: string | null;
  } | null;
  severity?: Severity | null;
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

export interface RescheduleRequest {
  id: number;
  reason: string;
  proposedSlots: Slot[];
  status: 'pending' | 'approved' | 'rejected';
  responseNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface Report {
  severity?: Severity;
  topics?: string[];
  summary?: string;
  recommendation?: string | null;
  noteForEmployee?: string | null;
  followUp: boolean;
  createdAt?: string;
}

export interface ChatState {
  canRead: boolean;
  canSend: boolean;
  reason: string | null;
  closesAt?: string;
}

export interface TicketDetail {
  ticket: Ticket;
  events: TicketEvent[];
  reschedules: RescheduleRequest[];
  report: Report | null;
  review: { rating: number; comment: string | null; createdAt: string } | null;
  chat: ChatState;
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

export interface Psychologist {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  title: string | null;
  bio: string | null;
  avatarUrl: string | null;
  avatarTone: string | null;
  statusText: string | null;
  status: AccountStatus;
  active: number;
  completed: number;
  this_week: number;
  rating: number | null;
}

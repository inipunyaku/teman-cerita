import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { db } from './db.js';
import type { AccountStatus, Role } from '../shared/constants.js';

export const COOKIE = 'tc_session';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export interface UserRow {
  id: number;
  role: Role;
  name: string;
  email: string;
  pn: string | null;
  phone: string | null;
  unit_id: number | null;
  title: string | null;
  bio: string | null;
  avatar_url: string | null;
  avatar_tone: string | null;
  status_text: string | null;
  nickname: string | null;
  band: string | null;
  region: string | null;
  gender: string | null;
  birth_date: string | null;
  specialization: string | null;
  approach: string | null;
  languages: string | null;
  meeting_url: string | null;
  password_hash: string;
  status: AccountStatus;
  reject_reason: string | null;
  verified_at: string | null;
  created_at: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

export function setSession(res: Response, userId: number) {
  const token = jwt.sign({ uid: userId }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: MAX_AGE,
    path: '/',
  });
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE, { path: '/' });
}

const getUser = db.prepare('SELECT * FROM users WHERE id = ?');

/**
 * Semua nilai cookie bernama `name`. Browser bisa mengirim lebih dari satu cookie bernama sama (mis. cookie lama
 * dengan domain/path lain); cookie-parser hanya menyimpan yang pertama sehingga sesi baru bisa tertutup cookie lama.
 */
function cookieValues(req: Request, name: string) {
  const out: string[] = [];
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        out.push(decodeURIComponent(part.slice(i + 1).trim()));
      } catch {
        /* nilai rusak: lewati */
      }
    }
  }
  return out;
}

/** Mengisi req.user bila salah satu cookie sesi valid. Tidak menolak request. */
export function loadUser(req: Request, _res: Response, next: NextFunction) {
  for (const token of cookieValues(req, COOKIE)) {
    try {
      const payload = jwt.verify(token, config.jwtSecret) as { uid: number };
      const user = getUser.get(payload.uid) as UserRow | undefined;
      if (user && user.status !== 'disabled') {
        req.user = user;
        break;
      }
    } catch {
      /* token tidak valid: coba cookie berikutnya */
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
  next();
}

/** Akun harus aktif (status `verified`). */
export function requireVerified(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
  if (req.user.status !== 'verified') {
    return res.status(403).json({ error: 'Akunmu belum aktif. Hubungi admin Teman Cerita.', code: 'NOT_VERIFIED' });
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
    if (req.user.status !== 'verified') {
      return res.status(403).json({ error: 'Akunmu belum aktif. Hubungi admin Teman Cerita.', code: 'NOT_VERIFIED' });
    }
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Kamu tidak punya akses ke fitur ini.' });
    next();
  };
}

const getUnitName = db.prepare('SELECT name FROM units WHERE id = ?');

export function publicUser(u: UserRow) {
  const unit = u.unit_id ? (getUnitName.get(u.unit_id) as { name: string } | undefined) : undefined;
  return {
    id: u.id,
    role: u.role,
    name: u.name,
    email: u.email,
    pn: u.pn,
    phone: u.phone,
    unitId: u.unit_id,
    unitName: unit?.name ?? null,
    title: u.title,
    bio: u.bio,
    avatarUrl: u.avatar_url,
    avatarTone: u.avatar_tone,
    statusText: u.status_text,
    nickname: u.nickname,
    band: u.band,
    region: u.region,
    gender: u.gender,
    birthDate: u.birth_date,
    specialization: u.specialization,
    approach: u.approach,
    languages: u.languages,
    meetingUrl: u.meeting_url,
    status: u.status,
    rejectReason: u.reject_reason,
    verifiedAt: u.verified_at,
    createdAt: u.created_at,
  };
}

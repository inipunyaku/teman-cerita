import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const fail = (status: number, message: string, code?: string): never => {
  throw new HttpError(status, message, code);
};

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  return schema.parse(data);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({ error: first?.message ?? 'Data tidak valid.', fields: err.flatten().fieldErrors });
  }
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan di server. Coba lagi sebentar.' });
}

export const intParam = (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) fail(404, 'Data tidak ditemukan.');
  return n;
};

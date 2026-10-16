import type { Response } from 'express';

/** Hub Server-Sent Events: satu pengguna bisa punya beberapa tab terbuka. */
const clients = new Map<number, Set<Response>>();

export function addClient(userId: number, res: Response) {
  let set = clients.get(userId);
  if (!set) clients.set(userId, (set = new Set()));
  set.add(res);
  return () => {
    set!.delete(res);
    if (set!.size === 0) clients.delete(userId);
  };
}

export function publish(userIds: number | number[], event: string, data: unknown = {}) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const id of new Set(ids)) {
    for (const res of clients.get(id) ?? []) res.write(payload);
  }
}

setInterval(() => {
  for (const set of clients.values()) for (const res of set) res.write(': ping\n\n');
}, 25_000).unref();

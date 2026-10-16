export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
  get code() {
    return this.data.code as string | undefined;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : {};
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Terjadi kesalahan. Coba lagi.', data);
  return data as T;
}

/** Unggah file mentah (tanpa base64) dengan nama di header. */
async function upload<T>(url: string, file: File): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent(file.name) },
    body: file,
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : {};
  if (res.status === 413) throw new ApiError(413, data.error ?? 'Ukuran file maksimal 2 MB.', data);
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Gagal mengirim file. Coba lagi.', data);
  return data as T;
}

export const api = {
  upload,
  get: <T>(url: string) => request<T>('GET', url),
  post: <T = { ok: true }>(url: string, body: unknown = {}) => request<T>('POST', url, body),
  patch: <T = { ok: true }>(url: string, body: unknown) => request<T>('PATCH', url, body),
  del: <T = { ok: true }>(url: string) => request<T>('DELETE', url),
};

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Terjadi kesalahan.');

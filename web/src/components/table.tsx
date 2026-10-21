import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

/** Nilai yang baru berubah setelah pengguna berhenti mengetik selama `ms`. */
export function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Cocokkan kata kunci (tanpa membedakan huruf besar/kecil) dengan salah satu teks. */
export function matchText(q: string, ...fields: (string | number | null | undefined)[]) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => f != null && String(f).toLowerCase().includes(needle));
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Cari…',
  className,
  label = 'Cari',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}) {
  return (
    <label className={clsx('relative block', className)}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input className="input pl-10 pr-9" type="text" enterKeyHint="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-ink-faint hover:bg-canvas hover:text-ink" aria-label="Hapus pencarian">
          <X size={15} />
        </button>
      )}
    </label>
  );
}

export const PAGE_SIZES = [10, 20, 50, 100];

/**
 * Pagination di sisi browser untuk daftar yang sudah dimuat semua (tabel kecil). Halaman kembali ke 1 setiap
 * `resetKey` berubah (mis. kata kunci/filter) dan dijaga tidak melewati halaman terakhir.
 */
export function usePaged<T>(items: T[], resetKey: unknown, initialSize = 20) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  useEffect(() => setPage(1), [resetKey, pageSize]);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages);
  const pageItems = useMemo(() => items.slice((current - 1) * pageSize, current * pageSize), [items, current, pageSize]);
  return { page: current, setPage, pageSize, setPageSize, pageItems, total: items.length };
}

/** Nomor halaman ringkas: 1 2 3 4 5 … 37 · 1 … 9 10 11 … 37 · 1 … 33 34 35 36 37 */
function pageNumbers(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  if (page <= 4) return [...range(1, 5), '…', pages];
  if (page >= pages - 3) return [1, '…', ...range(pages - 4, pages)];
  return [1, '…', page - 1, page, page + 1, '…', pages];
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  sizes = PAGE_SIZES,
  unit = 'data',
  compact,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize?: (n: number) => void;
  sizes?: number[];
  /** Kata benda untuk keterangan, mis. "sesi", "pekerja". */
  unit?: string;
  /** Untuk kolom sempit: keterangan & tombol halaman ditumpuk, tanpa nomor halaman. */
  compact?: boolean;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const go = (p: number) => {
    onPage(Math.min(pages, Math.max(1, p)));
  };
  return (
    <nav
      className={clsx('flex text-[13px] text-ink-soft', compact ? 'items-center justify-between gap-2' : 'flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}
      aria-label="Halaman"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span>
          Menampilkan <b className="font-semibold text-ink tabular-nums">{from.toLocaleString('id-ID')}–{to.toLocaleString('id-ID')}</b> dari{' '}
          <b className="font-semibold text-ink tabular-nums">{total.toLocaleString('id-ID')}</b> {unit}
        </span>
        {onPageSize && (
          <label className="flex items-center gap-1.5">
            <select className="input h-8 w-auto py-0 pl-2.5 pr-8 text-[13px]" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Baris per halaman">
              {sizes.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-ink-faint">per halaman</span>
          </label>
        )}
      </div>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" className="btn btn-ghost btn-sm w-9 px-0" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Halaman sebelumnya">
            <ChevronLeft size={17} />
          </button>
          <span className={clsx('px-2 font-semibold tabular-nums text-ink', !compact && 'sm:hidden')}>
            {page} / {pages}
          </span>
          <div className={clsx('hidden items-center gap-1', !compact && 'sm:flex')}>
            {pageNumbers(page, pages).map((n, i) =>
              n === '…' ? (
                <span key={`gap-${i}`} className="w-6 text-center text-ink-faint">…</span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => go(n)}
                  aria-current={n === page ? 'page' : undefined}
                  className={clsx('h-8 min-w-8 rounded-lg px-2 font-semibold tabular-nums transition-colors', n === page ? 'bg-sky-600 text-white' : 'text-ink-soft hover:bg-canvas hover:text-ink')}
                >
                  {n}
                </button>
              ),
            )}
          </div>
          <button type="button" className="btn btn-ghost btn-sm w-9 px-0" onClick={() => go(page + 1)} disabled={page >= pages} aria-label="Halaman berikutnya">
            <ChevronRight size={17} />
          </button>
        </div>
      )}
    </nav>
  );
}

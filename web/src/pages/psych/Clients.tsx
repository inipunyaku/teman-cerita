import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import type { Unit } from '@/lib/types';
import { Avatar, EmptyState, PageHeader, ScreeningChip, Segmented } from '@/components/ui';
import { TableSkeleton } from '@/components/Skeletons';
import { Pagination, SearchInput, useDebounced } from '@/components/table';

export interface ClientRow {
  id: number;
  name: string;
  pn: string | null;
  unitName: string | null;
  avatarUrl: string | null;
  avatarTone: string | null;
  sessionCount: number;
  lastSessionAt: string;
  mine: boolean;
  screeningLevel: string | null;
  screeningScore: number | null;
}

type Scope = 'all' | 'mine' | 'others';

export default function Clients() {
  const [scope, setScope] = useState<Scope>('all');
  const [q, setQ] = useState('');
  const [unit, setUnit] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const search = useDebounced(q.trim());
  useEffect(() => setPage(1), [scope, search, unit, pageSize]);
  const qs = new URLSearchParams({ scope: scope === 'all' ? '' : scope, q: search, unit, page: String(page), pageSize: String(pageSize) });
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['psych-clients', qs.toString()],
    queryFn: () => api.get<{ clients: ClientRow[]; total: number }>(`/psych/clients?${qs}`),
    placeholderData: keepPreviousData,
  });
  const { data: units } = useQuery({ queryKey: ['units-public'], queryFn: () => api.get<{ units: Unit[] }>('/meta/units') });
  const list = data?.clients ?? [];

  return (
    <div className="animate-rise">
      <PageHeader
        title="Peserta"
        description="Semua pekerja yang pernah mendaftar konseling. Untuk peserta yang belum pernah sesi denganmu, hanya skrining awal dan catatan untuk klien yang ditampilkan."
        actions={
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: 'all', label: 'Semua' },
              { value: 'mine', label: 'Klien saya' },
              { value: 'others', label: 'Lainnya' },
            ]}
          />
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_240px]">
        <SearchInput value={q} onChange={setQ} placeholder="Cari nama, nama panggilan, PN" label="Cari peserta" />
        <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit kerja">
          <option value="">Semua unit kerja</option>
          {units?.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      {isLoading ? (
        <TableSkeleton />
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState title={search || unit ? 'Tidak ada yang cocok' : 'Belum ada peserta'} description={search || unit ? 'Coba kata kunci atau filter lain.' : undefined} />
        </div>
      ) : (
        <div className={clsx('card overflow-hidden transition-opacity', isFetching && 'opacity-60')}>
          <table className="w-full">
            <thead className="hidden border-b border-line bg-canvas/60 md:table-header-group">
              <tr>
                <th className="table-head px-5 py-3">Peserta</th>
                <th className="table-head px-3 py-3">Unit kerja</th>
                <th className="table-head px-3 py-3">Sesi terakhir</th>
                <th className="table-head px-3 py-3">Skrining terakhir</th>
                <th className="table-head px-5 py-3 text-right">Akses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((c) => (
                <tr key={c.id} className="relative block transition-colors hover:bg-sky-50/50 md:table-row">
                  <td className="block px-5 pt-4 md:table-cell md:py-3.5">
                    <Link to={`/psikolog/peserta/${c.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                      <Avatar name={c.name} src={c.avatarUrl} tone={c.avatarTone} size={36} />
                      <span className="min-w-0">
                        <span className="block font-semibold">{c.name}</span>
                        <span className="block text-[12.5px] text-ink-faint">PN {c.pn ?? '-'} · {c.sessionCount} pendaftaran</span>
                      </span>
                    </Link>
                  </td>
                  <td className="block px-5 pt-2 text-sm text-ink-soft md:table-cell md:px-3 md:py-3.5">{c.unitName ?? '-'}</td>
                  <td className="hidden px-3 py-3.5 text-sm md:table-cell">{fmtDate(c.lastSessionAt, 'd MMM yyyy')}</td>
                  <td className="hidden px-3 py-3.5 md:table-cell">{c.screeningLevel && <ScreeningChip level={c.screeningLevel} score={c.screeningScore ?? undefined} />}</td>
                  <td className="flex px-5 pb-4 pt-2 md:table-cell md:py-3.5 md:text-right">
                    <span className={clsx('chip', c.mine ? 'bg-sky-50 text-sky-800' : 'bg-canvas text-ink-soft')}>{c.mine ? 'Klien saya' : 'Skrining & catatan klien'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <Pagination className="mt-4" page={page} pageSize={pageSize} total={data.total} unit="peserta" onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} onPageSize={setPageSize} />
      )}
    </div>
  );
}

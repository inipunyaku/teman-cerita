import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, fmtTime } from '@/lib/format';
import type { Ticket } from '@/lib/types';
import { Avatar, EmptyState, ModeTag, OutcomeChip, PageHeader, ScreeningChip, Segmented, StatusChip } from '@/components/ui';
import { TableSkeleton } from '@/components/Skeletons';
import { Pagination, SearchInput, useDebounced } from '@/components/table';
import { CLIENT_TOPICS, MODE_LABEL, MODES, type ClientTopic } from '@shared/constants';

type Tab = 'upcoming' | 'awaiting' | 'history' | 'all';
const TAB_STATUS: Record<Tab, string> = { upcoming: 'upcoming', awaiting: 'awaiting_report', history: 'history', all: '' };

export default function Sessions() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const search = useDebounced(q.trim());
  useEffect(() => setPage(1), [tab, search, mode, pageSize]);
  // Urutan dari server: akan datang paling dekat dulu, riwayat paling baru dulu.
  const qs = new URLSearchParams({ status: TAB_STATUS[tab], mode, q: search, page: String(page), pageSize: String(pageSize) });
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['tickets', 'psych', qs.toString()],
    queryFn: () => api.get<{ tickets: Ticket[]; total: number }>(`/tickets?${qs}`),
    placeholderData: keepPreviousData,
  });
  const { data: awaiting } = useQuery({
    queryKey: ['tickets', 'psych', 'awaiting-count'],
    queryFn: () => api.get<{ total: number }>('/tickets?status=awaiting_report&page=1&pageSize=1'),
  });
  const list = data?.tickets ?? [];
  const awaitingCount = awaiting?.total ?? 0;

  return (
    <div className="animate-rise">
      <PageHeader
        title="Sesi saya"
        description="Sesi yang dipesan pekerja pada slot ketersediaanmu."
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'upcoming', label: 'Akan datang' },
              { value: 'awaiting', label: `Perlu hasil${awaitingCount ? ` (${awaitingCount})` : ''}` },
              { value: 'history', label: 'Riwayat' },
              { value: 'all', label: 'Semua' },
            ]}
          />
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_200px]">
        <SearchInput value={q} onChange={setQ} placeholder="Cari kode tiket, nama, nama panggilan, PN" label="Cari sesi" />
        <select className="input" value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Media">
          <option value="">Semua media</option>
          {MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
        </select>
      </div>
      {isLoading ? (
        <TableSkeleton />
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState
            title={search || mode ? 'Tidak ada yang cocok' : tab === 'awaiting' ? 'Semua hasil sesi sudah diisi' : 'Tidak ada sesi'}
            description={search || mode ? 'Coba kata kunci atau filter lain.' : undefined}
          />
        </div>
      ) : (
        <div className={clsx('card overflow-hidden transition-opacity', isFetching && 'opacity-60')}>
          <table className="w-full">
            <thead className="hidden border-b border-line bg-canvas/60 md:table-header-group">
              <tr>
                <th className="table-head px-5 py-3">Klien</th>
                <th className="table-head px-3 py-3">Jadwal</th>
                <th className="table-head px-3 py-3">Media</th>
                <th className="table-head px-3 py-3">Skrining</th>
                <th className="table-head px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((t) => (
                <tr key={t.id} className="relative block transition-colors hover:bg-sky-50/50 md:table-row">
                  <td className="block px-5 pt-4 md:table-cell md:py-3.5">
                    <Link to={`/psikolog/sesi/${t.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                      <Avatar name={t.employee.name} src={t.employee.avatarUrl} tone={t.employee.avatarTone} size={36} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-semibold">
                          {t.nickname}
                          {t.unread > 0 && <span className="chip h-5 bg-sky-600 px-2 text-white"><MessageCircle size={11} />{t.unread}</span>}
                        </span>
                        <span className="block text-[12.5px] text-ink-faint">{t.code} · {CLIENT_TOPICS[t.topic as ClientTopic] ?? t.topic}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="block px-5 pt-2 text-sm md:table-cell md:px-3 md:py-3.5">
                    {fmtDate(t.scheduledStart, 'EEE, d MMM yyyy')}
                    <span className="block text-[12.5px] text-ink-faint">{fmtTime(t.scheduledStart)}–{fmtTime(t.scheduledEnd)} WIB</span>
                  </td>
                  <td className="hidden px-3 py-3.5 md:table-cell"><ModeTag mode={t.mode} /></td>
                  <td className="hidden px-3 py-3.5 md:table-cell">{t.screeningLevel && <ScreeningChip level={t.screeningLevel} />}</td>
                  <td className="flex flex-wrap gap-1.5 px-5 pb-4 pt-2 md:table-cell md:py-3.5 md:text-right">
                    <StatusChip status={t.status} />
                    {t.outcome && t.outcome !== 'no_show' && <span className="md:ml-1.5"><OutcomeChip outcome={t.outcome} /></span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <Pagination className="mt-4" page={page} pageSize={pageSize} total={data.total} unit="sesi" onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} onPageSize={setPageSize} />
      )}
    </div>
  );
}

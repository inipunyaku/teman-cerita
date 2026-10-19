import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, fmtTime } from '@/lib/format';
import type { Ticket } from '@/lib/types';
import { Avatar, EmptyState, ModeTag, OutcomeChip, PageHeader, ScreeningChip, Segmented, StatusChip } from '@/components/ui';
import { TableSkeleton } from '@/components/Skeletons';
import { CLIENT_TOPICS, type ClientTopic } from '@shared/constants';

type Tab = 'upcoming' | 'awaiting' | 'history' | 'all';

export default function Sessions() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const { data, isLoading } = useQuery({ queryKey: ['tickets', 'psych'], queryFn: () => api.get<{ tickets: Ticket[] }>('/tickets') });
  const all = data?.tickets ?? [];
  const list = all.filter((t) =>
    tab === 'upcoming'
      ? ['scheduled', 'in_progress'].includes(t.status)
      : tab === 'awaiting'
        ? t.status === 'awaiting_report'
        : tab === 'history'
          ? ['completed', 'no_show', 'cancelled'].includes(t.status)
          : true,
  );
  if (tab === 'upcoming') list.sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  else list.sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart));
  const awaitingCount = all.filter((t) => t.status === 'awaiting_report').length;

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
      {isLoading ? (
        <TableSkeleton />
      ) : list.length === 0 ? (
        <div className="card"><EmptyState title={tab === 'awaiting' ? 'Semua hasil sesi sudah diisi' : 'Tidak ada sesi'} /></div>
      ) : (
        <div className="card overflow-hidden">
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
    </div>
  );
}

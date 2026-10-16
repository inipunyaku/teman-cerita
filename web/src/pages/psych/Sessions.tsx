import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, fmtSchedule } from '@/lib/format';
import type { Ticket } from '@/lib/types';
import { Avatar, EmptyState, ModeTag, PageHeader, Segmented, SeverityChip, StatusChip } from '@/components/ui';
import { TableSkeleton } from '@/components/Skeletons';
import { REQUEST_TOPICS, type RequestTopic } from '@shared/constants';

type Tab = 'active' | 'completed' | 'all';

export default function Sessions() {
  const [tab, setTab] = useState<Tab>('active');
  const { data, isLoading } = useQuery({ queryKey: ['tickets', 'psych'], queryFn: () => api.get<{ tickets: Ticket[] }>('/tickets') });
  const list = (data?.tickets ?? []).filter((t) =>
    tab === 'all' ? true : tab === 'completed' ? ['completed', 'cancelled'].includes(t.status) : !['completed', 'cancelled'].includes(t.status),
  );
  if (tab === 'completed') list.sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt));

  return (
    <div className="animate-rise">
      <PageHeader title="Sesi saya" description="Sesi yang ditugaskan admin kepadamu." actions={
        <Segmented value={tab} onChange={setTab} options={[{ value: 'active', label: 'Aktif' }, { value: 'completed', label: 'Riwayat' }, { value: 'all', label: 'Semua' }]} />
      } />
      {isLoading ? (
        <TableSkeleton />
      ) : list.length === 0 ? (
        <div className="card"><EmptyState title={tab === 'active' ? 'Tidak ada sesi aktif' : 'Belum ada riwayat'} /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="hidden border-b border-line bg-canvas/60 md:table-header-group">
              <tr>
                <th className="table-head px-5 py-3">Karyawan</th>
                <th className="table-head px-3 py-3">Jadwal</th>
                <th className="table-head px-3 py-3">Metode</th>
                <th className="table-head px-3 py-3">Status</th>
                <th className="table-head px-5 py-3 text-right">Keparahan</th>
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
                          {t.employee.name}
                          {t.unread > 0 && <span className="chip h-5 bg-sky-600 px-2 text-white"><MessageCircle size={11} />{t.unread}</span>}
                        </span>
                        <span className="block text-[12.5px] text-ink-faint">{t.code} · {REQUEST_TOPICS[t.topic as RequestTopic]}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="block px-5 pt-2 text-sm md:table-cell md:px-3 md:py-3.5">{t.scheduledStart ? fmtSchedule(t.scheduledStart, t.scheduledEnd) : '-'}<span className="hidden text-[12px] text-ink-faint md:block">{t.scheduledStart && fmtDate(t.scheduledStart, 'yyyy')}</span></td>
                  <td className="hidden px-3 py-3.5 md:table-cell"><ModeTag mode={t.mode} /></td>
                  <td className="inline-block px-5 pb-4 pt-2 md:table-cell md:px-3 md:py-3.5"><StatusChip status={t.status} /></td>
                  <td className="inline-block pb-4 pt-2 md:table-cell md:px-5 md:py-3.5 md:text-right">{t.severity && <SeverityChip severity={t.severity} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

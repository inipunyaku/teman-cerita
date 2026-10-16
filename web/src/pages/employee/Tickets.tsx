import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, fmtSchedule } from '@/lib/format';
import type { Ticket } from '@/lib/types';
import { EmptyState, ModeTag, PageHeader, StatusChip } from '@/components/ui';
import { ListSkeleton } from '@/components/Skeletons';
import { REQUEST_TOPICS, type RequestTopic } from '@shared/constants';

export default function Tickets() {
  const { data, isLoading } = useQuery({ queryKey: ['tickets', 'mine'], queryFn: () => api.get<{ tickets: Ticket[] }>('/tickets') });
  return (
    <div className="animate-rise">
      <PageHeader title="Tiketku" description="Semua permintaan konselingmu, dari yang terbaru." actions={<Link to="/ajukan" className="btn btn-primary"><Plus size={18} /> Ajukan sesi</Link>} />
      {isLoading ? (
        <ListSkeleton header={false} />
      ) : !data?.tickets.length ? (
        <div className="card">
          <EmptyState title="Belum ada tiket" description="Kalau butuh teman cerita, kami di sini." action={<Link to="/ajukan" className="btn btn-primary">Ajukan sesi pertama</Link>} />
        </div>
      ) : (
        <div className="space-y-3">
          {data.tickets.map((t) => (
            <Link key={t.id} to={`/tiket/${t.id}`} className="card group flex items-center gap-4 p-4 transition-shadow hover:shadow-soft sm:p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12.5px] font-semibold tracking-[.08em] text-sky-800">{t.code}</span>
                  <StatusChip status={t.status} />
                  {t.unread > 0 && <span className="chip bg-sky-600 text-white">{t.unread} pesan</span>}
                </div>
                <p className="mt-2 font-semibold">{REQUEST_TOPICS[t.topic as RequestTopic]}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-soft">
                  <ModeTag mode={t.mode} />
                  <span>{t.scheduledStart ? fmtSchedule(t.scheduledStart, t.scheduledEnd) : `Diajukan ${fmtDate(t.createdAt)}`}</span>
                  {t.psychologist && <span>{t.psychologist.name}</span>}
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

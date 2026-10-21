import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MessageCircle, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, fmtTime, fullPsychName } from '@/lib/format';
import type { Ticket } from '@/lib/types';
import { Avatar, EmptyState, MODE_ICON, OutcomeChip, PageHeader, Segmented, StatusChip } from '@/components/ui';
import { ListSkeleton } from '@/components/Skeletons';
import { Pagination, SearchInput, matchText, useDebounced, usePaged } from '@/components/table';
import { CLIENT_TOPICS, MODE_LABEL, MODES, type ClientTopic } from '@shared/constants';

type Tab = 'upcoming' | 'done' | 'cancelled';
const TABS: { value: Tab; label: string }[] = [
  { value: 'upcoming', label: 'Akan Datang' },
  { value: 'done', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
];

export default function Registrations() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('');
  const search = useDebounced(q);
  const { data, isLoading } = useQuery({ queryKey: ['tickets', 'mine'], queryFn: () => api.get<{ tickets: Ticket[] }>('/tickets') });
  const all = data?.tickets ?? [];
  const list = all.filter(
    (t) =>
      (tab === 'upcoming' ? ['scheduled', 'in_progress'].includes(t.status) : tab === 'done' ? ['awaiting_report', 'completed', 'no_show'].includes(t.status) : t.status === 'cancelled') &&
      (!mode || t.mode === mode) &&
      matchText(search, t.code, t.psychologist.name, CLIENT_TOPICS[t.topic as ClientTopic], fmtDate(t.scheduledStart, 'd MMMM yyyy')),
  );
  if (tab === 'upcoming') list.sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  const paged = usePaged(list, `${tab}|${search}|${mode}`, 10);

  return (
    <div className="animate-rise">
      <PageHeader title="Pendaftaran Saya" description="Semua jadwal konselingmu, hasil, dan tindak lanjutnya." actions={<Link to="/buat-janji" className="btn btn-primary"><Plus size={18} /> Buat janji</Link>} />
      <Segmented className="mb-4" value={tab} onChange={setTab} options={TABS.map((t) => ({ ...t, label: `${t.label}` }))} />
      {all.length > 0 && (
        <div className="mb-5 grid gap-2 sm:grid-cols-[1fr_200px]">
          <SearchInput value={q} onChange={setQ} placeholder="Cari kode tiket, psikolog, topik, tanggal" label="Cari pendaftaran" />
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Media">
            <option value="">Semua media</option>
            {MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
          </select>
        </div>
      )}
      {isLoading ? (
        <ListSkeleton header={false} avatar />
      ) : list.length === 0 && (search || mode) ? (
        <div className="card"><EmptyState title="Tidak ada yang cocok" description="Coba kata kunci atau filter lain." /></div>
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState
            title={tab === 'upcoming' ? 'Belum ada jadwal mendatang' : tab === 'done' ? 'Belum ada sesi yang selesai' : 'Tidak ada sesi yang dibatalkan'}
            description={tab === 'upcoming' ? 'Kalau butuh teman cerita, kami di sini.' : undefined}
            action={tab === 'upcoming' ? <Link to="/buat-janji" className="btn btn-primary">Buat janji konseling</Link> : undefined}
          />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paged.pageItems.map((t) => <RegistrationCard key={t.id} t={t} />)}
          </div>
          <Pagination className="mt-4" page={paged.page} pageSize={paged.pageSize} total={paged.total} unit="pendaftaran" onPage={paged.setPage} onPageSize={paged.setPageSize} sizes={[10, 20, 50]} />
        </>
      )}
    </div>
  );
}

export function RegistrationCard({ t }: { t: Ticket }) {
  const navigate = useNavigate();
  const Icon = MODE_ICON[t.mode];
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Sesi Konseling</span>
        <StatusChip status={t.status} />
        {t.outcome && <OutcomeChip outcome={t.outcome} />}
        {t.status === 'completed' && !t.hasFeedback && <span className="chip bg-sun-50 text-sun-700">Feedback belum diisi</span>}
        {t.unread > 0 && <span className="chip bg-sky-600 text-white"><MessageCircle size={12} /> {t.unread}</span>}
        <span className="ml-auto font-mono text-[12px] tracking-wide text-ink-faint">{t.code}</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
        <div className="flex items-center gap-3 text-sm">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700"><CalendarDays size={18} /></span>
          <div>
            <p className="font-semibold">{fmtDate(t.scheduledStart, 'EEEE, d MMMM yyyy')}</p>
            <p className="text-ink-soft">{fmtTime(t.scheduledStart)} – {fmtTime(t.scheduledEnd)} WIB · <Icon size={13} className="inline -translate-y-px" /> {MODE_LABEL[t.mode]}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Avatar name={t.psychologist.name} src={t.psychologist.avatarUrl} tone={t.psychologist.avatarTone} size={40} />
          <p className="font-semibold leading-snug">{fullPsychName(t.psychologist)}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/pendaftaran/${t.id}`)}>Lihat Detail</button>
      </div>
    </div>
  );
}

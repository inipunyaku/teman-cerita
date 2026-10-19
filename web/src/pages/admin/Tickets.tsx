import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, fmtTime } from '@/lib/format';
import type { Psychologist, Ticket, Unit } from '@/lib/types';
import { Avatar, EmptyState, ModeTag, OutcomeChip, PageHeader, ScreeningChip, StatusChip } from '@/components/ui';
import { TableSkeleton } from '@/components/Skeletons';
import { CLIENT_TOPICS, MODE_LABEL, MODES, TICKET_STATUS_LABEL, type ClientTopic } from '@shared/constants';

const TABS: { value: string; label: string }[] = [
  { value: 'upcoming', label: 'Akan datang' },
  { value: 'awaiting_report', label: TICKET_STATUS_LABEL.awaiting_report },
  { value: 'completed', label: TICKET_STATUS_LABEL.completed },
  { value: 'no_show', label: 'No show' },
  { value: 'cancelled', label: TICKET_STATUS_LABEL.cancelled },
  { value: '', label: 'Semua' },
];

export default function AdminTickets() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'upcoming';
  const [q, setQ] = useState(params.get('q') ?? '');
  const mode = params.get('mode') ?? '';
  const unit = params.get('unit') ?? '';
  const psych = params.get('psychologist') ?? '';
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v || k === 'status') next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const qs = new URLSearchParams({
    ...(status && { status }),
    ...(mode && { mode }),
    ...(unit && { unit }),
    ...(psych && { psychologist: psych }),
    ...(params.get('q') && { q: params.get('q')! }),
  });
  const { data, isLoading } = useQuery({ queryKey: ['tickets', 'admin', qs.toString()], queryFn: () => api.get<{ tickets: Ticket[] }>(`/tickets?${qs}`) });
  const { data: units } = useQuery({ queryKey: ['units-public'], queryFn: () => api.get<{ units: Unit[] }>('/meta/units') });
  const { data: psychs } = useQuery({ queryKey: ['psychologists'], queryFn: () => api.get<{ psychologists: Psychologist[] }>('/admin/psychologists') });

  return (
    <div className="animate-rise">
      <PageHeader title="Sesi konseling" description="Semua pendaftaran yang dibuat pekerja. Admin dapat memindahkan jadwal atau membatalkan sesi bila diperlukan." />

      <div className="scrollbar-thin -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => set('status', t.value)}
            className={clsx('h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold transition-colors', status === t.value ? 'border-sky-600 bg-sky-600 text-white' : 'border-line bg-white text-ink-soft hover:text-ink')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_170px_200px_220px]">
        <form className="relative" onSubmit={(e) => { e.preventDefault(); set('q', q.trim()); }}>
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input className="input pl-10" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => set('q', q.trim())} placeholder="Cari kode, nama, PN" aria-label="Cari" />
        </form>
        <select className="input" value={mode} onChange={(e) => set('mode', e.target.value)} aria-label="Media">
          <option value="">Semua media</option>
          {MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
        </select>
        <select className="input" value={psych} onChange={(e) => set('psychologist', e.target.value)} aria-label="Psikolog">
          <option value="">Semua psikolog</option>
          {psychs?.psychologists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input" value={unit} onChange={(e) => set('unit', e.target.value)} aria-label="Unit kerja">
          <option value="">Semua unit kerja</option>
          {units?.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : !data?.tickets.length ? (
        <div className="card"><EmptyState title="Tidak ada sesi" description="Tidak ada sesi yang cocok dengan filter ini." /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="hidden border-b border-line bg-canvas/60 lg:table-header-group">
              <tr>
                <th className="table-head px-5 py-3">Tiket</th>
                <th className="table-head px-3 py-3">Pekerja</th>
                <th className="table-head px-3 py-3">Jadwal</th>
                <th className="table-head px-3 py-3">Psikolog</th>
                <th className="table-head px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.tickets.map((t) => (
                <tr key={t.id} className="relative block px-5 py-4 transition-colors hover:bg-sky-50/50 lg:table-row lg:p-0">
                  <td className="block lg:table-cell lg:px-5 lg:py-3.5">
                    <Link to={`/admin/sesi/${t.id}`} className="after:absolute after:inset-0">
                      <span className="font-mono text-[12.5px] font-semibold tracking-[.06em] text-sky-800">{t.code}</span>
                      <span className="mt-0.5 block text-[13px] text-ink-soft">{CLIENT_TOPICS[t.topic as ClientTopic] ?? t.topic}</span>
                    </Link>
                    {t.screeningLevel && <span className="mt-1 inline-block"><ScreeningChip level={t.screeningLevel} /></span>}
                  </td>
                  <td className="mt-2 block lg:mt-0 lg:table-cell lg:px-3 lg:py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={t.employee.name} src={t.employee.avatarUrl} tone={t.employee.avatarTone} size={32} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{t.employee.name}</p>
                        <p className="text-[12.5px] text-ink-faint">{t.employee.unitName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="mt-1 block text-sm lg:mt-0 lg:table-cell lg:px-3 lg:py-3.5">
                    <p>{fmtDate(t.scheduledStart, 'EEE, d MMM yyyy')}</p>
                    <p className="flex items-center gap-2 text-[12.5px] text-ink-faint">{fmtTime(t.scheduledStart)}–{fmtTime(t.scheduledEnd)} · <ModeTag mode={t.mode} className="text-[12.5px]" /></p>
                  </td>
                  <td className="mt-1 block text-sm lg:mt-0 lg:table-cell lg:px-3 lg:py-3.5">{t.psychologist.name}</td>
                  <td className="mt-2 flex flex-wrap items-center gap-1.5 lg:mt-0 lg:table-cell lg:px-5 lg:py-3.5 lg:text-right">
                    <StatusChip status={t.status} />
                    {t.outcome && t.outcome !== 'no_show' && <span className="lg:ml-1.5"><OutcomeChip outcome={t.outcome} /></span>}
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

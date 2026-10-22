import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { FileSpreadsheet, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api, errMsg } from '@/lib/api';
import { downloadScreeningExcel } from '@/lib/export';
import { fmtDate, fmtTime } from '@/lib/format';
import type { Psychologist, Ticket, Unit } from '@/lib/types';
import { Avatar, EmptyState, ModeTag, OutcomeChip, PageHeader, ScreeningChip, Spinner, StatusChip } from '@/components/ui';
import { TableSkeleton } from '@/components/Skeletons';
import { Pagination, SearchInput, useDebounced } from '@/components/table';
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
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = Number(params.get('size')) || 20;
  // Semua filter disimpan di URL (bisa dibagikan & bertahan saat kembali dari detail); ganti filter → halaman 1.
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v || k === 'status') next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const debouncedQ = useDebounced(q.trim());
  useEffect(() => {
    if (debouncedQ !== (params.get('q') ?? '')) set('q', debouncedQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);
  // Tanggal dipilih dalam WIB, dikirim sebagai waktu UTC.
  const wibStart = (d: string, addDays = 0) => new Date(new Date(`${d}T00:00:00+07:00`).getTime() + addDays * 864e5).toISOString();
  // Filter yang sama dipakai daftar & unduhan Excel.
  const qs = new URLSearchParams({
    ...(status && { status }),
    ...(mode && { mode }),
    ...(unit && { unit }),
    ...(psych && { psychologist: psych }),
    ...(params.get('q') && { q: params.get('q')! }),
    ...(from && { from: wibStart(from) }),
    ...(to && { to: wibStart(to, 1) }),
  });
  const listQs = new URLSearchParams(qs);
  listQs.set('page', String(page));
  listQs.set('pageSize', String(pageSize));
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['tickets', 'admin', listQs.toString()],
    queryFn: () => api.get<{ tickets: Ticket[]; total: number }>(`/tickets?${listQs}`),
    placeholderData: keepPreviousData,
  });
  const filtered = !!(mode || unit || psych || from || to || params.get('q'));
  const resetFilters = () => {
    setQ('');
    const next = new URLSearchParams();
    next.set('status', status);
    setParams(next, { replace: true });
  };
  const [exporting, setExporting] = useState(false);
  const exportExcel = async () => {
    setExporting(true);
    try {
      const n = await downloadScreeningExcel(qs);
      toast.success(n ? `${n} sesi diunduh.` : 'Tidak ada sesi untuk filter ini; file berisi judul kolom saja.');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setExporting(false);
    }
  };
  const { data: units } = useQuery({ queryKey: ['units-public'], queryFn: () => api.get<{ units: Unit[] }>('/meta/units') });
  const { data: psychs } = useQuery({ queryKey: ['psychologists'], queryFn: () => api.get<{ psychologists: Psychologist[] }>('/admin/psychologists') });

  return (
    <div className="animate-rise">
      <PageHeader
        title="Sesi konseling"
        description="Semua pendaftaran yang dibuat pekerja. Admin dapat memindahkan jadwal atau membatalkan sesi bila diperlukan."
        actions={
          <button type="button" className="btn btn-secondary" onClick={exportExcel} disabled={exporting} title="Skrining awal & catatan untuk klien, sesuai filter">
            {exporting ? <Spinner /> : <FileSpreadsheet size={17} />} Unduh Excel
          </button>
        }
      />

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

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_170px_200px_220px]">
        <SearchInput value={q} onChange={setQ} placeholder="Cari kode, nama, PN, nama panggilan" />
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
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[12px] font-semibold text-ink-faint">
          Jadwal dari
          <input type="date" className="input h-10 w-[170px] text-sm" value={from} max={to || undefined} onChange={(e) => set('from', e.target.value)} />
        </label>
        <label className="grid gap-1 text-[12px] font-semibold text-ink-faint">
          sampai
          <input type="date" className="input h-10 w-[170px] text-sm" value={to} min={from || undefined} onChange={(e) => set('to', e.target.value)} />
        </label>
        {filtered && (
          <button type="button" className="btn btn-ghost h-10 text-sm" onClick={resetFilters}>
            <RotateCcw size={15} /> Reset filter
          </button>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : !data?.tickets.length ? (
        <div className="card"><EmptyState title="Tidak ada sesi" description="Tidak ada sesi yang cocok dengan filter ini." /></div>
      ) : (
        <div className={clsx('card overflow-hidden transition-opacity', isFetching && 'opacity-60')}>
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
      {data && (
        <Pagination
          className="mt-4"
          page={page}
          pageSize={pageSize}
          total={data.total}
          unit="sesi"
          onPage={(p) => {
            set('page', String(p));
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onPageSize={(n) => set('size', String(n))}
        />
      )}
    </div>
  );
}

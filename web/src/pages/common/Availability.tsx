import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Info, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtYmd, hmDot, todayWib } from '@/lib/format';
import type { AvailabilityBlock, AvailabilitySession, Psychologist } from '@/lib/types';
import { Field, MODE_ICON, Modal, PageHeader, Sk, Spinner, StatusChip } from '@/components/ui';
import { MODE_LABEL, MODES, SCHEDULE, TIME_OPTIONS, toMin, weekday, type Mode } from '@shared/constants';

const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const mondayOf = (date: string) => addDays(date, -((weekday(date) + 6) % 7));

/** Kelola blok ketersediaan psikolog. Psikolog untuk dirinya sendiri; admin memilih psikolog. */
export default function Availability() {
  const { user } = useAuth();
  const admin = user!.role === 'admin';
  const qc = useQueryClient();
  const [week, setWeek] = useState(() => mondayOf(todayWib()));
  const [pid, setPid] = useState(0);
  const [adding, setAdding] = useState<string | null>(null);
  const psychs = useQuery({
    queryKey: ['psychologists'],
    enabled: admin,
    queryFn: () => api.get<{ psychologists: Psychologist[] }>('/admin/psychologists'),
  });
  const activePsychs = (psychs.data?.psychologists ?? []).filter((p) => p.status === 'verified');
  useEffect(() => {
    if (admin && !pid && activePsychs.length) setPid(activePsychs[0].id);
  }, [admin, pid, activePsychs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = Array.from({ length: 5 }, (_, i) => addDays(week, i));
  const target = admin ? pid : user!.id;
  const { data, isLoading } = useQuery({
    queryKey: ['availability', target, week],
    enabled: !!target,
    queryFn: () =>
      api.get<{ blocks: AvailabilityBlock[]; sessions: AvailabilitySession[] }>(
        `/availability?from=${days[0]}&to=${days[4]}${admin ? `&psychologistId=${target}` : ''}`,
      ),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/availability/${id}`),
    onSuccess: () => {
      toast.success('Ketersediaan dihapus.');
      qc.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const today = todayWib();

  return (
    <div className="animate-rise">
      <PageHeader
        title={admin ? 'Ketersediaan psikolog' : 'Jadwal & ketersediaan'}
        description="Pekerja hanya bisa memilih jam di dalam blok ketersediaan. Slot yang sudah dipesan, jam istirahat, dan jeda antarsesi otomatis disaring."
        actions={
          <button className="btn btn-primary" disabled={!target} onClick={() => setAdding(days.find((d) => d >= today) ?? addDays(week, 7))}>
            <Plus size={18} /> Tambah ketersediaan
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary btn-sm w-9 px-0" onClick={() => setWeek(addDays(week, -7))} aria-label="Minggu sebelumnya"><ChevronLeft size={17} /></button>
          <button className="btn btn-secondary btn-sm" onClick={() => setWeek(mondayOf(today))}>Minggu ini</button>
          <button className="btn btn-secondary btn-sm w-9 px-0" onClick={() => setWeek(addDays(week, 7))} aria-label="Minggu berikutnya"><ChevronRight size={17} /></button>
          <span className="ml-1 text-sm font-semibold">{fmtYmd(days[0], 'd MMM')} – {fmtYmd(days[4], 'd MMM yyyy')}</span>
        </div>
        {admin && (
          <select className="input h-10 sm:w-72" value={pid} onChange={(e) => setPid(Number(e.target.value))} aria-label="Psikolog">
            {activePsychs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {days.map((d) => {
          const blocks = (data?.blocks ?? []).filter((b) => b.date === d);
          const sessions = (data?.sessions ?? []).filter((s) => s.date === d);
          const pastDay = d < today;
          return (
            <section key={d} className={clsx('card flex min-h-[180px] flex-col p-3.5', d === today && 'ring-2 ring-sky-200', pastDay && 'bg-canvas/60')}>
              <div className="flex items-baseline justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint">{DAY_SHORT[weekday(d)]}</p>
                <p className={clsx('display text-[24px]', d === today ? 'text-sky-700' : 'text-ink')}>{Number(d.slice(8))}</p>
              </div>
              {isLoading ? (
                <Sk className="mt-2 h-16 w-full rounded-xl" />
              ) : (
                <div className="mt-2 flex-1 space-y-2">
                  {blocks.length === 0 && <p className="text-[12.5px] text-ink-faint">Tidak ada ketersediaan.</p>}
                  {blocks.map((b) => (
                    <div key={b.id} className="group rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[13px] font-semibold tabular-nums text-sky-900">{hmDot(b.start)}–{hmDot(b.end)}</span>
                        {!pastDay && (
                          <button
                            className="rounded-md p-1 text-ink-faint hover:bg-coral-50 hover:text-coral-700"
                            aria-label="Hapus blok"
                            onClick={() => confirm(`Hapus ketersediaan ${hmDot(b.start)}–${hmDot(b.end)}?`) && remove.mutate(b.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div className="mt-1 flex gap-1.5 text-sky-700">
                        {b.modes.map((m) => {
                          const Icon = MODE_ICON[m];
                          return <Icon key={m} size={14} aria-label={MODE_LABEL[m]} />;
                        })}
                      </div>
                    </div>
                  ))}
                  {sessions.map((s) => {
                    const Icon = MODE_ICON[s.mode];
                    const body = (
                      <>
                        <div className="flex items-center justify-between gap-1 text-[12.5px]">
                          <span className="font-semibold tabular-nums">{hmDot(s.start)}–{hmDot(s.end)}</span>
                          <Icon size={13} className="text-ink-faint" />
                        </div>
                        <p className="truncate text-[12px] text-ink-soft">{s.nickname ?? s.code}</p>
                        <StatusChip status={s.status} className="mt-1 h-5 px-2 text-[11px]" />
                      </>
                    );
                    const cls = 'block rounded-xl border border-line bg-white px-2.5 py-2 hover:border-sky-300';
                    return (
                      <Link key={s.id} to={admin ? `/admin/sesi/${s.id}` : `/psikolog/sesi/${s.id}`} className={cls}>{body}</Link>
                    );
                  })}
                </div>
              )}
              {!pastDay && (
                <button className="btn btn-ghost btn-sm mt-2 w-full text-sky-700" onClick={() => setAdding(d)}>
                  <Plus size={15} /> Tambah
                </button>
              )}
              {sessions.filter((s) => s.status !== 'cancelled').length > 0 && (
                <p className="mt-1 text-center text-[11.5px] text-ink-faint">{sessions.length}/{SCHEDULE.maxPerPsychPerDay} sesi</p>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-4 flex gap-2 text-[12.5px] text-ink-faint">
        <Info size={14} className="mt-0.5 shrink-0" />
        Jam operasional {hmDot(SCHEDULE.open)}–{hmDot(SCHEDULE.close)} WIB. Istirahat Senin–Kamis 12.00–13.00 dan Jumat 11.30–13.30. Maksimal {SCHEDULE.maxPerPsychPerDay} sesi per hari dengan jeda 30 menit antarsesi.
      </p>

      {adding && target > 0 && <AddModal start={adding} psychologistId={admin ? target : undefined} onClose={() => setAdding(null)} />}
    </div>
  );
}

const PRESETS: [string, string, string][] = [
  ['Pagi', '08:00', '12:00'],
  ['Siang', '13:00', '16:30'],
  ['Seharian', '08:00', '16:30'],
];

function AddModal({ start, psychologistId, onClose }: { start: string; psychologistId?: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [from, setFrom] = useState(start);
  const [days, setDays] = useState<number[]>([weekday(start)].filter((d) => d >= 1 && d <= 5));
  const [weeks, setWeeks] = useState(1);
  const [time, setTime] = useState({ start: '08:00', end: '12:00' });
  const [modes, setModes] = useState<Mode[]>([...MODES]);
  const today = todayWib();

  const dates = useMemo(() => {
    const out: string[] = [];
    const monday = mondayOf(from);
    for (let w = 0; w < weeks; w++) {
      for (const d of days) {
        const date = addDays(monday, w * 7 + (d - 1));
        if (date >= from && date >= today) out.push(date);
      }
    }
    return out.sort();
  }, [from, days, weeks, today]);

  const valid = dates.length > 0 && modes.length > 0 && toMin(time.end) - toMin(time.start) >= 60;
  const m = useMutation({
    mutationFn: () => api.post<{ created: number }>('/availability', { psychologistId, dates, start: time.start, end: time.end, modes }),
    onSuccess: (r) => {
      toast.success(`${r.created} blok ketersediaan ditambahkan.`);
      qc.invalidateQueries({ queryKey: ['availability'] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Tambah ketersediaan"
      description="Buka rentang waktu yang bisa dipesan pekerja. Satu sesi = 60 menit."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={!valid || m.isPending} onClick={() => m.mutate()}>{m.isPending && <Spinner />} Simpan {dates.length > 0 && `(${dates.length} hari)`}</button>
        </>
      }
    >
      <div className="space-y-5 pb-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mulai tanggal">{(id) => <input id={id} type="date" className="input" min={today} value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />}</Field>
          <Field label="Ulangi selama">
            {(id) => (
              <select id={id} className="input" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                {[1, 2, 3, 4, 6, 8, 12].map((w) => <option key={w} value={w}>{w === 1 ? 'Minggu ini saja' : `${w} minggu`}</option>)}
              </select>
            )}
          </Field>
        </div>
        <div>
          <p className="label">Hari</p>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                onClick={() => setDays((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d]))}
                className={clsx('h-9 rounded-full border px-4 text-sm font-semibold', days.includes(d) ? 'border-sky-600 bg-sky-600 text-white' : 'border-line bg-white text-ink-soft')}
              >
                {DAY_SHORT[d]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="label">Jam</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PRESETS.map(([label, a, b]) => (
              <button key={label} type="button" className={clsx('chip h-8 border px-3', time.start === a && time.end === b ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-line bg-white text-ink-soft')} onClick={() => setTime({ start: a, end: b })}>
                {label} {hmDot(a)}–{hmDot(b)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={time.start} onChange={(e) => setTime({ ...time, start: e.target.value })} aria-label="Jam mulai">
              {TIME_OPTIONS.slice(0, -2).map((t) => <option key={t} value={t}>{hmDot(t)}</option>)}
            </select>
            <select className="input" value={time.end} onChange={(e) => setTime({ ...time, end: e.target.value })} aria-label="Jam selesai">
              {TIME_OPTIONS.slice(2).map((t) => <option key={t} value={t}>{hmDot(t)}</option>)}
            </select>
          </div>
          {toMin(time.end) - toMin(time.start) < 60 && <p className="err">Rentang minimal 60 menit.</p>}
          <p className="hint">Jam istirahat otomatis tidak bisa dipesan walau berada di dalam rentang ini.</p>
        </div>
        <div>
          <p className="label">Media konseling yang tersedia</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {MODES.map((md) => {
              const Icon = MODE_ICON[md];
              const on = modes.includes(md);
              return (
                <button
                  key={md}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setModes((xs) => (on ? xs.filter((x) => x !== md) : [...xs, md]))}
                  className={clsx('flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold', on ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-line text-ink-soft')}
                >
                  <Icon size={16} /> {MODE_LABEL[md]}
                </button>
              );
            })}
          </div>
        </div>
        <p className="rounded-2xl bg-canvas px-4 py-3 text-[13px] text-ink-soft">
          {dates.length ? <>Akan dibuka untuk: {dates.map((d) => fmtYmd(d, 'EEE d MMM')).join(', ')}.</> : 'Pilih minimal satu hari kerja mulai hari ini.'}
        </p>
      </div>
    </Modal>
  );
}

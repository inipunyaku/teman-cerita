import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Clock3, Info, Languages, Sparkles, UserRound, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { addMinutes, fmtYmd, fullPsychName, hmDot, todayWib } from '@/lib/format';
import type { DaySlot, PsychProfile } from '@/lib/types';
import { MODE_HINT, MODE_LABEL, MODES, ROOM_PREFIX, type Mode } from '@shared/constants';
import { Avatar, MODE_ICON, Modal, Sk } from './ui';

export interface SlotValue {
  psychologistId?: number;
  date?: string;
  time?: string;
  mode?: Mode;
}

const WEEKDAYS = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];

export function usePsychologists() {
  return useQuery({
    queryKey: ['booking', 'psychologists'],
    queryFn: () => api.get<{ psychologists: PsychProfile[] }>('/booking/psychologists'),
    staleTime: 300_000,
  });
}

/**
 * Pilih tanggal → psikolog yang tersedia → jam → media. Hanya slot yang masih kosong yang ditampilkan.
 * `ticketId` dipakai saat mengubah jadwal (slot milik tiket itu sendiri dianggap kosong).
 */
export function SlotPicker({ value, onChange, ticketId }: { value: SlotValue; onChange: (v: SlotValue) => void; ticketId?: number }) {
  const q = ticketId ? `&ticket=${ticketId}` : '';
  const [month, setMonth] = useState(() => (value.date ?? todayWib()).slice(0, 7));
  const [filter, setFilter] = useState<number | 0>(0);
  const [profileOf, setProfileOf] = useState<PsychProfile | null>(null);
  const { data: psychData } = usePsychologists();
  const psychs = psychData?.psychologists ?? [];

  const monthQ = useQuery({
    queryKey: ['booking', 'month', month, ticketId ?? 0],
    queryFn: () => api.get<{ days: string[]; minDate: string | null }>(`/booking/month?month=${month}${q}`),
  });
  const dayQ = useQuery({
    queryKey: ['booking', 'day', value.date, ticketId ?? 0],
    enabled: !!value.date,
    queryFn: () => api.get<{ psychologists: { psychologistId: number; slots: DaySlot[] }[] }>(`/booking/day?date=${value.date}${q}`),
  });

  // Lompat ke bulan dengan tanggal pertama yang boleh dipilih (mis. setelah jeda 2 minggu).
  useEffect(() => {
    const min = monthQ.data?.minDate;
    if (min && !value.date && min.slice(0, 7) > month) setMonth(min.slice(0, 7));
  }, [monthQ.data?.minDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const available = new Set(monthQ.data?.days ?? []);
  const daySlots = dayQ.data?.psychologists ?? [];
  const slotsOf = (pid?: number) => daySlots.find((p) => p.psychologistId === pid)?.slots ?? [];
  const listed = psychs.filter((p) => daySlots.some((d) => d.psychologistId === p.id) && (!filter || p.id === filter));
  const selectedPsych = psychs.find((p) => p.id === value.psychologistId);
  const times = slotsOf(value.psychologistId);
  const slot = times.find((t) => t.time === value.time);

  // Bila slot yang dipilih hilang (diambil orang lain), kosongkan pilihan jam.
  useEffect(() => {
    if (dayQ.data && value.time && !slot) onChange({ date: value.date, psychologistId: value.psychologistId });
  }, [dayQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const cells = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1).getDay();
    const days = new Date(y, m, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)] as (string | null)[];
  }, [month]);
  const shift = (n: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const canPrev = month > todayWib().slice(0, 7);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,280px)]">
      {/* Kalender */}
      <section className="card flex flex-col p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <button type="button" className="btn btn-ghost btn-sm w-9 px-0" disabled={!canPrev} onClick={() => shift(-1)} aria-label="Bulan sebelumnya">
            <ChevronLeft size={18} />
          </button>
          <p className="font-semibold">{fmtYmd(`${month}-01`, 'MMMM yyyy')}</p>
          <button type="button" className="btn btn-ghost btn-sm w-9 px-0" onClick={() => shift(1)} aria-label="Bulan berikutnya">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-7 text-center text-[12px] font-semibold text-ink-faint">
          {WEEKDAYS.map((d, i) => <span key={i} className="py-1.5">{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {cells.map((d, i) =>
            !d ? (
              <span key={i} />
            ) : monthQ.isLoading ? (
              <Sk key={i} className="mx-auto h-9 w-9 rounded-full" />
            ) : (
              <button
                key={d}
                type="button"
                disabled={!available.has(d)}
                onClick={() => onChange({ date: d, psychologistId: value.psychologistId })}
                aria-pressed={value.date === d}
                aria-label={fmtYmd(d)}
                className={clsx(
                  'mx-auto grid h-9 w-9 place-items-center rounded-full text-sm tabular-nums transition-colors',
                  value.date === d
                    ? 'bg-sky-600 font-semibold text-white'
                    : available.has(d)
                      ? 'font-semibold text-ink hover:bg-sky-50'
                      : 'text-ink-faint/60',
                  d === todayWib() && value.date !== d && 'ring-1 ring-sky-300',
                )}
              >
                {Number(d.slice(8))}
              </button>
            ),
          )}
        </div>
        {!monthQ.isLoading && available.size === 0 && (
          <p className="mt-3 text-center text-[13px] text-ink-faint">Belum ada jadwal tersedia di bulan ini. Coba bulan berikutnya.</p>
        )}
        <p className="mt-auto flex gap-2 rounded-2xl bg-sky-50 px-3.5 py-3 text-[12.5px] leading-snug text-sky-800">
          <Info size={15} className="mt-0.5 shrink-0" />
          {monthQ.data?.minDate
            ? `Tanggal yang dapat dipilih mulai ${fmtYmd(monthQ.data.minDate, 'd MMMM yyyy')} (jeda minimal 2 minggu dari sesi sebelumnya).`
            : 'Tanggal yang dapat dipilih adalah tanggal dengan ketersediaan psikolog.'}
        </p>
      </section>

      {/* Psikolog, waktu, media */}
      <section className="min-w-0 space-y-4">
        <div className="card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Pilih Psikolog</h3>
            <select className="input h-10 w-auto min-w-[190px] text-sm" value={filter} onChange={(e) => setFilter(Number(e.target.value))} aria-label="Saring psikolog">
              <option value={0}>Semua Psikolog</option>
              {psychs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {!value.date ? (
            <p className="mt-4 rounded-2xl bg-canvas px-4 py-6 text-center text-sm text-ink-soft">Pilih tanggal terlebih dahulu untuk melihat psikolog yang tersedia.</p>
          ) : dayQ.isLoading ? (
            <div className="mt-3 space-y-2">{[0, 1, 2].map((i) => <Sk key={i} className="h-16 w-full rounded-2xl" />)}</div>
          ) : listed.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-canvas px-4 py-6 text-center text-sm text-ink-soft">
              {filter ? 'Psikolog ini tidak punya slot kosong di tanggal tersebut.' : 'Slot di tanggal ini sudah penuh. Coba tanggal lain.'}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {listed.map((p) => {
                const active = value.psychologistId === p.id;
                return (
                  <li key={p.id} className={clsx('flex items-center gap-3 px-3.5 py-3 transition-colors', active ? 'bg-sky-50' : 'hover:bg-canvas')}>
                    <button type="button" onClick={() => onChange({ date: value.date, psychologistId: p.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-pressed={active}>
                      <Avatar name={p.name} src={p.avatarUrl} tone={p.avatarTone} size={44} />
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold leading-snug">{fullPsychName(p)}</span>
                        <span className="block truncate text-[12.5px] text-ink-soft">Spesialisasi: {p.specialization || '-'}</span>
                        <span className="text-[12px] text-ink-faint">{slotsOf(p.id).length} slot tersedia</span>
                      </span>
                    </button>
                    <button type="button" onClick={() => setProfileOf(p)} className="link shrink-0 text-[12.5px] xl:hidden">Lihat profil</button>
                    <span className={clsx('grid h-5 w-5 shrink-0 place-items-center rounded-full border-2', active ? 'border-sky-600' : 'border-line')}>
                      {active && <span className="h-2.5 w-2.5 rounded-full bg-sky-600" />}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selectedPsych && value.date && times.length > 0 && (
          <div className="card animate-rise p-4 sm:p-5">
            <h3 className="font-semibold">Pilih Waktu</h3>
            <p className="text-[13px] text-ink-soft">{fmtYmd(value.date)} · sesi 60 menit</p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {times.map((t) => (
                <button
                  key={t.time}
                  type="button"
                  onClick={() => onChange({ ...value, time: t.time, mode: value.mode && t.modes.includes(value.mode) ? value.mode : t.modes.length === 1 ? t.modes[0] : undefined })}
                  aria-pressed={value.time === t.time}
                  className={clsx(
                    'h-11 rounded-xl border text-sm font-semibold tabular-nums transition-colors',
                    value.time === t.time ? 'border-sky-600 bg-sky-600 text-white' : 'border-line bg-white hover:border-sky-300',
                  )}
                >
                  {hmDot(t.time)}
                </button>
              ))}
            </div>
          </div>
        )}

        {slot && (
          <div className="card animate-rise p-4 sm:p-5">
            <h3 className="font-semibold">Pilih media konseling yang kamu inginkan</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {MODES.map((m) => {
                const Icon = MODE_ICON[m];
                const ok = slot.modes.includes(m);
                const active = value.mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={!ok}
                    onClick={() => onChange({ ...value, mode: m })}
                    aria-pressed={active}
                    className={clsx(
                      'flex items-start gap-2.5 rounded-2xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                      active ? 'border-sky-500 bg-sky-50' : 'border-line bg-white hover:border-sky-200',
                    )}
                  >
                    <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', active ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-700')}>
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{MODE_LABEL[m]}</span>
                      <span className="block text-[12px] leading-snug text-ink-soft">{ok ? (m === 'offline' ? ROOM_PREFIX : MODE_HINT[m]) : 'Tidak tersedia di jam ini'}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Profil psikolog (desktop) */}
      <aside className="hidden xl:block">
        {selectedPsych ? (
          <div className="card sticky top-24 p-5">
            <PsychProfileBody p={selectedPsych} />
          </div>
        ) : (
          <div className="card grid h-full min-h-[200px] place-items-center p-5 text-center text-sm text-ink-faint">
            <span>
              <UserRound className="mx-auto mb-2 text-sky-300" size={28} />
              Profil psikolog tampil di sini setelah kamu memilih.
            </span>
          </div>
        )}
      </aside>

      {value.time && (
        <p className="flex items-center gap-2 text-[12.5px] text-ink-faint xl:col-span-3">
          <Clock3 size={14} /> {value.date && fmtYmd(value.date, 'd MMMM yyyy')}, {hmDot(value.time)}–{hmDot(addMinutes(value.time, 60))} · Semua waktu dalam WIB (UTC+07:00)
        </p>
      )}

      <Modal open={!!profileOf} onClose={() => setProfileOf(null)} title="Profil psikolog">
        {profileOf && <div className="pb-3"><PsychProfileBody p={profileOf} /></div>}
      </Modal>
    </div>
  );
}

export function PsychProfileBody({ p }: { p: PsychProfile }) {
  return (
    <>
      <div className="flex items-center gap-3.5">
        <Avatar name={p.name} src={p.avatarUrl} tone={p.avatarTone} size={60} />
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{fullPsychName(p)}</p>
          <p className="text-[13px] text-ink-soft">Psikolog</p>
        </div>
      </div>
      {p.bio && <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">{p.bio}</p>}
      <dl className="mt-4 space-y-3 border-t border-line pt-4 text-[13px]">
        {(
          [
            [Users, 'Spesialisasi', p.specialization],
            [Sparkles, 'Pendekatan', p.approach],
            [Languages, 'Bahasa', p.languages],
          ] as [typeof Users, string, string | null][]
        ).map(([Icon, label, v]) =>
          v ? (
            <div key={label} className="flex gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700">
                <Icon size={15} />
              </span>
              <div>
                <dt className="font-semibold text-ink">{label}</dt>
                <dd className="text-ink-soft">{v}</dd>
              </div>
            </div>
          ) : null,
        )}
      </dl>
    </>
  );
}

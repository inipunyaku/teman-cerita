import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowRight, CalendarPlus, ClipboardPen, MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { firstName, fmtDate, fmtSchedule, fmtTime, greeting, todayWib, wib, ymd } from '@/lib/format';
import type { Ticket } from '@/lib/types';
import { Avatar, EmptyState, ModeTag, ScreeningChip, Stat, StatusChip } from '@/components/ui';
import { PsychDashboardSkeleton } from '@/components/Skeletons';
import { CLIENT_TOPICS, type ClientTopic } from '@shared/constants';

const dayOf = (iso: string) => ymd(wib(iso));
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

export default function PsychDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['tickets', 'psych'], queryFn: () => api.get<{ tickets: Ticket[] }>('/tickets') });
  if (isLoading) return <PsychDashboardSkeleton />;
  const all = data?.tickets ?? [];
  const today = todayWib();
  const live = all.filter((t) => t.status !== 'cancelled');
  const todays = live.filter((t) => dayOf(t.scheduledStart) === today).sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  const awaiting = all.filter((t) => t.status === 'awaiting_report');
  const upcoming = all.filter((t) => t.status === 'scheduled' && dayOf(t.scheduledStart) > today).sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const monthKey = today.slice(0, 7);
  const doneMonth = all.filter((t) => t.status === 'completed' && dayOf(t.scheduledStart).startsWith(monthKey)).length;
  const unread = all.reduce((a, t) => a + t.unread, 0);
  const remaining = todays.filter((t) => ['scheduled', 'in_progress'].includes(t.status)).length;

  return (
    <div className="animate-rise">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-ink-soft">{greeting()},</p>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight">
            <span className="display text-[40px] italic text-sky-700">{firstName(user!.name)}</span>
            <span className="text-ink-faint">.</span> {remaining ? `Ada ${remaining} sesi lagi hari ini.` : 'Tidak ada sesi lagi hari ini.'}
          </h1>
        </div>
        <Link to="/psikolog/ketersediaan" className="btn btn-secondary"><CalendarPlus size={17} /> Atur ketersediaan</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sesi hari ini" value={todays.length} tone="sky" />
        <Stat label="Perlu diisi hasilnya" value={awaiting.length} tone={awaiting.length ? 'coral' : 'mint'} hint={awaiting.length ? 'Lengkapi form pasca-sesi' : 'Semua sudah terisi'} />
        <Stat label="7 hari ke depan" value={live.filter((t) => t.status === 'scheduled' && dayOf(t.scheduledStart) < addDays(today, 7)).length} tone="sun" />
        <Stat label="Selesai bulan ini" value={doneMonth} tone="mint" hint={unread ? `${unread} pesan belum dibaca` : undefined} />
      </div>

      <div className="card mt-6 grid grid-cols-7 overflow-hidden">
        {week.map((d, i) => {
          const n = live.filter((t) => dayOf(t.scheduledStart) === d).length;
          return (
            <div key={d} className={clsx('border-line px-1 py-3 text-center sm:py-4', i > 0 && 'border-l', i === 0 && 'bg-sky-50')}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{fmtDate(`${d}T05:00:00Z`, 'EEE')}</div>
              <div className={clsx('display mt-0.5 text-[26px]', i === 0 ? 'text-sky-700' : 'text-ink')}>{Number(d.slice(8))}</div>
              <div className="mt-1 flex justify-center gap-0.5">
                {Array.from({ length: Math.min(n, 4) }).map((_, j) => <span key={j} className="h-1.5 w-1.5 rounded-full bg-sky-500" />)}
                {n === 0 && <span className="h-1.5 w-1.5 rounded-full bg-line" />}
              </div>
            </div>
          );
        })}
      </div>

      {awaiting.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><ClipboardPen size={18} className="text-coral-500" /> Perlu diisi hasilnya</h2>
          <div className="card divide-y divide-line">
            {awaiting.map((t) => (
              <Link key={t.id} to={`/psikolog/sesi/${t.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-sky-50/50">
                <Avatar name={t.employee.name} src={t.employee.avatarUrl} tone={t.employee.avatarTone} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.nickname} <span className="font-normal text-ink-faint">· {t.code}</span></p>
                  <p className="truncate text-[12.5px] text-ink-soft">{fmtSchedule(t.scheduledStart, t.scheduledEnd)} WIB</p>
                </div>
                <span className="btn btn-primary btn-sm">Isi hasil</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section>
          <h2 className="mb-3 font-semibold">Agenda hari ini</h2>
          {todays.length === 0 ? (
            <div className="card"><EmptyState title="Tidak ada sesi hari ini" description="Waktunya mengisi ulang energi." /></div>
          ) : (
            <div className="space-y-3">
              {todays.map((t) => (
                <Link key={t.id} to={`/psikolog/sesi/${t.id}`} className="card flex gap-4 p-4 transition-shadow hover:shadow-soft sm:p-5">
                  <div className="w-14 shrink-0 text-center">
                    <div className="display text-[26px] text-ink">{fmtTime(t.scheduledStart)}</div>
                    <div className="text-[11.5px] text-ink-faint">s.d. {fmtTime(t.scheduledEnd)}</div>
                  </div>
                  <div className="min-w-0 flex-1 border-l border-line pl-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip status={t.status} />
                      <ModeTag mode={t.mode} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Avatar name={t.employee.name} src={t.employee.avatarUrl} tone={t.employee.avatarTone} size={24} />
                      <p className="font-semibold">{t.nickname}</p>
                      {t.screeningLevel && <ScreeningChip level={t.screeningLevel} />}
                    </div>
                    <p className="text-[13px] text-ink-soft">{t.employee.unitName} · {CLIENT_TOPICS[t.topic as ClientTopic] ?? t.topic}</p>
                  </div>
                  {t.unread > 0 && <span className="chip self-start bg-sky-600 text-white"><MessageCircle size={12} /> {t.unread}</span>}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Berikutnya</h2>
            <Link to="/psikolog/sesi" className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700">Semua sesi <ArrowRight size={15} /></Link>
          </div>
          <div className="card divide-y divide-line">
            {upcoming.length === 0 ? (
              <EmptyState title="Belum ada jadwal berikutnya" description="Pastikan ketersediaanmu sudah dibuka." />
            ) : (
              upcoming.slice(0, 6).map((t) => (
                <Link key={t.id} to={`/psikolog/sesi/${t.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-sky-50/50">
                  <Avatar name={t.employee.name} src={t.employee.avatarUrl} tone={t.employee.avatarTone} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t.nickname}</p>
                    <p className="truncate text-[12.5px] text-ink-soft">{fmtSchedule(t.scheduledStart, t.scheduledEnd)}</p>
                  </div>
                  <ModeTag mode={t.mode} className="hidden sm:inline-flex" />
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

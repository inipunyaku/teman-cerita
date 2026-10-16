import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { addDays, isSameDay, isThisMonth, startOfDay } from 'date-fns';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { firstName, fmtDate, fmtSchedule, fmtTime, greeting } from '@/lib/format';
import type { Ticket } from '@/lib/types';
import { Avatar, EmptyState, ModeTag, Stat, StatusChip } from '@/components/ui';
import { PsychDashboardSkeleton } from '@/components/Skeletons';
import { REQUEST_TOPICS, type RequestTopic } from '@shared/constants';

export default function PsychDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['tickets', 'psych'], queryFn: () => api.get<{ tickets: Ticket[] }>('/tickets') });
  if (isLoading) return <PsychDashboardSkeleton />;
  const all = data?.tickets ?? [];
  const live = all.filter((t) => ['scheduled', 'reschedule_requested', 'in_progress'].includes(t.status) && t.scheduledStart);
  const today = all.filter((t) => t.scheduledStart && isSameDay(new Date(t.scheduledStart), new Date()) && t.status !== 'cancelled');
  const inProgress = all.filter((t) => t.status === 'in_progress');
  const upcoming = live.filter((t) => new Date(t.scheduledStart!) >= addDays(startOfDay(new Date()), 1)).slice(0, 6);
  const doneMonth = all.filter((t) => t.status === 'completed' && t.completedAt && isThisMonth(new Date(t.completedAt))).length;
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i));
  const unread = all.reduce((a, t) => a + t.unread, 0);

  return (
    <div className="animate-rise">
      <div className="mb-8">
        <p className="text-ink-soft">{greeting()},</p>
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight">
          <span className="display text-[40px] italic text-sky-700">{firstName(user!.name)}</span>
          <span className="text-ink-faint">.</span> Ada {today.filter((t) => t.status !== 'completed').length || 'tidak ada'} sesi lagi hari ini.
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sesi hari ini" value={today.length} tone="sky" />
        <Stat label="Sedang berlangsung" value={inProgress.length} tone="mint" hint={inProgress.length ? 'Jangan lupa isi laporan' : undefined} />
        <Stat label="7 hari ke depan" value={live.filter((t) => new Date(t.scheduledStart!) < addDays(startOfDay(new Date()), 7)).length} tone="sun" />
        <Stat label="Selesai bulan ini" value={doneMonth} hint={unread ? `${unread} pesan belum dibaca` : undefined} />
      </div>

      <div className="card mt-6 grid grid-cols-7 overflow-hidden">
        {week.map((d, i) => {
          const n = live.filter((t) => isSameDay(new Date(t.scheduledStart!), d)).length + (i === 0 ? today.filter((t) => t.status === 'completed').length : 0);
          return (
            <div key={i} className={clsx('border-line px-1 py-3 text-center sm:py-4', i > 0 && 'border-l', i === 0 && 'bg-sky-50')}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{fmtDate(d, 'EEE')}</div>
              <div className={clsx('display mt-0.5 text-[26px]', i === 0 ? 'text-sky-700' : 'text-ink')}>{fmtDate(d, 'd')}</div>
              <div className="mt-1 flex justify-center gap-0.5">
                {Array.from({ length: Math.min(n, 4) }).map((_, j) => <span key={j} className="h-1.5 w-1.5 rounded-full bg-sky-500" />)}
                {n === 0 && <span className="h-1.5 w-1.5 rounded-full bg-line" />}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section>
          <h2 className="mb-3 font-semibold">Agenda hari ini</h2>
          {today.length === 0 ? (
            <div className="card"><EmptyState title="Tidak ada sesi hari ini" description="Waktunya mengisi ulang energi." /></div>
          ) : (
            <div className="space-y-3">
              {today.sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!)).map((t) => (
                <Link key={t.id} to={`/psikolog/sesi/${t.id}`} className="card flex gap-4 p-4 transition-shadow hover:shadow-soft sm:p-5">
                  <div className="w-14 shrink-0 text-center">
                    <div className="display text-[26px] text-ink">{fmtTime(t.scheduledStart!)}</div>
                    <div className="text-[11.5px] text-ink-faint">s.d. {fmtTime(t.scheduledEnd!)}</div>
                  </div>
                  <div className="min-w-0 flex-1 border-l border-line pl-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip status={t.status} />
                      <ModeTag mode={t.mode} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Avatar name={t.employee.name} src={t.employee.avatarUrl} tone={t.employee.avatarTone} size={24} />
                      <p className="font-semibold">{t.employee.name}</p>
                    </div>
                    <p className="text-[13px] text-ink-soft">{t.employee.unitName} · {REQUEST_TOPICS[t.topic as RequestTopic]}</p>
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
              <EmptyState title="Belum ada jadwal berikutnya" />
            ) : (
              upcoming.map((t) => (
                <Link key={t.id} to={`/psikolog/sesi/${t.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-sky-50/50">
                  <Avatar name={t.employee.name} src={t.employee.avatarUrl} tone={t.employee.avatarTone} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t.employee.name}</p>
                    <p className="truncate text-[12.5px] text-ink-soft">{fmtSchedule(t.scheduledStart, t.scheduledEnd)}</p>
                  </div>
                  {t.status === 'reschedule_requested' ? <StatusChip status={t.status} /> : <ModeTag mode={t.mode} className="hidden sm:inline-flex" />}
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

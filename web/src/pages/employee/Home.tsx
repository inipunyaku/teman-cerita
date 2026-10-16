import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { firstName, fmtDate, fmtSchedule, greeting } from '@/lib/format';
import type { Ticket } from '@/lib/types';
import { Avatar, Clouds, ModeTag, StatusChip, TicketCard } from '@/components/ui';
import { HomeSkeleton } from '@/components/Skeletons';
import { ACTIVE_STATUSES, REQUEST_TOPICS, type RequestTopic } from '@shared/constants';

export default function Home() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['tickets', 'mine'], queryFn: () => api.get<{ tickets: Ticket[] }>('/tickets') });
  const tickets = data?.tickets ?? [];
  const active = tickets.find((t) => ACTIVE_STATUSES.includes(t.status));
  const history = tickets.filter((t) => t !== active).slice(0, 3);

  return (
    <div className="animate-rise">
      <section className="grain relative -mx-4 overflow-hidden rounded-none bg-gradient-to-br from-sky-100 via-sky-50 to-haze px-5 pb-8 pt-7 sm:mx-0 sm:rounded-4xl sm:px-10 sm:pb-12 sm:pt-10">
        <Clouds className="pointer-events-none absolute -right-28 -top-6 w-[460px] animate-drift opacity-80 sm:-right-10 sm:w-[560px]" />
        <div className="relative max-w-lg">
          <p className="text-[15px] font-medium text-sky-800/80">{greeting()},</p>
          <h1 className="display mt-1 text-[48px] italic text-sky-900 sm:text-[60px]">{firstName(user!.name)}.</h1>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
            {active ? 'Ini kabar terbaru soal sesimu.' : 'Lagi kepikiran sesuatu? Ceritakan ke psikolog — rahasiamu aman di sini.'}
          </p>
          {!active && !isLoading && (
            <Link to="/ajukan" className="btn btn-primary mt-6 h-12 px-5 text-[15px]">
              Ajukan sesi konseling <ArrowRight size={18} />
            </Link>
          )}
        </div>
      </section>

      {isLoading ? (
        <HomeSkeleton />
      ) : (
        <>
          {active && (
            <section className="mt-6">
              <Link to={`/tiket/${active.id}`} className="group block">
                <TicketCard code={active.code} className="transition-shadow group-hover:shadow-soft">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip status={active.status} />
                    <ModeTag mode={active.mode} />
                  </div>
                  <p className="mt-2 font-semibold text-ink">
                    {active.status === 'pending'
                      ? 'Menunggu admin menjadwalkan psikolog'
                      : active.status === 'reschedule_requested'
                        ? 'Permintaan jadwal ulangmu sedang ditinjau'
                        : fmtSchedule(active.scheduledStart, active.scheduledEnd)}
                  </p>
                  {active.psychologist && (
                    <div className="mt-3 flex items-center gap-2.5">
                      <Avatar name={active.psychologist.name} src={active.psychologist.avatarUrl} tone={active.psychologist.avatarTone} size={30} />
                      <p className="text-sm text-ink-soft">
                        bersama {active.psychologist.name}
                        {active.psychologist.title ? `, ${active.psychologist.title}` : ''}
                      </p>
                    </div>
                  )}
                  {active.unread > 0 && (
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1 text-[12.5px] font-semibold text-white">
                      <MessageCircle size={14} /> {active.unread} pesan baru
                    </span>
                  )}
                </TicketCard>
              </Link>
            </section>
          )}

          <section className="card card-pad mt-6">
            <h2 className="font-semibold">Cara kerjanya</h2>
            <ol className="mt-4 grid gap-5 sm:grid-cols-3">
              {[
                ['Ajukan', 'Pilih topik dan cara ngobrol: chat, online meeting, atau tatap muka.'],
                ['Dijadwalkan', 'Admin menyiapkan psikolog, jam, dan tempatnya. Kamu dikabari lewat aplikasi & email.'],
                ['Cerita', 'Ngobrol dengan psikolog. Kalau berhalangan, ajukan jadwal ulang dari halaman tiket.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3.5">
                  <span className="display grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-50 text-[20px] italic text-sky-700">{i + 1}</span>
                  <div>
                    <p className="text-sm font-semibold">{t}</p>
                    <p className="text-[13.5px] leading-relaxed text-ink-soft">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {history.length > 0 && (
            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Riwayat terakhir</h2>
                <Link to="/tiket" className="text-sm font-semibold text-sky-700">Semua tiket</Link>
              </div>
              <div className="card divide-y divide-line">
                {history.map((t) => (
                  <Link key={t.id} to={`/tiket/${t.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-sky-50/50">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-canvas text-ink-soft">
                      <CalendarClock size={18} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{REQUEST_TOPICS[t.topic as RequestTopic]}</p>
                      <p className="text-[12.5px] text-ink-faint">{t.code} · {fmtDate(t.scheduledStart ?? t.createdAt)}</p>
                    </div>
                    <StatusChip status={t.status} />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

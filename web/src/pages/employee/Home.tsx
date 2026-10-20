import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDay, fmtTime, fmtYmd } from '@/lib/format';
import { SKY, accentFor, dailySeed, dayPart, daysToBirthday, useWibNow } from '@/lib/personal';
import type { Eligibility, Ticket } from '@/lib/types';
import { HomeSkeleton } from '@/components/Skeletons';
import { RegistrationCard } from './Registrations';
import { Affirmation, GreetingHero, Journey, MoodCheckin, SelfCare } from './HomeParts';

/** "hari ini" / "besok" / "pada Senin, 2 Nov" — enak dibaca di tengah kalimat. */
function sessionDay(iso: string) {
  const d = fmtDay(iso);
  return d === 'Hari ini' || d === 'Besok' ? d.toLowerCase() : `pada ${d}`;
}

/** Kartu ajakan satu baris (mis. isi feedback). */
function NoticeCard({ to, title, children }: { to: string; title: string; children: string }) {
  return (
    <Link to={to} className="card flex items-center gap-4 p-5 shadow-soft transition-shadow hover:shadow-pop sm:px-6">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[13.5px] leading-normal text-ink-soft">{children}</p>
      </div>
      <ArrowRight size={18} strokeWidth={2} absoluteStrokeWidth className="shrink-0 text-ink-faint" />
    </Link>
  );
}

export default function Home() {
  const { user } = useAuth();
  const u = user!;
  const { data, isLoading } = useQuery({ queryKey: ['tickets', 'mine'], queryFn: () => api.get<{ tickets: Ticket[] }>('/tickets') });
  const { data: el } = useQuery({ queryKey: ['booking', 'eligibility'], queryFn: () => api.get<Eligibility>('/booking/eligibility') });
  const tickets = data?.tickets ?? [];
  const active = tickets.find((t) => ['scheduled', 'in_progress'].includes(t.status));
  const needFeedback = tickets.find((t) => t.status === 'completed' && !t.hasFeedback);
  const awaiting = tickets.find((t) => t.status === 'awaiting_report');
  const nickname = u.nickname || u.name.split(' ')[0];

  const now = useWibNow();
  const part = dayPart(now);
  const accent = accentFor(u.gender);
  const birthdayIn = daysToBirthday(u.birthDate, now);
  const [breathe, setBreathe] = useState(0);

  // Pesan utama hero menyesuaikan keadaan pengguna saat ini.
  const lastDone = tickets
    .filter((t) => t.status === 'completed' || t.status === 'awaiting_report')
    .sort((a, b) => (a.scheduledStart < b.scheduledStart ? 1 : -1))[0];
  const sinceLast = lastDone ? Math.floor((Date.now() - Date.parse(lastDone.scheduledStart)) / 864e5) : null;
  const message =
    birthdayIn === 0
      ? 'Semoga tahun ini membawa banyak hal baik untukmu. Terima kasih sudah menjadi dirimu.'
      : active
        ? `Sesi konselingmu ${sessionDay(active.scheduledStart)} pukul ${fmtTime(active.scheduledStart)} WIB. Kami tunggu ceritamu.`
        : sinceLast !== null && sinceLast >= 1 && sinceLast <= 45
          ? `Sudah ${sinceLast} hari sejak sesi terakhirmu. Kamu sudah sejauh ini.\nTerima kasih sudah tetap berusaha.`
          : SKY[part].line;
  const firstTime = !isLoading && tickets.length === 0;

  return (
    <div>
      <GreetingHero part={part} now={now} greeting={`Selamat ${part}`} name={nickname} message={message} birthdayIn={birthdayIn}>
        {!active && !isLoading && el?.canBook && (
          <>
            <Link
              to="/buat-janji"
              className="btn mt-[22px] h-[46px] gap-2.5 self-start bg-brand px-5 text-[15px] text-white shadow-[0_10px_22px_-10px_rgba(37,124,243,0.45)] hover:brightness-95"
              style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 100%)' }}
            >
              <Calendar size={18} strokeWidth={2} absoluteStrokeWidth />
              {firstTime ? 'Mulai cerita pertamamu' : 'Buat janji konseling'}
              <ArrowRight size={18} strokeWidth={2} absoluteStrokeWidth />
            </Link>
            {el.earliestDate && (
              <p className="mt-3 text-[13px] text-ink-soft">
                Jadwal bisa dipilih mulai {fmtYmd(el.earliestDate, 'd MMMM yyyy')} (jeda 2 minggu dari sesi sebelumnya).
              </p>
            )}
          </>
        )}
        {!active && el && !el.canBook && (
          <p className="mt-5 max-w-md rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm text-ink-soft">{el.reason}</p>
        )}
      </GreetingHero>

      {isLoading ? (
        <HomeSkeleton />
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,632fr)_minmax(0,584fr)] lg:items-start">
          <div className="space-y-4">
            {active && <RegistrationCard t={active} />}

            {needFeedback && (
              <NoticeCard to={`/pendaftaran/${needFeedback.id}`} title={`Bagaimana pengalaman konselingmu, ${nickname}?`}>
                {`Hasil sesi ${needFeedback.code} sudah tersedia. Bantu kami dengan mengisi feedback singkat (±2 menit).`}
              </NoticeCard>
            )}
            {awaiting && (
              <NoticeCard to={`/pendaftaran/${awaiting.id}`} title="Sesi kamu sudah selesai 💙">
                Mohon menunggu hasil dan tindak lanjut dari psikolog.
              </NoticeCard>
            )}

            <MoodCheckin userId={u.id} part={part} now={now} accent={accent} canBook={!!el?.canBook} hasActive={!!active} onBreathe={() => setBreathe((x) => x + 1)} />
            <Journey tickets={tickets} el={el} joinedAt={u.createdAt} />
          </div>
          <div className="space-y-4">
            <SelfCare userId={u.id} part={part} now={now} breatheSignal={breathe} />
            <Affirmation seed={dailySeed(u.id, now)} />
          </div>
        </div>
      )}
    </div>
  );
}

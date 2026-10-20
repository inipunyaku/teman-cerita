import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ClipboardList, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDay, fmtTime, fmtYmd } from '@/lib/format';
import { SKY, WEEKDAY_NOTE, accentFor, accentVars, dailySeed, dayPart, daysToBirthday, useWibNow } from '@/lib/personal';
import type { Eligibility, Ticket } from '@/lib/types';
import { HomeSkeleton } from '@/components/Skeletons';
import { RegistrationCard } from './Registrations';
import { Affirmation, Journey, MoodCheckin, SelfCare, SkyHero } from './HomeParts';

/** "hari ini" / "besok" / "pada Senin, 2 Nov" — enak dibaca di tengah kalimat. */
function sessionDay(iso: string) {
  const d = fmtDay(iso);
  return d === 'Hari ini' || d === 'Besok' ? d.toLowerCase() : `pada ${d}`;
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
          ? `Sudah ${sinceLast} hari sejak sesi terakhirmu. Semoga langkahmu terasa makin ringan.`
          : SKY[part].line;
  const firstTime = !isLoading && tickets.length === 0;

  return (
    <div style={accentVars(accent)}>
      <SkyHero
        part={part}
        now={now}
        accent={accent}
        greeting={`Selamat ${part}`}
        name={nickname}
        message={message}
        note={WEEKDAY_NOTE[now.getDay()]}
        birthdayIn={birthdayIn}
      >
        {!active && !isLoading && el?.canBook && (
          <>
            <Link
              to="/buat-janji"
              className="btn mt-6 h-12 px-5 text-[15px] text-white hover:brightness-95"
              style={{ background: accent.acc, boxShadow: `0 14px 28px -14px ${accent.acc}` }}
            >
              {firstTime ? 'Mulai cerita pertamamu' : 'Buat janji konseling'} <ArrowRight size={18} />
            </Link>
            {el.earliestDate && (
              <p className="mt-3 text-[13px]" style={{ color: SKY[part].soft }}>
                Jadwal bisa dipilih mulai {fmtYmd(el.earliestDate, 'd MMMM yyyy')} (jeda 2 minggu dari sesi sebelumnya).
              </p>
            )}
          </>
        )}
        {!active && el && !el.canBook && (
          <p className="mt-5 max-w-md rounded-2xl px-4 py-3 text-sm backdrop-blur-sm" style={{ background: SKY[part].glass }}>
            {el.reason}
          </p>
        )}
      </SkyHero>

      {isLoading ? (
        <HomeSkeleton />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <div className="space-y-4">
            {active && <RegistrationCard t={active} />}

            {needFeedback && (
              <Link to={`/pendaftaran/${needFeedback.id}`} className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-soft sm:p-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sun-50 text-sun-700"><Star size={22} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Bagaimana pengalaman konselingmu, {nickname}?</p>
                  <p className="text-sm text-ink-soft">Hasil sesi {needFeedback.code} sudah tersedia. Bantu kami dengan mengisi feedback singkat (±2 menit).</p>
                </div>
                <ArrowRight size={18} className="shrink-0 text-ink-faint" />
              </Link>
            )}
            {awaiting && (
              <Link to={`/pendaftaran/${awaiting.id}`} className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-soft sm:p-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-700"><ClipboardList size={22} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Sesi kamu sudah selesai 💙</p>
                  <p className="text-sm text-ink-soft">Mohon menunggu hasil dan tindak lanjut dari psikolog.</p>
                </div>
                <ArrowRight size={18} className="shrink-0 text-ink-faint" />
              </Link>
            )}

            <MoodCheckin userId={u.id} part={part} now={now} accent={accent} canBook={!!el?.canBook} hasActive={!!active} onBreathe={() => setBreathe((x) => x + 1)} />
            <Journey tickets={tickets} el={el} joinedAt={u.createdAt} accent={accent} />
          </div>
          <div className="space-y-4">
            <SelfCare userId={u.id} part={part} now={now} accent={accent} breatheSignal={breathe} />
            <Affirmation seed={dailySeed(u.id, now)} accent={accent} part={part} />
          </div>
        </div>
      )}
    </div>
  );
}

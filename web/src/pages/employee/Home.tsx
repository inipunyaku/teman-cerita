import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ClipboardList, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtYmd, greeting } from '@/lib/format';
import type { Eligibility, Ticket } from '@/lib/types';
import { Clouds } from '@/components/ui';
import { HomeSkeleton } from '@/components/Skeletons';
import { RegistrationCard } from './Registrations';

export default function Home() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['tickets', 'mine'], queryFn: () => api.get<{ tickets: Ticket[] }>('/tickets') });
  const { data: el } = useQuery({ queryKey: ['booking', 'eligibility'], queryFn: () => api.get<Eligibility>('/booking/eligibility') });
  const tickets = data?.tickets ?? [];
  const active = tickets.find((t) => ['scheduled', 'in_progress'].includes(t.status));
  const needFeedback = tickets.find((t) => t.status === 'completed' && !t.hasFeedback);
  const awaiting = tickets.find((t) => t.status === 'awaiting_report');
  const nickname = user!.nickname || user!.name.split(' ')[0];

  return (
    <div className="animate-rise">
      <section className="grain relative -mx-4 overflow-hidden rounded-none bg-gradient-to-br from-sky-100 via-sky-50 to-haze px-5 pb-8 pt-7 sm:mx-0 sm:rounded-4xl sm:px-10 sm:pb-12 sm:pt-10">
        <Clouds className="pointer-events-none absolute -right-28 -top-6 w-[460px] animate-drift opacity-80 sm:-right-10 sm:w-[560px]" />
        <div className="relative max-w-lg">
          <p className="text-[15px] font-medium text-sky-800/80">{greeting()},</p>
          <h1 className="display mt-1 text-[48px] italic text-sky-900 sm:text-[60px]">{nickname}.</h1>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
            {active ? 'Ini jadwal konselingmu yang akan datang.' : 'Lagi kepikiran sesuatu? Ceritakan ke psikolog profesional — rahasiamu aman di sini.'}
          </p>
          {!active && !isLoading && el?.canBook && (
            <>
              <Link to="/buat-janji" className="btn btn-primary mt-6 h-12 px-5 text-[15px]">
                Buat janji konseling <ArrowRight size={18} />
              </Link>
              {el.earliestDate && (
                <p className="mt-3 text-[13px] text-sky-900/70">Jadwal bisa dipilih mulai {fmtYmd(el.earliestDate, 'd MMMM yyyy')} (jeda 2 minggu dari sesi sebelumnya).</p>
              )}
            </>
          )}
          {!active && el && !el.canBook && <p className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm text-ink-soft">{el.reason}</p>}
        </div>
      </section>

      {isLoading ? (
        <HomeSkeleton />
      ) : (
        <div className="mt-6 space-y-4">
          {active && <RegistrationCard t={active} />}

          {needFeedback && (
            <Link to={`/pendaftaran/${needFeedback.id}`} className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-soft sm:p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sun-50 text-sun-700"><Star size={22} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Bagaimana pengalaman konselingmu?</p>
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

          <section className="card card-pad">
            <h2 className="font-semibold">Cara kerjanya</h2>
            <ol className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Persetujuan & skrining', 'Baca informed consent lalu isi skrining singkat tentang kondisimu.'],
                ['Pilih psikolog & jadwal', 'Lihat slot yang masih tersedia, pilih psikolog, jam, dan media konseling.'],
                ['Bercerita', 'Sesi 60 menit lewat tatap muka, chat, atau video/voice call Microsoft Teams.'],
                ['Hasil & feedback', 'Lihat hasil dan tindak lanjut dari psikolog, lalu bagikan pengalamanmu.'],
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
            {el && (
              <p className="mt-5 border-t border-line pt-4 text-[13px] text-ink-faint">
                Kuota tahun ini: {el.yearCount} dari {el.maxPerYear} sesi terpakai · jeda minimal 2 minggu antar sesi.
              </p>
            )}
          </section>

          {tickets.length > 0 && (
            <div className="flex justify-end">
              <Link to="/pendaftaran" className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700">Lihat semua pendaftaran <ArrowRight size={15} /></Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

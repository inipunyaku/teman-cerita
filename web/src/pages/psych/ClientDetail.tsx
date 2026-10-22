import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Lock } from 'lucide-react';
import { api, errMsg } from '@/lib/api';
import { ageOf } from '@/lib/format';
import type { HistoryItem } from '@/lib/types';
import { Avatar, ScreeningChip } from '@/components/ui';
import { DetailSkeleton } from '@/components/Skeletons';
import { HistoryList } from '@/components/SessionParts';
import { GENDER_LABEL, type Gender } from '@shared/constants';

interface ClientDetailResponse {
  client: {
    id: number;
    name: string;
    pn: string | null;
    unitName: string | null;
    nickname: string | null;
    avatarUrl: string | null;
    avatarTone: string | null;
    gender: string | null;
    birthDate: string | null;
    band: string | null;
    region: string | null;
  };
  /** Pernah/akan sesi dengan psikolog ini → catatan klinis lengkap. */
  mine: boolean;
  sessions: HistoryItem[];
}

export default function ClientDetail() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['psych-client', Number(id)],
    queryFn: () => api.get<ClientDetailResponse>(`/psych/clients/${id}`),
  });

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) return <p className="py-10 text-center text-ink-soft">{errMsg(error)}</p>;
  const { client: c, mine, sessions } = data;
  const latest = sessions[0];
  const age = ageOf(c.birthDate);
  const facts: [string, string | null | undefined][] = [
    ['Nama lengkap', c.name],
    ['PN', c.pn],
    ['Unit kerja', c.unitName],
    ['Band', c.band],
    ['Region', c.region],
    ['Jenis kelamin', c.gender ? GENDER_LABEL[c.gender as Gender] : null],
    ['Usia', age != null ? `${age} tahun` : null],
  ];

  return (
    <div className="animate-rise">
      <Link to="/psikolog/peserta" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> Peserta
      </Link>

      <div className="card card-pad flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar name={c.name} src={c.avatarUrl} tone={c.avatarTone} size={56} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{c.name}</h1>
            <p className="text-sm text-ink-soft">PN {c.pn ?? '-'} · {sessions.length} pendaftaran</p>
          </div>
        </div>
        {latest?.screeningLevel && (
          <div className="flex items-center gap-2 text-sm text-ink-soft">
            Skrining terakhir <ScreeningChip level={latest.screeningLevel} score={latest.screeningScore} />
          </div>
        )}
      </div>

      {!mine && (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-sun-50/70 px-4 py-3 text-[13.5px] text-sun-700">
          <Lock size={16} className="mt-0.5 shrink-0" />
          Peserta ini belum pernah sesi denganmu. Yang ditampilkan hanya skrining awal dan catatan untuk klien; catatan klinis lain tetap rahasia.
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="card card-pad">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Riwayat pendaftaran</h2>
            {sessions.length > 0 && (
              <span className="text-[12.5px] text-ink-faint">Klik untuk melihat skrining{mine ? ' & catatan' : ' & catatan untuk klien'}</span>
            )}
          </div>
          <HistoryList items={sessions} limited={!mine} emptyText="Belum ada pendaftaran." />
        </section>

        <section className="card card-pad self-start">
          <h2 className="mb-4 font-semibold">Data diri</h2>
          <dl className="grid gap-x-4 gap-y-3 text-sm">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-ink-faint">{k}</dt>
                <dd className="font-semibold">{v || '-'}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}

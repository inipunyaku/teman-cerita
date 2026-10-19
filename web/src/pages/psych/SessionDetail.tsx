import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, ClipboardCheck, Pencil, PlayCircle, Square } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, errMsg } from '@/lib/api';
import type { Report, TicketDetail } from '@/lib/types';
import { Avatar, Field, Modal, OUTCOME_STYLE, OutcomeChip, Spinner } from '@/components/ui';
import { ChatPanel } from '@/components/ChatPanel';
import { DetailSkeleton } from '@/components/Skeletons';
import { Timeline } from '@/components/Timeline';
import { ClientFacts, FeedbackSummary, HistoryList, ScheduleCard, ScreeningDetail } from '@/components/SessionParts';
import {
  CASE_CATEGORIES,
  CLIENT_TOPICS,
  OUTCOME_HINT,
  OUTCOME_LABEL,
  OUTCOMES,
  type CaseCategory,
  type ClientTopic,
  type Outcome,
} from '@shared/constants';

export default function SessionDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['ticket', Number(id)], queryFn: () => api.get<TicketDetail>(`/tickets/${id}`) });
  const [reportOpen, setReportOpen] = useState(false);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ticket', Number(id)] });
    qc.invalidateQueries({ queryKey: ['tickets'] });
  };
  const action = useMutation({
    mutationFn: (kind: 'start' | 'end') => api.post(`/tickets/${id}/${kind}`),
    onSuccess: (_, kind) => {
      toast.success(kind === 'start' ? 'Sesi dimulai. Klien sudah diberi tahu.' : 'Sesi diakhiri. Lanjutkan dengan mengisi hasil sesi.');
      refresh();
      if (kind === 'end') setReportOpen(true);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) return <p className="py-10 text-center text-ink-soft">{errMsg(error)}</p>;
  const { ticket: t, events, report, feedback, chat, history } = data;
  const started = Date.parse(t.scheduledStart) <= Date.now();
  const canStart = t.status === 'scheduled' && Date.parse(t.scheduledStart) - Date.now() <= 30 * 60e3;
  const canReport = t.status !== 'cancelled' && started;

  return (
    <div className="animate-rise">
      <Link to="/psikolog/sesi" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> Sesi saya
      </Link>

      <div className="card card-pad flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar name={t.employee.name} src={t.employee.avatarUrl} tone={t.employee.avatarTone} size={56} />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">{t.nickname} <span className="text-base font-normal text-ink-faint">({t.employee.name})</span></h1>
            <p className="text-sm text-ink-soft">{t.employee.unitName} · PN {t.employee.pn}</p>
            <p className="mt-0.5 font-mono text-[12px] tracking-[.06em] text-ink-faint">{t.code}{history.length > 0 && ` · sesi ke-${history.filter((h) => h.status !== 'cancelled').length + 1}`}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {t.status === 'scheduled' && (
            <button className="btn btn-mint" disabled={!canStart || action.isPending} onClick={() => action.mutate('start')} title={canStart ? undefined : 'Bisa dimulai 30 menit sebelum jadwal'}>
              {action.isPending ? <Spinner /> : <PlayCircle size={18} />} Mulai sesi
            </button>
          )}
          {t.status === 'in_progress' && (
            <button className="btn btn-secondary" disabled={action.isPending} onClick={() => action.mutate('end')}><Square size={16} /> Akhiri sesi</button>
          )}
          {canReport && (
            <button className={clsx('btn', report ? 'btn-secondary' : 'btn-primary')} onClick={() => setReportOpen(true)}>
              {report ? <Pencil size={16} /> : <ClipboardCheck size={18} />} {report ? 'Ubah hasil sesi' : 'Isi hasil sesi'}
            </button>
          )}
        </div>
      </div>

      {t.status === 'awaiting_report' && (
        <p className="mt-4 rounded-2xl bg-sun-50 px-4 py-3 text-sm text-sun-700">
          Sesi sudah berakhir. Klien sedang melihat pesan “menunggu hasil dari psikolog” — lengkapi form pasca-sesi, atau tandai <b>No show</b> bila klien tidak hadir.
        </p>
      )}

      <div className={clsx('mt-6 grid gap-6', chat.canRead && 'lg:grid-cols-[1fr_minmax(0,420px)]')}>
        <div className="min-w-0 space-y-4">
          <ScheduleCard t={t} onChanged={refresh} />

          <Card title="Kebutuhan klien">
            <dl className="space-y-4 text-[14.5px]">
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <div><dt className="eyebrow">Topik</dt><dd className="mt-1 font-semibold">{CLIENT_TOPICS[t.topic as ClientTopic] ?? t.topic}</dd></div>
                <div className="min-w-[200px] flex-1">
                  <dt className="eyebrow">Pengaruh pada keseharian</dt>
                  <dd className="mt-1.5 flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-canvas"><div className="h-full rounded-full bg-sky-500" style={{ width: `${t.impact * 10}%` }} /></div>
                    <span className="font-semibold tabular-nums">{t.impact}/10</span>
                  </dd>
                </div>
              </div>
              <div><dt className="eyebrow">Keluhan</dt><dd className="mt-1 whitespace-pre-wrap border-l-2 border-sky-200 pl-4 leading-relaxed text-ink-soft">{t.complaint}</dd></div>
              <div><dt className="eyebrow">Harapan dari sesi</dt><dd className="mt-1 whitespace-pre-wrap leading-relaxed text-ink-soft">{t.expectation}</dd></div>
            </dl>
          </Card>

          <Card title="Hasil skrining EANSCALE">
            <ScreeningDetail t={t} />
          </Card>

          {report && (
            <Card title="Hasil sesi" aside={<span className="text-[12.5px] text-ink-faint">Rahasia · hanya kamu yang bisa membaca</span>}>
              <div className="flex flex-wrap items-center gap-2">
                <OutcomeChip outcome={report.outcome} />
                {report.category && <span className="chip bg-canvas text-ink-soft ring-1 ring-line">{CASE_CATEGORIES[report.category as CaseCategory]?.label}</span>}
              </div>
              {report.outcome !== 'no_show' && (
                <dl className="mt-5 space-y-4 text-[14.5px]">
                  {(
                    [
                      ['Tujuan konseling', report.goal],
                      ['Riwayat kesehatan', report.healthHistory],
                      ['Gejala', report.symptoms],
                      ['Ringkasan sesi', report.summary],
                    ] as [string, string | null | undefined][]
                  ).map(([k, v]) => v && (
                    <div key={k}><dt className="eyebrow">{k}</dt><dd className="mt-1 whitespace-pre-wrap leading-relaxed">{v}</dd></div>
                  ))}
                </dl>
              )}
              {report.noteForClient && (
                <div className="mt-4 rounded-2xl bg-sky-50/70 px-4 py-3">
                  <p className="eyebrow">Catatan untuk klien</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{report.noteForClient}</p>
                </div>
              )}
              {feedback && <div className="mt-4"><FeedbackSummary feedback={feedback} /></div>}
            </Card>
          )}

          <Card title="Data diri klien"><ClientFacts t={t} /></Card>

          <Card title="Riwayat konseling klien"><HistoryList items={history} /></Card>

          <Card title="Linimasa"><Timeline events={events} /></Card>
        </div>

        {chat.canRead && (
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ChatPanel ticketId={t.id} otherName={t.nickname} otherAvatar={t.employee.avatarUrl} otherTone={t.employee.avatarTone} otherSubtitle={t.mode === 'chat' ? 'Ruang sesi konseling' : (t.employee.unitName ?? undefined)} className="h-[560px] lg:h-[calc(100dvh-8rem)] lg:max-h-[720px]" />
          </div>
        )}
      </div>

      {reportOpen && <ReportModal ticketId={t.id} initial={report} onClose={() => setReportOpen(false)} onDone={refresh} />}
    </div>
  );
}

function Card({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="card card-pad">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ReportModal({ ticketId, initial, onClose, onDone }: { ticketId: number; initial: Report | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    outcome: (initial?.outcome ?? '') as Outcome | '',
    goal: initial?.goal ?? '',
    healthHistory: initial?.healthHistory ?? '',
    symptoms: initial?.symptoms ?? '',
    summary: initial?.summary ?? '',
    category: initial?.category ?? '',
    noteForClient: initial?.noteForClient ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const noShow = f.outcome === 'no_show';
  const m = useMutation({
    mutationFn: () => api.post(`/tickets/${ticketId}/report`, f),
    onSuccess: () => {
      toast.success(initial ? 'Hasil sesi diperbarui.' : 'Hasil sesi tersimpan. Klien sudah dikabari.');
      onClose();
      onDone();
    },
    onError: (e) => {
      setErrors(e instanceof ApiError ? ((e.data.fields as typeof errors) ?? {}) : {});
      toast.error(errMsg(e));
    },
  });
  const err = (k: string) => errors[k]?.[0];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Form pasca-sesi"
      description="Isi hasil sesi. Detail klinis hanya bisa dibaca olehmu; admin hanya melihat rencana tindak lanjut dan kategori untuk laporan agregat."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Nanti dulu</button>
          <button className="btn btn-primary" disabled={!f.outcome || m.isPending} onClick={() => m.mutate()}>{m.isPending && <Spinner />} Simpan hasil</button>
        </>
      }
    >
      <div className="space-y-5 pb-2">
        <div>
          <p className="label">Rencana tindak lanjut</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {OUTCOMES.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setF({ ...f, outcome: o })}
                aria-pressed={f.outcome === o}
                className={clsx('flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors', f.outcome === o ? 'border-transparent' : 'border-line hover:border-sky-200')}
                style={f.outcome === o ? { boxShadow: `0 0 0 2px ${OUTCOME_STYLE[o].color}`, background: `${OUTCOME_STYLE[o].color}14` } : undefined}
              >
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: OUTCOME_STYLE[o].color }} />
                <span>
                  <span className="block text-sm font-semibold">{OUTCOME_LABEL[o]}</span>
                  <span className="block text-[12.5px] leading-snug text-ink-soft">{OUTCOME_HINT[o]}</span>
                </span>
              </button>
            ))}
          </div>
          {err('outcome') && <p className="err">{err('outcome')}</p>}
        </div>

        {!noShow && f.outcome && (
          <>
            <Field label="Tujuan konseling" error={err('goal')}>
              {(id) => <textarea id={id} className="input min-h-[80px]" rows={2} value={f.goal} onChange={set('goal')} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Riwayat kesehatan" optional>
                {(id) => <textarea id={id} className="input min-h-[80px]" rows={2} value={f.healthHistory} onChange={set('healthHistory')} />}
              </Field>
              <Field label="Gejala" optional>
                {(id) => <textarea id={id} className="input min-h-[80px]" rows={2} value={f.symptoms} onChange={set('symptoms')} />}
              </Field>
            </div>
            <Field label="Ringkasan sesi" error={err('summary')}>
              {(id) => <textarea id={id} className="input" rows={4} value={f.summary} onChange={set('summary')} placeholder="Keluhan utama, dinamika sesi, observasi…" />}
            </Field>
            <Field label="Kategorisasi permasalahan" error={err('category')} hint={f.category ? CASE_CATEGORIES[f.category as CaseCategory]?.desc : undefined}>
              {(id) => (
                <select id={id} className="input" value={f.category} onChange={set('category')}>
                  <option value="">Pilih kategori</option>
                  {Object.entries(CASE_CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                </select>
              )}
            </Field>
          </>
        )}

        {f.outcome && (
          <Field
            label={f.outcome === 'referral' ? 'Rekomendasi tindak lanjut untuk klien' : 'Catatan untuk klien'}
            optional
            hint="Ditampilkan ke klien di halaman tiketnya. Tulis dengan hangat dan singkat."
          >
            {(id) => <textarea id={id} className="input min-h-[80px]" rows={3} value={f.noteForClient} onChange={set('noteForClient')} />}
          </Field>
        )}
      </div>
    </Modal>
  );
}

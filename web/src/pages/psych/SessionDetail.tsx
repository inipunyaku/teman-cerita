import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertTriangle, ArrowLeft, ClipboardCheck, ExternalLink, MapPin, Phone, PlayCircle, Star, Video } from 'lucide-react';
import { toast } from 'sonner';
import { api, errMsg } from '@/lib/api';
import { fmtDate, fmtSchedule } from '@/lib/format';
import type { TicketDetail } from '@/lib/types';
import { Avatar, Field, Modal, ModeTag, SEVERITY_STYLE, SeverityChip, Spinner, StatusChip, UrgencyTag } from '@/components/ui';
import { ChatPanel } from '@/components/ChatPanel';
import { DetailSkeleton } from '@/components/Skeletons';
import { Timeline } from '@/components/Timeline';
import { REPORT_TOPICS, REQUEST_TOPICS, SEVERITIES, SEVERITY_LABEL, type ReportTopic, type RequestTopic, type Severity } from '@shared/constants';

const SEVERITY_HINT: Record<Severity, string> = {
  ringan: 'Stres situasional, fungsi sehari-hari terjaga',
  sedang: 'Mulai mengganggu kerja / relasi, perlu pemantauan',
  berat: 'Gangguan signifikan, perlu tindak lanjut terstruktur',
  kritis: 'Risiko keselamatan — eskalasi segera sesuai SOP',
};

export default function SessionDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['ticket', Number(id)], queryFn: () => api.get<TicketDetail>(`/tickets/${id}`) });
  const [reportOpen, setReportOpen] = useState(false);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ticket', Number(id)] });
    qc.invalidateQueries({ queryKey: ['tickets'] });
  };
  const start = useMutation({
    mutationFn: () => api.post(`/tickets/${id}/start`),
    onSuccess: () => {
      toast.success('Sesi dimulai. Karyawan sudah diberi tahu.');
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) return <p className="py-10 text-center text-ink-soft">{errMsg(error)}</p>;
  const { ticket: t, events, report, review, chat, reschedules } = data;
  const pendingReschedule = reschedules.find((r) => r.status === 'pending');
  const wa = t.employee.phone?.replace(/^0/, '62').replace(/\D/g, '');

  return (
    <div className="animate-rise">
      <Link to="/psikolog/sesi" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> Sesi saya
      </Link>

      <div className="card card-pad flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar name={t.employee.name} src={t.employee.avatarUrl} tone={t.employee.avatarTone} size={56} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{t.employee.name}</h1>
              <UrgencyTag urgency={t.urgency} />
            </div>
            <p className="text-sm text-ink-soft">{t.employee.unitName} · PN {t.employee.pn}</p>
            {t.employee.statusText && <p className="mt-0.5 text-[13px] italic text-sky-700">“{t.employee.statusText}”</p>}
            <p className="mt-0.5 font-mono text-[12px] tracking-[.06em] text-ink-faint">{t.code}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {t.status === 'scheduled' && (
            <button className="btn btn-mint" onClick={() => start.mutate()} disabled={start.isPending}>
              {start.isPending ? <Spinner /> : <PlayCircle size={18} />} Mulai sesi
            </button>
          )}
          {(t.status === 'in_progress' || t.status === 'scheduled') && (
            <button className={clsx('btn', t.status === 'in_progress' ? 'btn-primary' : 'btn-secondary')} onClick={() => setReportOpen(true)}>
              <ClipboardCheck size={18} /> Selesaikan & isi laporan
            </button>
          )}
        </div>
      </div>

      <div className={clsx('mt-6 grid gap-6', chat.canRead && 'lg:grid-cols-[1fr_minmax(0,440px)]')}>
        <div className="min-w-0 space-y-4">
          <div className="card card-pad">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={t.status} />
              <ModeTag mode={t.mode} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="eyebrow">Jadwal</p>
                <p className="mt-1 font-semibold">{fmtSchedule(t.scheduledStart, t.scheduledEnd)}</p>
                {t.scheduledStart && <p className="text-[13px] text-ink-soft">{fmtDate(t.scheduledStart, 'EEEE, d MMMM yyyy')}</p>}
              </div>
              <div>
                <p className="eyebrow">{t.mode === 'offline' ? 'Lokasi' : t.mode === 'online' ? 'Tautan' : 'Tempat'}</p>
                {t.mode === 'offline' && <p className="mt-1 flex gap-1.5 font-semibold"><MapPin size={16} className="mt-0.5 shrink-0 text-sky-600" />{t.location}</p>}
                {t.mode === 'online' && t.meetingUrl && (
                  <a href={t.meetingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 font-semibold text-sky-700 hover:underline"><Video size={16} /> Buka meeting <ExternalLink size={13} /></a>
                )}
                {t.mode === 'chat' && <p className="mt-1 font-semibold">Ruang chat aplikasi</p>}
              </div>
            </div>
            {wa && (
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="btn btn-soft btn-sm mt-4">
                <Phone size={15} /> WhatsApp {t.employee.phone}
              </a>
            )}
            {pendingReschedule && (
              <div className="mt-4 rounded-2xl bg-peach-50 px-4 py-3 text-[13.5px] text-peach-700">
                <p className="font-semibold">Karyawan meminta jadwal ulang — menunggu keputusan admin.</p>
                <p className="mt-0.5">Alasan: {pendingReschedule.reason}</p>
              </div>
            )}
          </div>

          <div className="card card-pad">
            <p className="eyebrow">Topik saat mengajukan</p>
            <p className="mt-1 font-semibold">{REQUEST_TOPICS[t.topic as RequestTopic]}</p>
            {t.story ? (
              <p className="mt-3 whitespace-pre-wrap border-l-2 border-sky-200 pl-4 text-[14.5px] leading-relaxed text-ink-soft">{t.story}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-faint">Karyawan tidak menuliskan cerita awal.</p>
            )}
          </div>

          {report && (
            <div className="card card-pad">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Laporan sesi</h2>
                <span className="text-[12.5px] text-ink-faint">Rahasia · hanya kamu yang bisa membaca</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {report.severity && <SeverityChip severity={report.severity} />}
                {report.topics?.map((tp) => <span key={tp} className="chip bg-canvas text-ink-soft ring-1 ring-line">{REPORT_TOPICS[tp as ReportTopic]}</span>)}
                {report.followUp && <span className="chip bg-sky-100 text-sky-700">Perlu sesi lanjutan</span>}
              </div>
              <dl className="mt-5 space-y-4 text-[14.5px]">
                <div><dt className="eyebrow">Ringkasan</dt><dd className="mt-1 whitespace-pre-wrap leading-relaxed">{report.summary}</dd></div>
                {report.recommendation && <div><dt className="eyebrow">Rekomendasi</dt><dd className="mt-1 whitespace-pre-wrap leading-relaxed">{report.recommendation}</dd></div>}
                {report.noteForEmployee && <div><dt className="eyebrow">Catatan untuk karyawan</dt><dd className="mt-1 whitespace-pre-wrap leading-relaxed text-ink-soft">{report.noteForEmployee}</dd></div>}
              </dl>
              {review && (
                <div className="mt-5 flex items-start gap-3 rounded-2xl bg-sun-50/60 px-4 py-3">
                  <div className="flex shrink-0 gap-0.5 pt-0.5">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={15} className={n <= review.rating ? 'fill-sun-500 text-sun-500' : 'text-line'} />)}</div>
                  <p className="text-sm text-ink-soft">{review.comment ?? 'Tanpa komentar.'}</p>
                </div>
              )}
            </div>
          )}

          <div className="card card-pad">
            <h2 className="mb-4 font-semibold">Linimasa</h2>
            <Timeline events={events} />
          </div>
        </div>

        {chat.canRead && (
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ChatPanel ticketId={t.id} otherName={t.employee.name} otherAvatar={t.employee.avatarUrl} otherTone={t.employee.avatarTone} otherSubtitle={t.employee.unitName ?? undefined} className="h-[560px] lg:h-[calc(100dvh-8rem)] lg:max-h-[720px]" />
          </div>
        )}
      </div>

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} ticketId={t.id} onDone={refresh} />
    </div>
  );
}

function ReportModal({ open, onClose, ticketId, onDone }: { open: boolean; onClose: () => void; ticketId: number; onDone: () => void }) {
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [topics, setTopics] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [noteForEmployee, setNote] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const m = useMutation({
    mutationFn: () => api.post(`/tickets/${ticketId}/complete`, { severity, topics, summary, recommendation, noteForEmployee, followUp }),
    onSuccess: () => {
      toast.success('Sesi selesai. Laporan tersimpan.');
      onClose();
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const toggle = (k: string) => setTopics((ts) => (ts.includes(k) ? ts.filter((x) => x !== k) : [...ts, k]));
  const valid = severity && topics.length > 0 && summary.trim().length >= 10;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Laporan sesi"
      description="Ringkasan & rekomendasi hanya bisa dibaca olehmu. Admin hanya melihat keparahan dan topik untuk statistik."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Nanti dulu</button>
          <button className="btn btn-primary" disabled={!valid || m.isPending} onClick={() => m.mutate()}>{m.isPending && <Spinner />} Simpan & selesaikan</button>
        </>
      }
    >
      <div className="space-y-6 pb-2">
        <div>
          <p className="label">Tingkat keparahan</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                aria-pressed={severity === s}
                className={clsx('flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors', severity === s ? 'border-transparent ring-2' : 'border-line hover:border-sky-200')}
                style={severity === s ? { boxShadow: `0 0 0 2px ${SEVERITY_STYLE[s].color}`, background: `${SEVERITY_STYLE[s].color}12` } : undefined}
              >
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: SEVERITY_STYLE[s].color }} />
                <span>
                  <span className="block text-sm font-semibold">{SEVERITY_LABEL[s]}</span>
                  <span className="block text-[12.5px] leading-snug text-ink-soft">{SEVERITY_HINT[s]}</span>
                </span>
              </button>
            ))}
          </div>
          {severity === 'kritis' && (
            <p className="mt-2 flex gap-2 rounded-2xl bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> Admin akan menerima notifikasi prioritas (tanpa isi laporan) untuk eskalasi.
            </p>
          )}
        </div>
        <div>
          <p className="label">Topik yang dibahas</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(REPORT_TOPICS).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => toggle(k)}
                aria-pressed={topics.includes(k)}
                className={clsx('h-8 rounded-full border px-3 text-[13px] font-medium transition-colors', topics.includes(k) ? 'border-sky-600 bg-sky-600 text-white' : 'border-line bg-white hover:border-sky-300')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Ringkasan sesi">
          {(id) => <textarea id={id} className="input" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Keluhan utama, dinamika sesi, observasi…" />}
        </Field>
        <Field label="Rekomendasi / rencana tindak lanjut" optional>
          {(id) => <textarea id={id} className="input" rows={3} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} />}
        </Field>
        <Field label="Catatan untuk karyawan" optional hint="Ditampilkan ke karyawan di halaman tiketnya. Tulis dengan hangat dan singkat.">
          {(id) => <textarea id={id} className="input" rows={2} value={noteForEmployee} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3">
          <span>
            <span className="block text-sm font-semibold">Perlu sesi lanjutan</span>
            <span className="block text-[12.5px] text-ink-soft">Dicatat untuk statistik dan pemantauan admin.</span>
          </span>
          <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} className="peer sr-only" />
          <span className="relative h-6 w-11 shrink-0 rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-sky-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-4 peer-focus-visible:ring-sky-100" />
        </label>
      </div>
    </Modal>
  );
}

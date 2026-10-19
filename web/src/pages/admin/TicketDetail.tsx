import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, CalendarX2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { api, errMsg } from '@/lib/api';
import { fmtDate, fullPsychName } from '@/lib/format';
import type { TicketDetail } from '@/lib/types';
import { Avatar, Field, Modal, OutcomeChip, ScreeningChip, Spinner, StatusChip } from '@/components/ui';
import { DetailSkeleton } from '@/components/Skeletons';
import { Timeline } from '@/components/Timeline';
import { ClientFacts, FeedbackSummary, HistoryList, ScheduleCard } from '@/components/SessionParts';
import { RescheduleModal } from '../employee/RegistrationDetail';
import { CASE_CATEGORIES, CLIENT_TOPICS, type CaseCategory, type ClientTopic } from '@shared/constants';

export default function AdminTicketDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['ticket', Number(id)], queryFn: () => api.get<TicketDetail>(`/tickets/${id}`) });
  const [modal, setModal] = useState<'reschedule' | 'cancel' | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ticket', Number(id)] });
    qc.invalidateQueries({ queryKey: ['tickets'] });
    qc.invalidateQueries({ queryKey: ['admin-overview'] });
    qc.invalidateQueries({ queryKey: ['booking'] });
  };

  if (isLoading) return <DetailSkeleton chat={false} />;
  if (error || !data) return <p className="py-10 text-center text-ink-soft">{errMsg(error)}</p>;
  const { ticket: t, events, report, feedback, history } = data;

  return (
    <div className="animate-rise">
      <Link to="/admin/sesi" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> Sesi konseling
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="font-mono text-[12px] font-semibold tracking-[.06em] text-ink-faint">{t.code}</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-semibold tracking-tight">{CLIENT_TOPICS[t.topic as ClientTopic] ?? t.topic}</h1>
            <StatusChip status={t.status} />
            {t.outcome && <OutcomeChip outcome={t.outcome} />}
          </div>
          <p className="text-[13px] text-ink-faint">Didaftarkan {fmtDate(t.createdAt, 'd MMM yyyy, HH.mm')} WIB</p>
        </div>
        {t.status === 'scheduled' && (
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary" onClick={() => setModal('reschedule')}><CalendarClock size={18} /> Ubah jadwal / psikolog</button>
            <button className="btn btn-ghost text-coral-700 hover:bg-coral-50 hover:text-coral-700" onClick={() => setModal('cancel')}><CalendarX2 size={18} /> Batalkan</button>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <ScheduleCard t={t} onChanged={refresh} />

          <div className="card card-pad">
            <p className="eyebrow mb-3">Psikolog</p>
            <div className="flex items-center gap-3">
              <Avatar name={t.psychologist.name} src={t.psychologist.avatarUrl} tone={t.psychologist.avatarTone} size={44} />
              <div>
                <p className="font-semibold">{fullPsychName(t.psychologist)}</p>
                <p className="text-[13px] text-ink-soft">{t.psychologist.specialization}</p>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Ringkasan layanan</h2>
              <span className="inline-flex items-center gap-1 text-[12px] text-ink-faint"><Lock size={12} /> Isi keluhan & catatan klinis hanya untuk psikolog</span>
            </div>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
              <div><dt className="text-ink-faint">Skrining EANSCALE</dt><dd className="mt-1">{t.screeningLevel && <ScreeningChip level={t.screeningLevel} score={t.screeningScore} />}</dd></div>
              <div><dt className="text-ink-faint">Pengaruh ke keseharian</dt><dd className="mt-1 font-semibold">{t.impact}/10</dd></div>
              <div><dt className="text-ink-faint">Kategori pasca-sesi</dt><dd className="mt-1 font-semibold">{report?.category ? CASE_CATEGORIES[report.category as CaseCategory]?.label : '-'}</dd></div>
            </dl>
            {t.status === 'awaiting_report' && <p className="mt-4 rounded-2xl bg-sun-50 px-4 py-3 text-[13px] text-sun-700">Sesi sudah berakhir, menunggu psikolog mengisi hasil.</p>}
            {feedback && <div className="mt-4"><FeedbackSummary feedback={feedback} /></div>}
          </div>

          <div className="card card-pad">
            <h2 className="mb-3 font-semibold">Riwayat konseling pekerja</h2>
            <HistoryList items={history} linkBase="/admin/sesi" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="card card-pad">
            <p className="eyebrow mb-3">Pekerja</p>
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={t.employee.name} src={t.employee.avatarUrl} tone={t.employee.avatarTone} size={44} />
              <div className="min-w-0">
                <p className="font-semibold">{t.employee.name}</p>
                <p className="text-[13px] text-ink-soft">Dipanggil “{t.nickname}”</p>
              </div>
            </div>
            <ClientFacts t={t} />
          </div>
          <div className="card card-pad">
            <h2 className="mb-4 font-semibold">Linimasa</h2>
            <Timeline events={events} />
          </div>
        </div>
      </div>

      {modal === 'reschedule' && (
        <RescheduleModal admin ticketId={t.id} initial={{ psychologistId: t.psychologist.id, mode: t.mode }} onClose={() => setModal(null)} onDone={refresh} />
      )}
      <CancelModal open={modal === 'cancel'} onClose={() => setModal(null)} ticketId={t.id} onDone={refresh} />
    </div>
  );
}

function CancelModal({ open, onClose, ticketId, onDone }: { open: boolean; onClose: () => void; ticketId: number; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => api.post(`/tickets/${ticketId}/cancel`, { reason }),
    onSuccess: () => { toast.success('Sesi dibatalkan. Pekerja & psikolog sudah dikabari.'); onClose(); onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="Batalkan sesi?" description="Pekerja dan psikolog akan diberi tahu. Slot kembali tersedia."
      footer={<><button className="btn btn-secondary" onClick={onClose}>Kembali</button><button className="btn btn-danger" disabled={reason.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>{m.isPending && <Spinner />} Batalkan sesi</button></>}>
      <Field label="Alasan">{(id) => <textarea id={id} className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
    </Modal>
  );
}

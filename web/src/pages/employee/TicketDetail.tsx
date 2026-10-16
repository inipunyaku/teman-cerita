import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, CalendarClock, CalendarX2, ExternalLink, MapPin, Quote, Star, Video } from 'lucide-react';
import { toast } from 'sonner';
import { api, errMsg } from '@/lib/api';
import { fmtDate, fmtSchedule } from '@/lib/format';
import type { TicketDetail as Detail } from '@/lib/types';
import { Avatar, Field, Modal, ModeTag, Spinner, StatusChip, TicketCard } from '@/components/ui';
import { DetailSkeleton } from '@/components/Skeletons';
import { ChatPanel } from '@/components/ChatPanel';
import { Timeline } from '@/components/Timeline';
import { REQUEST_TOPICS, URGENCY_LABEL, type RequestTopic } from '@shared/constants';

export default function TicketDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['ticket', Number(id)], queryFn: () => api.get<Detail>(`/tickets/${id}`) });
  const [modal, setModal] = useState<'cancel' | 'reschedule' | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ticket', Number(id)] });
    qc.invalidateQueries({ queryKey: ['tickets'] });
  };

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) return <p className="py-10 text-center text-ink-soft">{errMsg(error)}</p>;
  const { ticket: t, events, reschedules, report, review, chat } = data;
  const pendingReschedule = reschedules.find((r) => r.status === 'pending');
  const lastRejected = reschedules[0]?.status === 'rejected' && t.status === 'scheduled' ? reschedules[0] : null;
  const canCancel = ['pending', 'scheduled', 'reschedule_requested'].includes(t.status);

  return (
    <div className="animate-rise">
      <Link to="/tiket" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> Tiketku
      </Link>

      <TicketCard code={t.code}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={t.status} />
          <ModeTag mode={t.mode} />
        </div>
        <p className="mt-2 font-semibold">{REQUEST_TOPICS[t.topic as RequestTopic]}</p>
        <p className="text-[13px] text-ink-faint">Diajukan {fmtDate(t.createdAt, 'd MMM yyyy, HH.mm')} · {URGENCY_LABEL[t.urgency]}</p>
      </TicketCard>

      <div className={clsx('mt-6 grid gap-6', chat.canRead && 'lg:grid-cols-[1fr_minmax(0,440px)]')}>
        <div className="min-w-0 space-y-4">
          {/* Jadwal */}
          {t.status === 'pending' && (
            <div className="card card-pad flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sun-50 text-sun-700">
                <CalendarClock size={20} strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="font-semibold">Menunggu penjadwalan</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  Admin sedang mencarikan psikolog serta menentukan jam dan tempatnya. Kamu akan dikabari lewat notifikasi dan email begitu jadwalnya siap.
                </p>
              </div>
            </div>
          )}

          {t.psychologist && t.status !== 'cancelled' && (
            <div className="card card-pad">
              <div className="flex items-center gap-3.5">
                <Avatar name={t.psychologist.name} src={t.psychologist.avatarUrl} tone={t.psychologist.avatarTone} size={52} />
                <div className="min-w-0">
                  <p className="font-semibold">{t.psychologist.name}</p>
                  <p className="text-[13px] text-ink-soft">{t.psychologist.title ?? 'Psikolog'}</p>
                  {t.psychologist.statusText && <p className="mt-0.5 text-[13px] italic text-sky-700">“{t.psychologist.statusText}”</p>}
                </div>
              </div>
              <div className="mt-5 grid gap-3 rounded-2xl bg-sky-50/70 p-4 sm:grid-cols-2">
                <div>
                  <p className="eyebrow">Waktu</p>
                  <p className="mt-1 font-semibold">{fmtSchedule(t.scheduledStart, t.scheduledEnd)}</p>
                  {t.scheduledStart && <p className="text-[13px] text-ink-soft">{fmtDate(t.scheduledStart, 'EEEE, d MMMM yyyy')}</p>}
                </div>
                <div>
                  <p className="eyebrow">{t.mode === 'offline' ? 'Lokasi' : t.mode === 'online' ? 'Tautan' : 'Tempat'}</p>
                  {t.mode === 'offline' && <p className="mt-1 flex gap-1.5 font-semibold"><MapPin size={16} className="mt-0.5 shrink-0 text-sky-600" />{t.location}</p>}
                  {t.mode === 'online' && t.meetingUrl && (
                    <a href={t.meetingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 font-semibold text-sky-700 hover:underline">
                      <Video size={16} /> Buka meeting <ExternalLink size={13} />
                    </a>
                  )}
                  {t.mode === 'chat' && <p className="mt-1 font-semibold">Ruang chat di halaman ini</p>}
                </div>
              </div>
              {t.adminNote && <p className="mt-3 text-[13.5px] text-ink-soft"><span className="font-semibold text-ink">Catatan admin:</span> {t.adminNote}</p>}
              {lastRejected && (
                <p className="mt-3 rounded-2xl bg-peach-50 px-4 py-3 text-[13px] text-peach-700">
                  Permintaan jadwal ulangmu belum bisa disetujui: {lastRejected.responseNote}
                </p>
              )}
            </div>
          )}

          {pendingReschedule && (
            <div className="rounded-3xl border border-peach-500/25 bg-peach-50/60 p-5">
              <p className="font-semibold text-peach-700">Jadwal ulang sedang ditinjau admin</p>
              <p className="mt-1 text-sm text-ink-soft">Alasan: {pendingReschedule.reason}</p>
              <p className="mt-2 text-[13px] text-ink-soft">Admin akan menentukan jadwal baru dan mengabarimu. Sampai saat itu, jadwal lama masih berlaku.</p>
            </div>
          )}

          {t.status === 'cancelled' && (
            <div className="rounded-3xl border border-coral-500/20 bg-coral-50/60 p-5 text-sm">
              <p className="font-semibold text-coral-700">Tiket dibatalkan</p>
              <p className="mt-1 text-ink-soft">{t.cancelReason}</p>
            </div>
          )}

          {t.status === 'completed' && report?.noteForEmployee && (
            <figure className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-100 to-haze p-6">
              <Quote className="absolute right-5 top-5 text-sky-300" size={36} />
              <p className="eyebrow text-sky-800/70">Catatan dari {t.psychologist?.name}</p>
              <blockquote className="display mt-3 text-[24px] italic leading-snug text-sky-900">“{report.noteForEmployee}”</blockquote>
            </figure>
          )}

          {t.status === 'completed' && <ReviewCard ticketId={t.id} review={review} onDone={refresh} />}

          {(t.status === 'scheduled' || canCancel) && (
            <div className="flex flex-wrap gap-2">
              {t.status === 'scheduled' && (
                <button className="btn btn-secondary" onClick={() => setModal('reschedule')}>
                  <CalendarClock size={17} /> Ajukan jadwal ulang
                </button>
              )}
              {canCancel && (
                <button className="btn btn-ghost text-coral-700 hover:bg-coral-50 hover:text-coral-700" onClick={() => setModal('cancel')}>
                  <CalendarX2 size={17} /> Batalkan tiket
                </button>
              )}
            </div>
          )}

          {t.story && (
            <div className="card card-pad">
              <p className="eyebrow">Ceritamu saat mengajukan</p>
              <p className="mt-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-soft">{t.story}</p>
            </div>
          )}

          <div className="card card-pad">
            <h2 className="mb-4 font-semibold">Linimasa</h2>
            <Timeline events={events} hideActors />
          </div>
        </div>

        {chat.canRead && t.psychologist && (
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ChatPanel ticketId={t.id} otherName={t.psychologist.name} otherAvatar={t.psychologist.avatarUrl} otherTone={t.psychologist.avatarTone} otherSubtitle={t.psychologist.statusText ? `“${t.psychologist.statusText}”` : (t.psychologist.title ?? 'Psikolog')} className="h-[560px] lg:h-[calc(100dvh-8rem)] lg:max-h-[720px]" />
          </div>
        )}
      </div>

      <CancelModal open={modal === 'cancel'} onClose={() => setModal(null)} ticketId={t.id} onDone={refresh} />
      <RescheduleModal open={modal === 'reschedule'} onClose={() => setModal(null)} ticketId={t.id} onDone={refresh} />
    </div>
  );
}

function CancelModal({ open, onClose, ticketId, onDone }: { open: boolean; onClose: () => void; ticketId: number; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => api.post(`/tickets/${ticketId}/cancel`, { reason }),
    onSuccess: () => {
      toast.success('Tiket dibatalkan.');
      onClose();
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Batalkan tiket?"
      description="Kamu tetap bisa mengajukan sesi baru kapan saja."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Kembali</button>
          <button className="btn btn-danger" disabled={reason.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>
            {m.isPending && <Spinner />} Batalkan tiket
          </button>
        </>
      }
    >
      <Field label="Alasan">
        {(id) => <textarea id={id} className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Misalnya: sudah merasa lebih baik" />}
      </Field>
    </Modal>
  );
}

function RescheduleModal({ open, onClose, ticketId, onDone }: { open: boolean; onClose: () => void; ticketId: number; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => api.post(`/tickets/${ticketId}/reschedule`, { reason }),
    onSuccess: () => {
      toast.success('Permintaan jadwal ulang terkirim.');
      onClose();
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajukan jadwal ulang"
      description="Admin akan menentukan jadwal baru. Jadwal lama tetap berlaku sampai ada konfirmasi."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={reason.trim().length < 5 || m.isPending} onClick={() => m.mutate()}>
            {m.isPending && <Spinner />} Kirim permintaan
          </button>
        </>
      }
    >
      <div className="pb-2">
        <Field label="Kenapa perlu dijadwal ulang?" hint="Boleh sebutkan kapan kamu lebih longgar, admin akan mempertimbangkannya.">
          {(id) => <textarea id={id} className="input" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Misalnya: ada perjalanan dinas sampai Rabu" />}
        </Field>
      </div>
    </Modal>
  );
}

function ReviewCard({ ticketId, review, onDone }: { ticketId: number; review: Detail['review']; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const m = useMutation({
    mutationFn: () => api.post(`/tickets/${ticketId}/review`, { rating, comment }),
    onSuccess: () => {
      toast.success('Terima kasih atas ulasanmu!');
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (review) {
    return (
      <div className="card card-pad">
        <p className="eyebrow">Ulasanmu</p>
        <div className="mt-2 flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={20} className={n <= review.rating ? 'fill-sun-500 text-sun-500' : 'text-line'} />)}
        </div>
        {review.comment && <p className="mt-2 text-sm text-ink-soft">{review.comment}</p>}
      </div>
    );
  }
  return (
    <div className="card card-pad">
      <h2 className="font-semibold">Bagaimana sesimu?</h2>
      <p className="mt-1 text-sm text-ink-soft">Ulasanmu membantu kami menjaga kualitas layanan. Tidak wajib.</p>
      <div className="mt-4 flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} className="rounded-lg p-1" aria-label={`${n} bintang`}>
            <Star size={28} strokeWidth={1.5} className={clsx('transition-colors', n <= (hover || rating) ? 'fill-sun-500 text-sun-500' : 'text-ink-faint/50')} />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <div className="mt-3 animate-rise space-y-3">
          <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ada yang ingin kamu sampaikan? (opsional)" aria-label="Komentar" />
          <button className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending && <Spinner />} Kirim ulasan</button>
        </div>
      )}
    </div>
  );
}

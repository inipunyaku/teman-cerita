import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  HeartHandshake,
  Info,
  MapPin,
  Sprout,
  Star,
  Video,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, errMsg } from '@/lib/api';
import { revealInvalid } from '@/lib/validation';
import { fmtDate, fmtTime, fullPsychName } from '@/lib/format';
import type { Eligibility, Report, TicketDetail as Detail } from '@/lib/types';
import { Avatar, Field, MODE_ICON, Modal, Spinner, StatusChip } from '@/components/ui';
import { DetailSkeleton } from '@/components/Skeletons';
import { ChatPanel } from '@/components/ChatPanel';
import { SlotPicker, type SlotValue } from '@/components/SlotPicker';
import { CLIENT_TOPICS, FEEDBACK_ITEMS, MODE_LABEL, RESULT_TEXT, SCHEDULE, type ClientTopic } from '@shared/constants';

export default function RegistrationDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['ticket', Number(id)], queryFn: () => api.get<Detail>(`/tickets/${id}`) });
  const [modal, setModal] = useState<'cancel' | 'reschedule' | 'feedback' | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ticket', Number(id)] });
    qc.invalidateQueries({ queryKey: ['tickets'] });
    qc.invalidateQueries({ queryKey: ['booking'] });
  };

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) return <p className="py-10 text-center text-ink-soft">{errMsg(error)}</p>;
  const { ticket: t, report, feedback, chat } = data;
  const Icon = MODE_ICON[t.mode];
  const editable = t.status === 'scheduled' && Date.parse(t.scheduledStart) - Date.now() >= SCHEDULE.leadHours * 3600e3;
  const past = ['awaiting_report', 'completed', 'no_show'].includes(t.status);
  const showChat = chat.canRead;

  return (
    <div className="animate-rise">
      <nav className="mb-4 flex items-center gap-1.5 text-[13px] text-ink-faint">
        <Link to="/" className="hover:text-ink">Beranda</Link> <span>/</span>
        <Link to="/pendaftaran" className="hover:text-ink">Pendaftaran Saya</Link> <span>/</span>
        <span className="font-mono text-ink-soft">{t.code}</span>
      </nav>
      <Link to="/pendaftaran" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> Kembali ke Pendaftaran Saya
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[26px] font-semibold tracking-tight sm:text-[30px]">Tiket #{t.code}</h1>
        <StatusChip status={t.status} />
      </div>
      <p className="mt-1 text-ink-soft">
        {t.status === 'scheduled' && `Sesi dijadwalkan ${fmtDate(t.scheduledStart, 'EEEE, d MMMM yyyy')}, ${fmtTime(t.scheduledStart)} WIB.`}
        {t.status === 'in_progress' && 'Sesi sedang berlangsung.'}
        {past && `Sesi konseling telah selesai pada ${fmtDate(t.scheduledStart, 'd MMM yyyy')}, ${fmtTime(t.scheduledEnd)} WIB.`}
        {t.status === 'cancelled' && `Sesi dibatalkan${t.cancelReason ? `: ${t.cancelReason}` : '.'}`}
      </p>

      <div className={clsx('mt-6 grid gap-6', showChat && 'lg:grid-cols-[1fr_minmax(0,420px)]')}>
        <div className="min-w-0 space-y-5">
          <Section n={1} icon={<ClipboardList size={18} />} title="Detail Konseling">
            <div className="flex items-center gap-3.5">
              <Avatar name={t.psychologist.name} src={t.psychologist.avatarUrl} tone={t.psychologist.avatarTone} size={52} />
              <div className="min-w-0">
                <p className="font-semibold">{fullPsychName(t.psychologist)}</p>
                <p className="text-[13px] text-ink-soft">Psikolog{t.psychologist.specialization ? ` · ${t.psychologist.specialization}` : ''}</p>
              </div>
            </div>
            <dl className="mt-5 space-y-3.5 text-sm">
              <Item icon={<CalendarDays size={17} />} label="Tanggal & Waktu">
                {fmtDate(t.scheduledStart, 'EEEE, d MMMM yyyy')}, {fmtTime(t.scheduledStart)} – {fmtTime(t.scheduledEnd)} WIB
              </Item>
              <Item icon={<Icon size={17} />} label="Media Konseling">{MODE_LABEL[t.mode]}</Item>
              {t.mode === 'offline' && t.location && <Item icon={<MapPin size={17} />} label="Lokasi">{t.location}</Item>}
              {t.mode === 'online' && (
                <Item icon={<Video size={17} />} label="Tautan">
                  {t.meetingUrl ? (
                    <a href={t.meetingUrl} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">Buka Microsoft Teams <ExternalLink size={13} /></a>
                  ) : (
                    <span className="font-normal text-ink-soft">Tautan Microsoft Teams akan dikirim psikolog sebelum sesi.</span>
                  )}
                </Item>
              )}
              <Item icon={<FileText size={17} />} label="Topik Utama">{CLIENT_TOPICS[t.topic as ClientTopic] ?? t.topic}</Item>
            </dl>
            {t.status === 'scheduled' && (
              <>
                <p className="mt-5 flex gap-2 rounded-2xl bg-sky-50 px-4 py-3 text-[13px] leading-relaxed text-sky-800">
                  <Info size={16} className="mt-0.5 shrink-0" />
                  Toleransi keterlambatan maksimal 15 menit. Perubahan jadwal atau pembatalan paling lambat H-4 jam sebelum sesi.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn btn-secondary" disabled={!editable} onClick={() => setModal('reschedule')}><CalendarClock size={17} /> Ubah jadwal</button>
                  <button className="btn btn-ghost text-coral-700 hover:bg-coral-50 hover:text-coral-700" disabled={!editable} onClick={() => setModal('cancel')}><CalendarX2 size={17} /> Batalkan</button>
                </div>
                {!editable && <p className="mt-2 text-[12.5px] text-ink-faint">Sudah kurang dari 4 jam sebelum sesi. Hubungi admin bila ada kendala mendesak.</p>}
              </>
            )}
          </Section>

          {past && (
            <Section n={2} icon={<HeartHandshake size={18} />} title="Hasil & Tindak Lanjut">
              <ResultBody report={report} />
            </Section>
          )}

          {t.status === 'completed' && (
            <Section n={3} icon={<Star size={18} />} title="Feedback Sesi">
              {feedback ? (
                <div className="flex items-start gap-3.5 rounded-2xl border border-mint-500/25 bg-mint-50 px-5 py-4">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-mint-500" size={24} />
                  <div>
                    <p className="font-semibold">Feedback telah diisi</p>
                    <p className="text-sm text-ink-soft">Terima kasih sudah berbagi pengalamanmu.</p>
                    <p className="mt-1 text-[12.5px] text-ink-faint">Diisi pada {fmtDate(feedback.createdAt, 'd MMM yyyy, HH.mm')} WIB</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 rounded-2xl bg-sky-50/70 p-5 sm:flex-row sm:items-center">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-sky-600"><ClipboardList size={28} strokeWidth={1.6} /></span>
                  <div className="flex-1">
                    <p className="font-semibold">Bagaimana pengalaman konselingmu?</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                      Terima kasih sudah meluangkan waktu untuk bercerita bersama Teman Cerita BRILiaN. Yuk, bantu kami meningkatkan kualitas layanan dengan mengisi feedback singkat mengenai pengalaman konselingmu.
                    </p>
                    <button className="btn btn-primary mt-3" onClick={() => setModal('feedback')}>Isi Feedback <ArrowRight size={16} /></button>
                    <p className="mt-1.5 text-[12px] text-ink-faint">Hanya membutuhkan waktu ±2 menit.</p>
                  </div>
                </div>
              )}
            </Section>
          )}
        </div>

        {showChat && (
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ChatPanel
              ticketId={t.id}
              otherName={t.psychologist.name}
              otherAvatar={t.psychologist.avatarUrl}
              otherTone={t.psychologist.avatarTone}
              otherSubtitle={t.mode === 'chat' ? 'Ruang sesi konseling' : t.psychologist.statusText ? `“${t.psychologist.statusText}”` : 'Psikolog'}
              className="h-[560px] lg:h-[calc(100dvh-8rem)] lg:max-h-[720px]"
            />
          </div>
        )}
      </div>

      <CancelModal open={modal === 'cancel'} onClose={() => setModal(null)} ticketId={t.id} onDone={refresh} />
      {modal === 'reschedule' && (
        <RescheduleModal
          ticketId={t.id}
          initial={{ psychologistId: t.psychologist.id, mode: t.mode }}
          onClose={() => setModal(null)}
          onDone={refresh}
        />
      )}
      {modal === 'feedback' && <FeedbackModal ticketId={t.id} onClose={() => setModal(null)} onDone={refresh} />}
    </div>
  );
}

function Section({ n, icon, title, children }: { n: number; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="card card-pad">
      <h2 className="mb-5 flex items-center gap-2.5 text-lg font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-sky-600 text-[13px] font-bold text-white">{n}</span>
        <span className="text-sky-600">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Item({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[22px_130px_1fr] items-start gap-2 sm:grid-cols-[22px_160px_1fr]">
      <span className="mt-0.5 text-ink-faint">{icon}</span>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

/** Teks hasil sesuai outcome yang dipilih psikolog. */
export function ResultBody({ report }: { report: Report | null }) {
  const { data: el } = useQuery({ queryKey: ['booking', 'eligibility'], queryFn: () => api.get<Eligibility>('/booking/eligibility') });
  if (!report) {
    return (
      <div className="flex gap-4 rounded-2xl bg-sun-50/70 p-5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-sky-600"><HeartHandshake size={24} /></span>
        <div>
          <p className="font-semibold">{RESULT_TEXT.pending.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{RESULT_TEXT.pending.body}</p>
        </div>
      </div>
    );
  }
  const text = RESULT_TEXT[report.outcome];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-sky-50/70 p-5">
        <div className="flex gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-mint-50 text-mint-700"><Sprout size={24} /></span>
          <div>
            <p className="font-semibold leading-snug">{text.title}</p>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{text.body}</p>
          </div>
        </div>
        {'next' in text && (
          <div className="ml-16 mt-4 border-t border-sky-200/60 pt-4">
            <p className="font-semibold">{text.nextTitle}</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{text.next}</p>
            {report.outcome === 'lanjutan' && (
              el?.canBook ? (
                <Link to="/buat-janji" className="btn btn-primary mt-3">Pilih Jadwal Sesi Lanjutan</Link>
              ) : el?.activeTicket ? (
                <Link to={`/pendaftaran/${el.activeTicket.id}`} className="btn btn-secondary mt-3">Lihat jadwal sesi lanjutanmu</Link>
              ) : null
            )}
          </div>
        )}
        {report.outcome === 'no_show' && (
          <Link to="/buat-janji" className="btn btn-secondary ml-16 mt-4">Buat janji baru</Link>
        )}
      </div>
      {report.noteForClient && (
        <div className="rounded-2xl border border-line bg-canvas/70 px-5 py-4">
          <p className="font-semibold text-sky-800">{report.outcome === 'referral' ? 'Rekomendasi tindak lanjut dari psikolog' : 'Catatan dari Psikolog untuk Kamu'}</p>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{report.noteForClient}</p>
        </div>
      )}
    </div>
  );
}

function CancelModal({ open, onClose, ticketId, onDone }: { open: boolean; onClose: () => void; ticketId: number; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const invalid = reason.trim().length < 3;
  const m = useMutation({
    mutationFn: () => api.post(`/tickets/${ticketId}/cancel`, { reason }),
    onSuccess: () => {
      toast.success('Sesi dibatalkan. Slot dikembalikan untuk pekerja lain.');
      onClose();
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Batalkan sesi?"
      description="Kamu bisa membuat janji baru kapan saja sesuai ketentuan layanan."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Kembali</button>
          <button
            className="btn btn-danger"
            disabled={m.isPending}
            onClick={() => {
              if (invalid) {
                setTried(true);
                return revealInvalid();
              }
              m.mutate();
            }}
          >
            {m.isPending && <Spinner />} Batalkan sesi
          </button>
        </>
      }
    >
      <Field label="Alasan pembatalan" error={tried && invalid ? 'Tuliskan alasan pembatalan (minimal 3 karakter).' : undefined}>
        {(id) => <textarea id={id} className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Misalnya: ada tugas dinas mendadak" />}
      </Field>
    </Modal>
  );
}

/** Dipakai pekerja dan admin untuk memindahkan jadwal. */
export function RescheduleModal({ ticketId, initial, onClose, onDone, admin }: { ticketId: number; initial: SlotValue; onClose: () => void; onDone: () => void; admin?: boolean }) {
  const qc = useQueryClient();
  const [slot, setSlot] = useState<SlotValue>(initial);
  const [tried, setTried] = useState(false);
  const ready = slot.psychologistId && slot.date && slot.time && slot.mode;
  const m = useMutation({
    mutationFn: () => api.post(`/tickets/${ticketId}/reschedule`, slot),
    onSuccess: () => {
      toast.success(admin ? 'Jadwal diperbarui. Pekerja & psikolog sudah dikabari.' : 'Jadwal berhasil diubah.');
      onClose();
      onDone();
    },
    onError: (e) => {
      toast.error(errMsg(e));
      if (e instanceof ApiError && e.code === 'SLOT_TAKEN') qc.invalidateQueries({ queryKey: ['booking'] });
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="Ubah jadwal"
      description="Pilih tanggal, psikolog, waktu, dan media yang baru. Slot lama otomatis tersedia kembali untuk pekerja lain."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button
            className="btn btn-primary"
            disabled={m.isPending}
            onClick={() => {
              if (!ready) {
                setTried(true);
                toast.error('Lengkapi pilihan jadwal yang ditandai merah.');
                return revealInvalid();
              }
              m.mutate();
            }}
          >
            {m.isPending && <Spinner />} Simpan jadwal baru
          </button>
        </>
      }
    >
      <div className="pb-3">
        <SlotPicker value={slot} onChange={setSlot} ticketId={ticketId} showErrors={tried} />
      </div>
    </Modal>
  );
}

function FeedbackModal({ ticketId, onClose, onDone }: { ticketId: number; onClose: () => void; onDone: () => void }) {
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(FEEDBACK_ITEMS.map(() => null));
  const [helpful, setHelpful] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [sent, setSent] = useState(false);
  const [tried, setTried] = useState(false);
  const PER = 2;
  const pages = Math.ceil(FEEDBACK_ITEMS.length / PER);
  const items = FEEDBACK_ITEMS.slice(page * PER, page * PER + PER);
  const pageDone = items.every((_, k) => answers[page * PER + k] != null);
  // Pertanyaan di halaman ini yang belum dijawab ditandai merah saat pengguna mencoba lanjut.
  const checkPage = () => {
    if (pageDone) return true;
    setTried(true);
    revealInvalid();
    return false;
  };
  const goPage = (n: number) => {
    setTried(false);
    setPage(n);
  };
  const m = useMutation({
    mutationFn: () => api.post(`/tickets/${ticketId}/feedback`, { answers, helpful, suggestion }),
    onSuccess: () => {
      setSent(true);
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (sent) {
    return (
      <Modal open onClose={onClose} title="">
        <div className="pb-6 text-center">
          <span className="tc-pop mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-coral-50 text-coral-500"><HeartHandshake size={32} /></span>
          <p className="mt-4 text-lg font-semibold">Terima kasih sudah berbagi! 💙</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">Feedback kamu sangat berarti dan membantu kami terus memberikan layanan yang lebih baik.</p>
          <button className="btn btn-primary mt-5" onClick={onClose}>Kembali ke Tiket</button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Bagaimana pengalaman konselingmu?"
      description="Jawaban kamu akan membantu kami terus memberikan layanan yang lebih baik."
      footer={
        <>
          <button className="btn btn-secondary" onClick={() => (page ? goPage(page - 1) : onClose())}>{page ? 'Kembali' : 'Nanti saja'}</button>
          {page < pages - 1 ? (
            <button className="btn btn-primary" onClick={() => checkPage() && goPage(page + 1)}>Lanjut <ArrowRight size={16} /></button>
          ) : (
            <button className="btn btn-primary" disabled={m.isPending} onClick={() => checkPage() && m.mutate()}>{m.isPending && <Spinner />} Kirim feedback</button>
          )}
        </>
      }
    >
      <div className="pb-2">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-1.5 flex-1 rounded-full bg-line">
            <div className="h-full rounded-full bg-sky-600 transition-[width]" style={{ width: `${((page + 1) / pages) * 100}%` }} />
          </div>
          <span className="text-[12px] text-ink-faint">{page + 1} dari {pages}</span>
        </div>
        <div className="space-y-6">
          {items.map((item, k) => {
            const idx = page * PER + k;
            const missing = tried && answers[idx] == null;
            return (
              <fieldset key={idx} data-invalid={missing ? '' : undefined}>
                <legend className="text-[14.5px] font-semibold leading-snug">{item.q}</legend>
                {missing && <p className="err mt-1">Pilih salah satu jawaban.</p>}
                <div className={clsx('mt-2.5 grid gap-1.5', missing && 'invalid-group')}>
                  {[...item.options].map((opt, v) => ({ opt, v: v + 1 })).reverse().map(({ opt, v }) => (
                    <label key={v} className={clsx('flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors', answers[idx] === v ? 'border-sky-500 bg-sky-50' : 'border-line hover:border-sky-200')}>
                      <input type="radio" name={`fb-${idx}`} className="h-4 w-4 accent-sky-600" checked={answers[idx] === v} onChange={() => setAnswers((a) => a.map((x, i) => (i === idx ? v : x)))} />
                      {opt}
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
          {page === pages - 1 && (
            <>
              <Field label="Apa yang paling membantu dari sesi ini?" optional hint={`${helpful.length}/500`}>
                {(id) => <textarea id={id} className="input min-h-[80px]" rows={2} maxLength={500} value={helpful} onChange={(e) => setHelpful(e.target.value)} placeholder="Tulis jawaban kamu di sini…" />}
              </Field>
              <Field label="Saran untuk Teman Cerita BRILiaN" optional>
                {(id) => <textarea id={id} className="input min-h-[80px]" rows={2} maxLength={500} value={suggestion} onChange={(e) => setSuggestion(e.target.value)} />}
              </Field>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

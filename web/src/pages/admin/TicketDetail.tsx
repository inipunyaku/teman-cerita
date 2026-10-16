import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertTriangle, ArrowLeft, CalendarCheck2, CalendarClock, CalendarX2, Lock, Phone, Star } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, errMsg } from '@/lib/api';
import { fmtDate, fmtSchedule, fmtSlot, fmtTime, hm, ymd } from '@/lib/format';
import type { Psychologist, Slot, Ticket, TicketDetail } from '@/lib/types';
import { Avatar, Field, MODE_ICON, Modal, ModeTag, SeverityChip, Spinner, StatusChip, TicketCard, UrgencyTag } from '@/components/ui';
import { DetailSkeleton } from '@/components/Skeletons';
import { Timeline } from '@/components/Timeline';
import { MODE_LABEL, REPORT_TOPICS, REQUEST_TOPICS, URGENCY_LABEL, type Mode, type ReportTopic, type RequestTopic } from '@shared/constants';

export default function AdminTicketDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['ticket', Number(id)], queryFn: () => api.get<TicketDetail>(`/tickets/${id}`) });
  const [modal, setModal] = useState<'assign' | 'approve' | 'reject' | 'cancel' | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ticket', Number(id)] });
    qc.invalidateQueries({ queryKey: ['tickets'] });
    qc.invalidateQueries({ queryKey: ['admin-overview'] });
  };

  if (isLoading) return <DetailSkeleton chat={false} />;
  if (error || !data) return <p className="py-10 text-center text-ink-soft">{errMsg(error)}</p>;
  const { ticket: t, events, reschedules, report, review } = data;
  const pendingReschedule = reschedules.find((r) => r.status === 'pending');
  const wa = t.employee.phone?.replace(/^0/, '62').replace(/\D/g, '');

  return (
    <div className="animate-rise">
      <Link to="/admin/tiket" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> Tiket konseling
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <TicketCard code={t.code} className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={t.status} />
            <UrgencyTag urgency={t.urgency} />
            <ModeTag mode={t.mode} />
          </div>
          <p className="mt-2 font-semibold">{REQUEST_TOPICS[t.topic as RequestTopic]}</p>
          <p className="text-[13px] text-ink-faint">Diajukan {fmtDate(t.createdAt, 'd MMM yyyy, HH.mm')} · {URGENCY_LABEL[t.urgency]}</p>
        </TicketCard>
        <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-stretch lg:justify-center">
          {t.status === 'pending' && (
            <button className="btn btn-primary" onClick={() => setModal('assign')}><CalendarCheck2 size={18} /> Jadwalkan</button>
          )}
          {t.status === 'reschedule_requested' && (
            <>
              <button className="btn btn-primary" onClick={() => setModal('approve')}><CalendarCheck2 size={18} /> Setujui & atur jadwal</button>
              <button className="btn btn-secondary" onClick={() => setModal('reject')}>Tolak jadwal ulang</button>
            </>
          )}
          {t.status === 'scheduled' && (
            <button className="btn btn-secondary" onClick={() => setModal('assign')}><CalendarClock size={18} /> Ubah jadwal / psikolog</button>
          )}
          {['pending', 'scheduled', 'reschedule_requested'].includes(t.status) && (
            <button className="btn btn-ghost text-coral-700 hover:bg-coral-50 hover:text-coral-700" onClick={() => setModal('cancel')}><CalendarX2 size={18} /> Batalkan</button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          {pendingReschedule && (
            <div className="rounded-3xl border border-peach-500/25 bg-peach-50/70 p-5">
              <p className="font-semibold text-peach-700">Permintaan jadwal ulang</p>
              <p className="mt-1 text-sm text-ink">“{pendingReschedule.reason}”</p>
              {pendingReschedule.proposedSlots.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">{pendingReschedule.proposedSlots.map((s, i) => <li key={i} className="flex items-center gap-2"><CalendarClock size={14} className="text-peach-500" />{fmtSlot(s)}</li>)}</ul>
              )}
              <p className="mt-3 text-[12.5px] text-ink-faint">Jadwal saat ini: {fmtSchedule(t.scheduledStart, t.scheduledEnd)} bersama {t.psychologist?.name}</p>
            </div>
          )}

          <div className="card card-pad">
            <h2 className="font-semibold">Jadwal</h2>
            {t.psychologist ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <Avatar name={t.psychologist.name} src={t.psychologist.avatarUrl} tone={t.psychologist.avatarTone} size={40} />
                  <div>
                    <p className="text-sm font-semibold">{t.psychologist.name}</p>
                    <p className="text-[12.5px] text-ink-faint">{t.psychologist.title}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold">{fmtSchedule(t.scheduledStart, t.scheduledEnd)}</p>
                  <p className="text-[13px] text-ink-soft">
                    {t.mode === 'offline' ? t.location : t.mode === 'online' ? <a className="link font-normal" href={t.meetingUrl ?? '#'} target="_blank" rel="noreferrer">{t.meetingUrl}</a> : 'Lewat chat aplikasi'}
                  </p>
                </div>
                {t.adminNote && <p className="text-[13px] text-ink-soft sm:col-span-2">Catatan: {t.adminNote}</p>}
              </div>
            ) : (
              <>
                <p className="mt-1 text-sm text-ink-soft">
                  Belum dijadwalkan. Karyawan memilih <b className="font-semibold text-ink">{MODE_LABEL[t.preferredMode].toLowerCase()}</b>; tentukan psikolog, jam, dan tempatnya.
                </p>
                {t.preferredSlots.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {t.preferredSlots.map((s, i) => <li key={i} className="chip h-8 bg-sky-50 px-3 text-sky-800">{fmtSlot(s)}</li>)}
                  </ul>
                )}
              </>
            )}
            {t.status === 'cancelled' && <p className="mt-4 rounded-2xl bg-coral-50 px-4 py-3 text-sm text-coral-700">Dibatalkan: {t.cancelReason}</p>}
          </div>

          {t.story && (
            <div className="card card-pad">
              <p className="eyebrow">Cerita singkat dari karyawan</p>
              <p className="mt-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-soft">{t.story}</p>
            </div>
          )}

          {report && (
            <div className="card card-pad">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Hasil sesi</h2>
                <span className="inline-flex items-center gap-1 text-[12px] text-ink-faint"><Lock size={12} /> Ringkasan klinis hanya untuk psikolog</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {report.severity && <SeverityChip severity={report.severity} />}
                {report.topics?.map((tp) => <span key={tp} className="chip bg-canvas text-ink-soft ring-1 ring-line">{REPORT_TOPICS[tp as ReportTopic]}</span>)}
                {report.followUp && <span className="chip bg-sky-100 text-sky-700">Perlu sesi lanjutan</span>}
              </div>
              {report.severity === 'kritis' && (
                <p className="mt-4 flex gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> Keparahan kritis — koordinasikan dengan {t.psychologist?.name} dan jalankan SOP eskalasi.
                </p>
              )}
              {review && (
                <div className="mt-4 flex items-start gap-3 border-t border-line pt-4">
                  <div className="flex shrink-0 gap-0.5 pt-0.5">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={15} className={n <= review.rating ? 'fill-sun-500 text-sun-500' : 'text-line'} />)}</div>
                  <p className="text-sm text-ink-soft">{review.comment ?? 'Tanpa komentar.'}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card card-pad">
            <p className="eyebrow mb-3">Karyawan</p>
            <div className="flex items-center gap-3">
              <Avatar name={t.employee.name} src={t.employee.avatarUrl} tone={t.employee.avatarTone} size={44} />
              <div className="min-w-0">
                <p className="font-semibold">{t.employee.name}</p>
                <p className="text-[13px] text-ink-soft">PN {t.employee.pn}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-ink-faint">Unit kerja</dt><dd className="text-right font-medium">{t.employee.unitName}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-faint">WhatsApp</dt><dd className="font-medium">{t.employee.phone}</dd></div>
            </dl>
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="btn btn-soft btn-sm mt-4 w-full"><Phone size={15} /> Hubungi via WhatsApp</a>}
          </div>
          <div className="card card-pad">
            <h2 className="mb-4 font-semibold">Linimasa</h2>
            <Timeline events={events} />
          </div>
        </div>
      </div>

      {(modal === 'assign' || modal === 'approve') && (
        <ScheduleModal ticket={t} approve={modal === 'approve'} suggestions={modal === 'approve' ? (pendingReschedule?.proposedSlots ?? []) : t.preferredSlots} onClose={() => setModal(null)} onDone={refresh} />
      )}
      <RejectModal open={modal === 'reject'} onClose={() => setModal(null)} ticketId={t.id} onDone={refresh} />
      <CancelModal open={modal === 'cancel'} onClose={() => setModal(null)} ticketId={t.id} onDone={refresh} />
    </div>
  );
}

// ---------------------------------------------------------------------------

interface Conflict { id: number; code: string; scheduled_start: string; scheduled_end: string; employee_name: string }

function ScheduleModal({ ticket: t, approve, suggestions, onClose, onDone }: { ticket: Ticket; approve: boolean; suggestions: Slot[]; onClose: () => void; onDone: () => void }) {
  const { data: psychs } = useQuery({ queryKey: ['psychologists'], queryFn: () => api.get<{ psychologists: Psychologist[] }>('/admin/psychologists') });
  const initial = (() => {
    if (t.scheduledStart && !approve) {
      const s = new Date(t.scheduledStart);
      const e = new Date(t.scheduledEnd!);
      return { date: ymd(s), from: hm(s), to: hm(e) };
    }
    const s = suggestions[0];
    if (s) return { date: s.date, from: s.from, to: addHour(s.from) };
    // Default: hari kerja berikutnya, jam 09.00.
    const d = new Date(Date.now() + 864e5);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return { date: ymd(d), from: '09:00', to: '10:00' };
  })();
  const [psychologistId, setPid] = useState<number>(t.psychologist?.id ?? 0);
  const [mode, setMode] = useState<Mode>(t.mode);
  const [date, setDate] = useState(initial.date);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [location, setLocation] = useState(t.location ?? '');
  const [meetingUrl, setMeetingUrl] = useState(t.meetingUrl ?? '');
  const [note, setNote] = useState(approve ? '' : (t.adminNote ?? ''));
  const [fieldErr, setFieldErr] = useState<Record<string, string[] | undefined>>({});

  const active = psychs?.psychologists.filter((p) => p.status === 'verified') ?? [];
  useEffect(() => {
    if (!psychologistId && active.length) setPid([...active].sort((a, b) => a.active - b.active)[0].id);
  }, [active.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useMemo(() => (date && from ? new Date(`${date}T${from}`) : null), [date, from]);
  const end = useMemo(() => (date && to ? new Date(`${date}T${to}`) : null), [date, to]);
  const validTime = start && end && end > start;

  const dayStart = date ? new Date(`${date}T00:00`) : null;
  const { data: agenda } = useQuery({
    queryKey: ['agenda', psychologistId, date],
    enabled: !!psychologistId && !!dayStart,
    queryFn: () =>
      api.get<{ sessions: { id: number; code: string; start: string; end: string; mode: Mode }[] }>(
        `/admin/agenda?psychologistId=${psychologistId}&from=${dayStart!.toISOString()}&to=${new Date(dayStart!.getTime() + 864e5).toISOString()}`,
      ),
  });
  const conflicts = (agenda?.sessions ?? []).filter((s) => s.id !== t.id && start && end && new Date(s.start) < end && new Date(s.end) > start);

  const submit = useMutation({
    mutationFn: (force: boolean) =>
      api.post(approve ? `/tickets/${t.id}/reschedule/decide` : `/tickets/${t.id}/assign`, {
        approve: approve || undefined,
        psychologistId,
        mode,
        start: start!.toISOString(),
        end: end!.toISOString(),
        location,
        meetingUrl,
        note,
        force,
      }),
    onSuccess: () => {
      toast.success(approve ? 'Jadwal ulang disetujui. Karyawan & psikolog sudah dikabari.' : 'Tiket dijadwalkan. Karyawan & psikolog sudah dikabari.');
      onClose();
      onDone();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'CONFLICT') {
        const list = (e.data.conflicts as Conflict[]).map((c) => `${c.code} (${fmtTime(c.scheduled_start)})`).join(', ');
        if (window.confirm(`Psikolog sudah punya sesi di waktu itu: ${list}. Tetap jadwalkan?`)) submit.mutate(true);
        return;
      }
      setFieldErr(e instanceof ApiError ? ((e.data.fields as typeof fieldErr) ?? {}) : {});
      toast.error(errMsg(e));
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={approve ? 'Setujui jadwal ulang' : t.status === 'scheduled' ? 'Ubah jadwal' : `Jadwalkan ${t.code}`}
      description={`${t.employee.name} · ${t.employee.unitName ?? '-'} · prefer ${MODE_LABEL[t.preferredMode].toLowerCase()}`}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={!psychologistId || !validTime || submit.isPending} onClick={() => submit.mutate(false)}>
            {submit.isPending && <Spinner />} {approve ? 'Setujui & kirim jadwal' : 'Simpan jadwal'}
          </button>
        </>
      }
    >
      <div className="space-y-5 pb-2">
        <div>
          <p className="label">Psikolog</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {active.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPid(p.id)}
                aria-pressed={psychologistId === p.id}
                className={clsx('flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors', psychologistId === p.id ? 'border-sky-500 bg-sky-50' : 'border-line hover:border-sky-200')}
              >
                <Avatar name={p.name} src={p.avatarUrl} tone={p.avatarTone} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="block text-[12px] text-ink-faint">{p.active} sesi aktif · {p.this_week} minggu ini</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="label">Metode</p>
          <div className="grid grid-cols-3 gap-2">
            {(['chat', 'online', 'offline'] as Mode[]).map((m) => {
              const Icon = MODE_ICON[m];
              return (
                <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={clsx('flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors', mode === m ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-line text-ink-soft hover:border-sky-200')}>
                  <Icon size={17} strokeWidth={1.75} /> <span className="hidden sm:inline">{MODE_LABEL[m]}</span><span className="sm:hidden">{m === 'offline' ? 'Tatap' : MODE_LABEL[m].split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="label">Waktu</p>
          {suggestions.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              <span className="self-center text-[12px] text-ink-faint">{approve ? 'Usulan karyawan:' : 'Pilihan karyawan:'}</span>
              {suggestions.map((s, i) => (
                <button key={i} type="button" className="chip h-7 border border-sky-200 bg-white text-sky-800 hover:bg-sky-50" onClick={() => { setDate(s.date); setFrom(s.from); setTo(addHour(s.from)); }}>
                  {fmtSlot(s)}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <input type="date" className="input" value={date} min={ymd(new Date())} onChange={(e) => setDate(e.target.value)} aria-label="Tanggal" />
            <input type="time" className="input w-[108px]" value={from} onChange={(e) => { setFrom(e.target.value); setTo(addHour(e.target.value)); }} aria-label="Jam mulai" />
            <input type="time" className="input w-[108px]" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Jam selesai" />
          </div>
          {!validTime && <p className="err">Jam selesai harus setelah jam mulai.</p>}
          {psychologistId > 0 && agenda && (
            <div className={clsx('mt-2.5 rounded-2xl px-3.5 py-2.5 text-[13px]', conflicts.length ? 'bg-coral-50 text-coral-700' : 'bg-canvas text-ink-soft')}>
              {conflicts.length ? (
                <span className="flex gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> Bentrok dengan {conflicts.map((c) => `${c.code} (${fmtTime(c.start)}–${fmtTime(c.end)})`).join(', ')}</span>
              ) : agenda.sessions.filter((s) => s.id !== t.id).length ? (
                <>Agenda psikolog hari itu: {agenda.sessions.filter((s) => s.id !== t.id).map((s) => `${fmtTime(s.start)}–${fmtTime(s.end)}`).join(' · ')}</>
              ) : (
                'Psikolog belum punya sesi lain di hari itu.'
              )}
            </div>
          )}
        </div>

        {mode === 'offline' && (
          <Field label="Lokasi / ruangan" error={fieldErr.location?.[0]}>
            {(id) => <input id={id} className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ruang Konseling Lt. 3, Gedung Pusat" />}
          </Field>
        )}
        {mode === 'online' && (
          <Field label="Tautan meeting" error={fieldErr.meetingUrl?.[0]}>
            {(id) => <input id={id} className="input" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/…" inputMode="url" />}
          </Field>
        )}
        <Field label="Catatan untuk karyawan" optional>
          {(id) => <textarea id={id} className="input min-h-[80px]" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misalnya: mohon hadir 5 menit lebih awal" />}
        </Field>
      </div>
    </Modal>
  );
}

function addHour(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function RejectModal({ open, onClose, ticketId, onDone }: { open: boolean; onClose: () => void; ticketId: number; onDone: () => void }) {
  const [note, setNote] = useState('');
  const m = useMutation({
    mutationFn: () => api.post(`/tickets/${ticketId}/reschedule/decide`, { approve: false, note }),
    onSuccess: () => { toast.success('Permintaan jadwal ulang ditolak. Jadwal lama tetap berlaku.'); onClose(); onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="Tolak jadwal ulang" description="Jadwal lama tetap berlaku. Karyawan akan menerima catatanmu."
      footer={<><button className="btn btn-secondary" onClick={onClose}>Batal</button><button className="btn btn-danger" disabled={note.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>{m.isPending && <Spinner />} Tolak</button></>}>
      <Field label="Alasan">{(id) => <textarea id={id} className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misalnya: psikolog tidak tersedia di waktu usulan; silakan hubungi admin" />}</Field>
    </Modal>
  );
}

function CancelModal({ open, onClose, ticketId, onDone }: { open: boolean; onClose: () => void; ticketId: number; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => api.post(`/tickets/${ticketId}/cancel`, { reason }),
    onSuccess: () => { toast.success('Tiket dibatalkan.'); onClose(); onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="Batalkan tiket?" description="Karyawan dan psikolog (bila ada) akan diberi tahu."
      footer={<><button className="btn btn-secondary" onClick={onClose}>Kembali</button><button className="btn btn-danger" disabled={reason.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>{m.isPending && <Spinner />} Batalkan tiket</button></>}>
      <Field label="Alasan">{(id) => <textarea id={id} className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
    </Modal>
  );
}

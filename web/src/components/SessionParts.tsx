import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronDown, ExternalLink, MapPin, Pencil, Phone, Video } from 'lucide-react';
import { toast } from 'sonner';
import { api, errMsg } from '@/lib/api';
import { ageOf, fmtDate, fmtTime } from '@/lib/format';
import type { Feedback, HistoryItem, Ticket } from '@/lib/types';
import { Field, ModeTag, Modal, OutcomeChip, ScreeningChip, Spinner, StatusChip } from './ui';
import { CASE_CATEGORIES, CLIENT_TOPICS, GENDER_LABEL, LIKERT, SATISFACTION_LABEL, SCREENING_ITEMS, type CaseCategory, type ClientTopic, type Gender, type SatisfactionLevel } from '@shared/constants';

/** Jadwal, media, lokasi/tautan, dan kontak WhatsApp — untuk psikolog & admin. */
export function ScheduleCard({ t, onChanged }: { t: Ticket; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const wa = t.employee.phone?.replace(/^0/, '62').replace(/\D/g, '');
  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={t.status} />
        <ModeTag mode={t.mode} />
        {t.rescheduleCount > 0 && <span className="chip bg-canvas text-ink-soft ring-1 ring-line">Diubah {t.rescheduleCount}x</span>}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="eyebrow">Jadwal</p>
          <p className="mt-1 font-semibold">{fmtDate(t.scheduledStart, 'EEEE, d MMMM yyyy')}</p>
          <p className="text-[13.5px] text-ink-soft">{fmtTime(t.scheduledStart)} – {fmtTime(t.scheduledEnd)} WIB</p>
        </div>
        <div>
          <p className="eyebrow">{t.mode === 'offline' ? 'Lokasi' : t.mode === 'online' ? 'Microsoft Teams' : 'Tempat'}</p>
          {t.mode === 'offline' && <p className="mt-1 flex gap-1.5 font-semibold"><MapPin size={16} className="mt-0.5 shrink-0 text-sky-600" />{t.location}</p>}
          {t.mode === 'online' && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {t.meetingUrl ? (
                <a href={t.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-sky-700 hover:underline"><Video size={16} /> Buka meeting <ExternalLink size={13} /></a>
              ) : (
                <span className="text-sm font-semibold text-coral-700">Tautan belum diisi</span>
              )}
              {['scheduled', 'in_progress'].includes(t.status) && (
                <button className="btn btn-ghost btn-sm h-8" onClick={() => setEditing(true)}><Pencil size={14} /> {t.meetingUrl ? 'Ubah' : 'Isi tautan'}</button>
              )}
            </div>
          )}
          {t.mode === 'chat' && <p className="mt-1 font-semibold">Ruang chat aplikasi</p>}
          {t.room && t.mode !== 'offline' && <p className="text-[12.5px] text-ink-faint">Ruang psikolog: {t.room}</p>}
        </div>
      </div>
      {wa && (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="btn btn-soft btn-sm mt-4">
          <Phone size={15} /> WhatsApp {t.employee.phone}
        </a>
      )}
      {t.status === 'cancelled' && <p className="mt-4 rounded-2xl bg-coral-50 px-4 py-3 text-sm text-coral-700">Dibatalkan: {t.cancelReason}</p>}
      {editing && <MeetingModal ticketId={t.id} initial={t.meetingUrl ?? ''} onClose={() => setEditing(false)} onDone={onChanged} />}
    </div>
  );
}

function MeetingModal({ ticketId, initial, onClose, onDone }: { ticketId: number; initial: string; onClose: () => void; onDone: () => void }) {
  const [url, setUrl] = useState(initial);
  const m = useMutation({
    mutationFn: () => api.patch(`/tickets/${ticketId}/meeting`, { meetingUrl: url }),
    onSuccess: () => {
      toast.success('Tautan tersimpan. Pekerja sudah dikabari.');
      onClose();
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Tautan Microsoft Teams"
      description="Tautan ini tampil di halaman pendaftaran pekerja."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending && <Spinner />} Simpan</button>
        </>
      }
    >
      <Field label="Tautan meeting" hint="Tip: isi tautan Teams pribadimu di halaman Profil agar terisi otomatis untuk sesi berikutnya.">
        {(id) => <input id={id} className="input" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://teams.microsoft.com/l/meetup-join/…" />}
      </Field>
    </Modal>
  );
}

/** Ringkasan data diri klien dari master data. */
export function ClientFacts({ t }: { t: Ticket }) {
  const age = ageOf(t.employee.birthDate);
  const facts: [string, string | null | undefined][] = [
    ['Nama lengkap', t.employee.name],
    ['PN', t.employee.pn],
    ['Unit kerja', t.employee.unitName],
    ['Band', t.employee.band],
    ['Region', t.employee.region],
    ['Jenis kelamin', t.employee.gender ? GENDER_LABEL[t.employee.gender as Gender] : null],
    ['Usia', age != null ? `${age} tahun` : null],
  ];
  return (
    <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
      {facts.map(([k, v]) => (
        <div key={k}>
          <dt className="text-ink-faint">{k}</dt>
          <dd className="font-semibold">{v || '-'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Hasil skrining EANSCALE: kategori, skor, dan rincian jawaban. */
export function ScreeningDetail({ t }: { t: Ticket }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {t.screeningLevel && <ScreeningChip level={t.screeningLevel} />}
        <span className="text-sm text-ink-soft">Skor <b className="text-ink">{t.screeningScore}</b> dari 64</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-canvas">
        <div className="h-full rounded-full bg-gradient-to-r from-mint-500 via-sun-500 to-coral-500" style={{ width: `${(((t.screeningScore ?? 16) - 16) / 48) * 100}%` }} />
      </div>
      {t.screening && (
        <>
          <button className="btn btn-ghost btn-sm mt-3 -ml-2" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <ChevronDown size={15} className={clsx('transition-transform', open && 'rotate-180')} /> {open ? 'Sembunyikan' : 'Lihat'} jawaban
          </button>
          {open && (
            <ol className="mt-2 divide-y divide-line rounded-2xl border border-line text-[13.5px]">
              {SCREENING_ITEMS.map((item, i) => {
                const v = t.screening![i];
                const distress = item.favorable ? 5 - v : v;
                return (
                  <li key={i} className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <span className="text-ink-soft"><span className="text-ink-faint">{i + 1}.</span> {item.text}</span>
                    <span className={clsx('shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold', distress >= 3 ? 'bg-coral-50 text-coral-700' : 'bg-canvas text-ink-soft')}>{LIKERT[v - 1]}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

export function FeedbackSummary({ feedback }: { feedback: Feedback }) {
  return (
    <div className="rounded-2xl bg-sun-50/60 px-4 py-3">
      <p className="text-sm">
        <b>Feedback klien:</b> skor {feedback.score}/32 · {SATISFACTION_LABEL[feedback.level as SatisfactionLevel] ?? feedback.level}
      </p>
      {feedback.helpful && <p className="mt-1 text-[13px] text-ink-soft">“{feedback.helpful}”</p>}
      {feedback.suggestion && <p className="mt-1 text-[13px] text-ink-soft">Saran: {feedback.suggestion}</p>}
    </div>
  );
}

export function HistoryList({ items, linkBase, limited, emptyText }: { items: HistoryItem[]; linkBase?: string; limited?: boolean; emptyText?: string }) {
  if (!items.length) return <p className="text-sm text-ink-faint">{emptyText ?? 'Ini sesi pertama klien di Teman Cerita.'}</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((h) => {
        const body = (
          <>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{fmtDate(h.scheduledStart, 'd MMM yyyy')} <span className="font-normal text-ink-faint">· {h.code}</span></p>
              <p className="truncate text-[12.5px] text-ink-soft">{h.psychologistName}</p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1">
              {h.screeningLevel && <ScreeningChip level={h.screeningLevel} score={h.screeningScore} />}
              {h.outcome ? <OutcomeChip outcome={h.outcome} /> : <StatusChip status={h.status} />}
            </div>
          </>
        );
        return (
          <li key={h.id}>
            {linkBase ? (
              <Link to={`${linkBase}/${h.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-sky-700">{body}</Link>
            ) : h.screeningLevel || h.report ? (
              <HistoryDetail h={h} limited={limited}>{body}</HistoryDetail>
            ) : (
              <div className="flex items-center justify-between gap-3 py-2.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Untuk psikolog: buka sesi sebelumnya (oleh psikolog mana pun) untuk melihat skrining & catatan hasilnya.
 * `limited`: peserta yang belum pernah sesi dengan psikolog ini — hanya skrining & catatan untuk klien.
 */
function HistoryDetail({ h, limited, children }: { h: HistoryItem; limited?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const r = h.report;
  const notes = r
    ? ([
        ['Tujuan konseling', r.goal],
        ['Riwayat kesehatan', r.healthHistory],
        ['Gejala', r.symptoms],
        ['Ringkasan sesi', r.summary],
        ['Catatan untuk klien', r.noteForClient],
      ] as [string, string | null][]).filter(([, v]) => v)
    : [];
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:text-sky-700">
        {children}
        <ChevronDown size={16} className={clsx('shrink-0 text-ink-faint transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mb-3 space-y-3 rounded-2xl bg-canvas px-4 py-3 text-[13.5px]">
          {h.topic && (
            <p className="text-[12.5px] text-ink-faint">
              {CLIENT_TOPICS[h.topic as ClientTopic] ?? h.topic}
              {r?.category && ` · ${CASE_CATEGORIES[r.category as CaseCategory]?.label ?? r.category}`}
            </p>
          )}
          {h.screening && h.screening.length === SCREENING_ITEMS.length && (
            <div>
              <p className="eyebrow">Skrining EANSCALE · skor {h.screeningScore}</p>
              <ol className="mt-1.5 grid gap-1 sm:grid-cols-2">
                {SCREENING_ITEMS.map((item, i) => {
                  const v = h.screening![i];
                  const distress = item.favorable ? 5 - v : v;
                  return (
                    <li key={i} className="flex items-start justify-between gap-2 text-[12.5px]">
                      <span className="text-ink-soft"><span className="text-ink-faint">{i + 1}.</span> {item.text}</span>
                      <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold', distress >= 3 ? 'bg-coral-50 text-coral-700' : 'bg-white text-ink-soft')}>{LIKERT[v - 1]}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
          {notes.length > 0 ? (
            <dl className="space-y-2.5">
              {notes.map(([k, v]) => (
                <div key={k}>
                  <dt className="eyebrow">{k}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap leading-relaxed text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-ink-faint">
              {limited ? 'Belum ada catatan untuk klien.' : r ? 'Tidak ada catatan klinis (mis. klien tidak hadir).' : 'Hasil sesi belum diisi psikolog.'}
            </p>
          )}
          {h.own && (
            <Link to={`/psikolog/sesi/${h.id}`} className="link inline-block text-[13px]">Buka sesi ini</Link>
          )}
        </div>
      )}
    </div>
  );
}

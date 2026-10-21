import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  HeartHandshake,
  Info,
  Lock,
  MonitorSmartphone,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { revealInvalid } from '@/lib/validation';
import { addMinutes, fmtDate, fmtTime, fmtYmd, fullPsychName, hmDot } from '@/lib/format';
import type { Eligibility, Ticket } from '@/lib/types';
import { Avatar, Field, LogoMark, MODE_ICON, Sk, Spinner } from '@/components/ui';
import { SlotPicker, usePsychologists, type SlotValue } from '@/components/SlotPicker';
import {
  CLIENT_TOPICS,
  COMPLAINT_MIN,
  CONSENT_INTRO,
  CONSENT_SECTIONS,
  CONSENT_STATEMENT,
  IMPACT_LABEL,
  LIKERT,
  MODE_LABEL,
  ROOM_PREFIX,
  SCREENING_ITEMS,
  type ClientTopic,
} from '@shared/constants';

const STEPS = ['Informasi & Consent', 'Data Diri', 'Skrining EANSCALE', 'Ceritakan Kebutuhanmu', 'Pilih Jadwal', 'Konfirmasi'];

interface Draft {
  step: number;
  nickname: string;
  screening: (number | null)[];
  topic: ClientTopic | '';
  complaint: string;
  impact: number;
  expectation: string;
  slot: SlotValue;
}

const blankDraft = (nickname: string): Draft => ({
  step: 0,
  nickname,
  screening: SCREENING_ITEMS.map(() => null),
  topic: '',
  complaint: '',
  impact: 0,
  expectation: '',
  slot: {},
});

/** Draf disimpan di sessionStorage supaya jawaban tidak hilang saat halaman dimuat ulang. */
function useDraft(userId: number, nickname: string) {
  const key = `tc-booking-${userId}`;
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) return { ...blankDraft(nickname), ...JSON.parse(raw) };
    } catch {
      /* abaikan */
    }
    return blankDraft(nickname);
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(draft));
    } catch {
      /* abaikan */
    }
  }, [key, draft]);
  const clear = () => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* abaikan */
    }
  };
  return [draft, setDraft, clear] as const;
}

export default function Booking() {
  const { user } = useAuth();
  const u = user!;
  const qc = useQueryClient();
  const [draft, setDraft, clearDraft] = useDraft(u.id, u.nickname ?? u.name.split(' ')[0]);
  const [declined, setDeclined] = useState(false);
  const [done, setDone] = useState<Ticket | null>(null);
  // Langkah yang sudah dicoba dilanjutkan tapi belum lengkap → isian yang kurang ditandai merah.
  const [attempted, setAttempted] = useState<Record<number, boolean>>({});
  const topRef = useRef<HTMLDivElement>(null);
  const { data: el, isLoading } = useQuery({ queryKey: ['booking', 'eligibility'], queryFn: () => api.get<Eligibility>('/booking/eligibility') });
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const go = (step: number) => {
    set({ step });
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const submit = useMutation({
    mutationFn: () =>
      api.post<{ ticket: Ticket }>('/tickets', {
        consent: true,
        nickname: draft.nickname,
        screening: draft.screening,
        topic: draft.topic,
        complaint: draft.complaint,
        impact: draft.impact,
        expectation: draft.expectation,
        ...draft.slot,
      }),
    onSuccess: ({ ticket }) => {
      clearDraft();
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['booking'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      setDone(ticket);
      window.scrollTo({ top: 0 });
    },
    onError: (e) => {
      toast.error(errMsg(e));
      if (e instanceof ApiError && (e.code === 'SLOT_TAKEN' || e.code === 'GAP')) {
        qc.invalidateQueries({ queryKey: ['booking'] });
        set({ slot: { date: draft.slot.date } });
        go(4);
      }
    },
  });

  if (done) return <Success ticket={done} />;
  if (isLoading || !el) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" role="status" aria-label="Memuat">
        <Sk className="h-10 w-full rounded-2xl" />
        <Sk className="h-[420px] w-full rounded-3xl" />
      </div>
    );
  }
  if (!el.canBook) return <NotEligible el={el} />;
  if (declined) return <Declined onBack={() => setDeclined(false)} />;

  const answered = draft.screening.filter((x) => x != null).length;
  const valid = [
    true,
    draft.nickname.trim().length > 0,
    answered === SCREENING_ITEMS.length,
    !!draft.topic && draft.complaint.trim().length >= COMPLAINT_MIN && draft.impact > 0 && draft.expectation.trim().length >= 3,
    !!(draft.slot.psychologistId && draft.slot.date && draft.slot.time && draft.slot.mode),
    true,
  ];
  const showErrors = !!attempted[draft.step];
  const next = () => {
    if (!valid[draft.step]) {
      setAttempted((a) => ({ ...a, [draft.step]: true }));
      revealInvalid();
      return toast.error(
        draft.step === 2
          ? `Masih ada ${SCREENING_ITEMS.length - answered} pernyataan yang belum dijawab.`
          : draft.step === 4
            ? 'Lengkapi pilihan jadwal yang ditandai merah.'
            : 'Lengkapi isian yang ditandai merah ya.',
      );
    }
    go(draft.step + 1);
  };

  const wide = draft.step === 4;
  return (
    <div ref={topRef} className={clsx('mx-auto animate-rise scroll-mt-24', wide ? 'max-w-6xl' : 'max-w-3xl')}>
      <Stepper step={draft.step} />

      {draft.step === 0 && <ConsentStep onAgree={() => go(1)} onDecline={() => setDeclined(true)} />}
      {draft.step === 1 && (
        <StepCard title="Data Diri" description="Yuk, kenalan terlebih dahulu.">
          <Field
            label="Nama panggilan"
            hint="Nama panggilan akan digunakan selama proses konseling."
            error={showErrors && !draft.nickname.trim() ? 'Isi nama panggilanmu dulu ya.' : undefined}
          >
            {(id) => <input id={id} className="input" maxLength={40} value={draft.nickname} onChange={(e) => set({ nickname: e.target.value })} placeholder="Contoh: Natty" autoFocus />}
          </Field>
          <div className="mt-6 rounded-2xl bg-canvas p-4">
            <p className="eyebrow mb-3">Dari master data pekerja</p>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-ink-faint">Nama</dt><dd className="font-semibold">{u.name}</dd></div>
              <div><dt className="text-ink-faint">PN</dt><dd className="font-semibold tabular-nums">{u.pn}</dd></div>
              <div><dt className="text-ink-faint">Unit kerja</dt><dd className="font-semibold">{u.unitName ?? '-'}</dd></div>
            </dl>
          </div>
        </StepCard>
      )}
      {draft.step === 2 && <ScreeningStep answers={draft.screening} onChange={(screening) => set({ screening })} showErrors={showErrors} />}
      {draft.step === 3 && <NeedsStep draft={draft} set={set} showErrors={showErrors} />}
      {draft.step === 4 && (
        <div>
          <div className="mb-5">
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]">Buat Janji Sesi Konseling</h1>
            <p className="mt-1.5 text-ink-soft">Pilih tanggal untuk melihat psikolog dan jadwal yang tersedia. Hanya slot yang masih tersedia yang akan ditampilkan.</p>
          </div>
          <SlotPicker value={draft.slot} onChange={(slot) => set({ slot })} showErrors={showErrors} />
        </div>
      )}
      {draft.step === 5 && <ConfirmStep draft={draft} onEdit={go} />}

      {draft.step > 0 && (
        <div className="kb-hide sticky bottom-20 z-10 mt-6 flex justify-end gap-2 sm:bottom-4">
          <button type="button" className="btn btn-secondary h-12 flex-1 bg-white px-6 shadow-soft sm:w-40 sm:flex-none" onClick={() => go(draft.step - 1)}>
            <ArrowLeft size={17} /> Kembali
          </button>
          {draft.step < 5 ? (
            <button type="button" className="btn btn-primary h-12 flex-1 px-6 shadow-pop sm:w-48 sm:flex-none" onClick={next}>
              Lanjutkan <ArrowRight size={17} />
            </button>
          ) : (
            <button type="button" className="btn btn-primary h-12 flex-1 px-6 shadow-pop sm:flex-none" disabled={submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending ? <Spinner /> : <Check size={17} />} Kirim pendaftaran
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Stepper({ step }: { step: number }) {
  return (
    <nav className="mb-6" aria-label="Langkah pendaftaran">
      <ol className="hidden items-center gap-2 md:flex">
        {STEPS.map((label, i) => (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={clsx(
                'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold',
                i < step ? 'bg-mint-500 text-white' : i === step ? 'bg-sky-600 text-white' : 'bg-line text-ink-faint',
              )}
            >
              {i < step ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className={clsx('truncate text-[12.5px]', i === step ? 'font-semibold text-sky-800' : 'text-ink-faint')}>{label}</span>
            {i < STEPS.length - 1 && <span className={clsx('h-px min-w-3 flex-1', i < step ? 'bg-mint-500' : 'bg-line')} />}
          </li>
        ))}
      </ol>
      <div className="md:hidden">
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="font-semibold text-sky-800">{STEPS[step]}</span>
          <span className="text-ink-faint">Langkah {step + 1} dari {STEPS.length}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-line">
          <div className="h-full rounded-full bg-sky-600 transition-[width]" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>
    </nav>
  );
}

function StepCard({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="card card-pad sm:p-8">
      <h1 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]">{title}</h1>
      {description && <p className="mt-1.5 text-ink-soft">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function ConsentStep({ onAgree, onDecline }: { onAgree: () => void; onDecline: () => void }) {
  const [read, setRead] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 8) setRead(true);
  }, []);
  return (
    <section className="card overflow-hidden">
      <div className="grain relative bg-gradient-to-br from-sky-100 via-sky-50 to-haze px-5 py-7 sm:px-8">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-9" />
          <span className="text-[15px] font-semibold text-sky-900">Teman Cerita BRILiaN</span>
        </div>
        <h1 className="mt-5 text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">
          Selamat datang di <span className="display italic text-sky-700">Teman Cerita BRILiaN</span>
        </h1>
        <p className="mt-2 max-w-xl text-ink-soft">Layanan konseling dari BRI untuk mendukung kesehatan mental dan kesejahteraan Insan BRILiaN.</p>
        <ul className="mt-5 grid gap-2.5 text-[14px] sm:grid-cols-2">
          {(
            [
              [UserRound, '1-on-1 bersama psikolog profesional'],
              [Lock, 'Aman, nyaman, dan rahasia'],
              [MonitorSmartphone, 'Tatap muka, chat, atau video/voice call'],
              [HeartHandshake, 'Untuk kehidupan kerja maupun pribadi'],
            ] as [typeof Users, string][]
          ).map(([Icon, t]) => (
            <li key={t} className="flex items-center gap-2.5 text-ink">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/80 text-sky-700"><Icon size={16} /></span>
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="px-5 py-6 sm:px-8">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-sky-600" /> Informasi dan Persetujuan (Informed Consent)</h2>
        <div
          ref={boxRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setRead(true);
          }}
          className="scrollbar-thin mt-3 max-h-[340px] overflow-y-auto rounded-2xl border border-line bg-canvas/60 px-4 py-4 text-[14px] leading-relaxed text-ink-soft sm:px-5"
          tabIndex={0}
          aria-label="Isi informed consent"
        >
          <p>{CONSENT_INTRO}</p>
          <ol className="mt-4 space-y-3.5">
            {CONSENT_SECTIONS.map((sec, i) => (
              <li key={sec.title}>
                <p className="font-semibold text-ink">{i + 1}. {sec.title}</p>
                <p className="mt-1">{sec.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 whitespace-pre-line border-t border-line pt-4 text-ink">{CONSENT_STATEMENT}</p>
        </div>
        {!read && <p className="mt-2 text-[12.5px] text-ink-faint">Gulir sampai akhir untuk membaca seluruh informasi.</p>}
        <p className="mt-5 text-sm font-semibold">Apakah kamu bersedia mengikuti pelaksanaan serta rangkaian proses layanan konseling ini?</p>
        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-secondary h-12 px-6" onClick={onDecline}>Tidak bersedia</button>
          <button type="button" className="btn btn-primary h-12 px-6" disabled={!read} onClick={onAgree}>
            <Check size={17} /> Saya bersedia
          </button>
        </div>
      </div>
    </section>
  );
}

function ScreeningStep({ answers, onChange, showErrors }: { answers: (number | null)[]; onChange: (a: (number | null)[]) => void; showErrors: boolean }) {
  const missing = (i: number) => showErrors && answers[i] == null;
  const setAt = (i: number, v: number) => onChange(answers.map((x, k) => (k === i ? v : x)));
  const answered = answers.filter((x) => x != null).length;
  return (
    <StepCard
      title="Yuk, kenali kondisimu terlebih dahulu."
      description="Beberapa pertanyaan berikut membantu psikolog memahami kondisi yang sedang kamu alami. Kepada kamu akan diberikan serangkaian pernyataan, dan tugasmu adalah untuk memberikan pernyataan sesuai dengan keadaan yang paling sesuai dengan diri kamu, ya :)"
    >
      <p className="mb-4 flex gap-2 rounded-2xl bg-sky-50 px-4 py-3 text-[13px] text-sky-800">
        <Info size={16} className="mt-0.5 shrink-0" /> Jawaban kamu bersifat rahasia dan hanya digunakan untuk keperluan layanan konseling.
      </p>
      {/* Desktop: tabel */}
      <div className="hidden overflow-hidden rounded-2xl border border-line md:block">
        <table className="w-full table-fixed">
          <thead className="bg-canvas">
            <tr>
              <th className="w-[44%] px-4 py-3 text-left text-[12px] font-semibold text-ink-faint">Pernyataan</th>
              {LIKERT.map((l) => <th key={l} className="px-1 py-3 text-center text-[12px] font-semibold leading-tight text-ink-soft">{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {SCREENING_ITEMS.map((item, i) => (
              <tr
                key={i}
                id={`scr-${i}`}
                data-invalid={missing(i) ? '' : undefined}
                className={clsx('scroll-mt-28 border-t border-line', missing(i) ? 'bg-coral-50 shadow-[inset_3px_0_0] shadow-coral-500' : i % 2 && 'bg-canvas/50')}
              >
                <td className="px-4 py-3.5 text-[14px] leading-snug"><span className="mr-1.5 text-ink-faint">{i + 1}.</span>{item.text}</td>
                {LIKERT.map((l, k) => (
                  <td key={l} className="text-center">
                    <label className="inline-grid h-10 w-10 cursor-pointer place-items-center rounded-full hover:bg-sky-50">
                      <input type="radio" name={`scr-${i}`} className="h-5 w-5 cursor-pointer accent-sky-600" checked={answers[i] === k + 1} onChange={() => setAt(i, k + 1)} aria-label={`${item.text}: ${l}`} />
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile: kartu */}
      <ol className="space-y-3 md:hidden">
        {SCREENING_ITEMS.map((item, i) => (
          <li key={i} id={`scr-${i}`} data-invalid={missing(i) ? '' : undefined} className={clsx('scroll-mt-28 rounded-2xl border p-4', missing(i) ? 'invalid-card' : 'border-line')}>
            <p className="text-[14.5px] leading-snug"><span className="mr-1 text-ink-faint">{i + 1}.</span>{item.text}</p>
            {missing(i) && <p className="err">Belum dijawab.</p>}
            <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label={item.text}>
              {LIKERT.map((l, k) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={answers[i] === k + 1}
                  onClick={() => setAt(i, k + 1)}
                  className={clsx('min-h-10 rounded-xl border px-2 py-2 text-[13px] font-medium leading-tight transition-colors', answers[i] === k + 1 ? 'border-sky-600 bg-sky-600 text-white' : 'border-line bg-white text-ink-soft')}
                >
                  {l}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-right text-[13px] text-ink-faint">{answered} dari {SCREENING_ITEMS.length} pernyataan terjawab</p>
    </StepCard>
  );
}

function NeedsStep({ draft, set, showErrors }: { draft: Draft; set: (p: Partial<Draft>) => void; showErrors: boolean }) {
  const left = COMPLAINT_MIN - draft.complaint.trim().length;
  const err = {
    topic: showErrors && !draft.topic,
    complaint: showErrors && left > 0,
    impact: showErrors && !(draft.impact > 0),
    expectation: showErrors && draft.expectation.trim().length < 3,
  };
  return (
    <StepCard title="Ceritakan Kebutuhanmu" description="Bantu kami memahami kebutuhanmu agar sesi konseling dapat berjalan lebih optimal.">
      <div className="space-y-7">
        <div data-invalid={err.topic ? '' : undefined}>
          <p className="label">Apa topik permasalahan yang akan kamu ceritakan?</p>
          <div className={clsx('grid gap-2 sm:grid-cols-2', err.topic && 'invalid-group')} role="radiogroup" aria-invalid={err.topic || undefined}>
            {(Object.entries(CLIENT_TOPICS) as [ClientTopic, string][]).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={draft.topic === k}
                onClick={() => set({ topic: k })}
                className={clsx('flex h-12 items-center gap-3 rounded-xl border px-4 text-left text-sm font-semibold transition-colors', draft.topic === k ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-line bg-white hover:border-sky-200')}
              >
                <span className={clsx('grid h-5 w-5 shrink-0 place-items-center rounded-full border-2', draft.topic === k ? 'border-sky-600' : 'border-line')}>
                  {draft.topic === k && <span className="h-2.5 w-2.5 rounded-full bg-sky-600" />}
                </span>
                {label}
              </button>
            ))}
          </div>
          {err.topic && <p className="err mt-3">Pilih salah satu topik.</p>}
        </div>

        <Field
          error={err.complaint ? (draft.complaint.trim() ? `Minimal ${COMPLAINT_MIN} karakter · kurang ${left} lagi` : 'Ceritakan keluhanmu (minimal 100 karakter).') : undefined}
          label="Ceritakan lebih lanjut tentang keluhan yang kamu alami" hint={left > 0 ? `Minimal ${COMPLAINT_MIN} karakter · kurang ${left} lagi` : `${draft.complaint.trim().length} karakter`}>
          {(id) => <textarea id={id} className="input" rows={5} maxLength={3000} value={draft.complaint} onChange={(e) => set({ complaint: e.target.value })} placeholder="Tuliskan keluhan yang sedang kamu alami…" />}
        </Field>

        <div data-invalid={err.impact ? '' : undefined}>
          <p className="label">Apakah kondisi psikologis yang kamu alami berpengaruh pada keseharianmu?</p>
          <div className={clsx('grid grid-cols-5 gap-2 sm:grid-cols-10', err.impact && 'invalid-group')} role="radiogroup" aria-invalid={err.impact || undefined}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={draft.impact === n}
                onClick={() => set({ impact: n })}
                className={clsx('h-11 rounded-full border text-sm font-semibold tabular-nums transition-colors', draft.impact === n ? 'border-sky-600 bg-sky-600 text-white' : 'border-line bg-white hover:border-sky-300')}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-between gap-4 text-[12px] text-ink-faint">
            <span>1 = {IMPACT_LABEL[1]}</span>
            <span className="text-right">10 = {IMPACT_LABEL[10]}</span>
          </div>
          {err.impact && <p className="err">Pilih angka 1–10.</p>}
        </div>

        <Field label="Apa yang kamu harapkan melalui sesi konseling ini?" error={err.expectation ? 'Tuliskan harapanmu (minimal 3 karakter).' : undefined}>
          {(id) => <textarea id={id} className="input" rows={3} maxLength={1500} value={draft.expectation} onChange={(e) => set({ expectation: e.target.value })} placeholder="Ceritakan apa yang ingin kamu capai setelah mengikuti sesi konseling ini…" />}
        </Field>
        <p className="flex gap-1.5 text-[12.5px] text-ink-faint"><Lock size={13} className="mt-0.5 shrink-0" /> Jawabanmu hanya dibaca oleh psikolog yang mendampingimu.</p>
      </div>
    </StepCard>
  );
}

function ConfirmStep({ draft, onEdit }: { draft: Draft; onEdit: (step: number) => void }) {
  const { data } = usePsychologists();
  const p = data?.psychologists.find((x) => x.id === draft.slot.psychologistId);
  const { date, time, mode } = draft.slot;
  const Icon = mode ? MODE_ICON[mode] : CalendarDays;
  return (
    <StepCard title="Konfirmasi Pendaftaran" description="Mohon periksa kembali detail jadwal dan informasi berikut.">
      <div className="rounded-2xl border border-line">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-semibold">Detail Jadwal</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEdit(4)}>Ubah</button>
        </div>
        <dl className="space-y-4 px-5 py-4 text-sm">
          <Row icon={<CalendarDays size={18} />} label="Tanggal">{date && fmtYmd(date)}</Row>
          <Row icon={<Clock3 size={18} />} label="Waktu">{time && `${hmDot(time)} – ${hmDot(addMinutes(time, 60))} WIB (60 menit)`}</Row>
          <Row icon={p ? <Avatar name={p.name} src={p.avatarUrl} tone={p.avatarTone} size={36} /> : <UserRound size={18} />} label="Psikolog">{p && fullPsychName(p)}</Row>
          <Row icon={<Icon size={18} />} label="Media Konseling">
            {mode && MODE_LABEL[mode]}
            <span className="mt-0.5 block text-[13px] font-normal text-ink-soft">
              {mode === 'offline'
                ? `${ROOM_PREFIX} — ruangan ditentukan otomatis dan tampil setelah pendaftaran berhasil.`
                : mode === 'online'
                  ? 'Tautan Microsoft Teams akan tersedia di halaman pendaftaranmu.'
                  : 'Sesi berlangsung lewat ruang chat di halaman pendaftaranmu.'}
            </span>
          </Row>
        </dl>
      </div>
      <div className="mt-4 rounded-2xl border border-line">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-semibold">Kebutuhanmu</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEdit(3)}>Ubah</button>
        </div>
        <dl className="grid gap-4 px-5 py-4 text-sm sm:grid-cols-3">
          <div><dt className="text-ink-faint">Nama panggilan</dt><dd className="font-semibold">{draft.nickname}</dd></div>
          <div><dt className="text-ink-faint">Topik</dt><dd className="font-semibold">{draft.topic && CLIENT_TOPICS[draft.topic]}</dd></div>
          <div><dt className="text-ink-faint">Pengaruh ke keseharian</dt><dd className="font-semibold">{draft.impact}/10</dd></div>
          <div className="sm:col-span-3"><dt className="text-ink-faint">Keluhan</dt><dd className="mt-0.5 line-clamp-3 whitespace-pre-line text-ink-soft">{draft.complaint}</dd></div>
        </dl>
      </div>
      <p className="mt-4 flex gap-2 rounded-2xl bg-sun-50 px-4 py-3 text-[13px] leading-relaxed text-sun-700">
        <Info size={16} className="mt-0.5 shrink-0" />
        Sesi berlangsung 60 menit dengan toleransi keterlambatan maksimal 15 menit. Perubahan jadwal atau pembatalan paling lambat H-4 jam sebelum sesi.
      </p>
    </StepCard>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[13px] text-ink-faint">{label}</dt>
        <dd className="font-semibold">{children}</dd>
      </div>
    </div>
  );
}

function Success({ ticket: t }: { ticket: Ticket }) {
  const navigate = useNavigate();
  const Icon = MODE_ICON[t.mode];
  return (
    <div className="mx-auto max-w-xl animate-rise py-4 text-center sm:py-8">
      <span className="tc-pop mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-mint-50 text-mint-700">
        <CalendarCheck2 size={40} strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-[30px] font-semibold leading-tight tracking-tight">
        Pendaftaran <span className="display italic text-sky-600">Berhasil!</span>
      </h1>
      <p className="mx-auto mt-2 max-w-md text-ink-soft">Jadwal konseling kamu telah berhasil didaftarkan. Detail jadwal dikirimkan melalui notifikasi dan email.</p>
      <dl className="card mt-7 divide-y divide-line text-left text-sm">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
          <dt className="text-ink-faint">Nomor Pendaftaran</dt>
          <dd className="flex items-center gap-2 font-mono font-semibold tracking-wide text-sky-800">
            {t.code}
            <button type="button" className="rounded-lg p-1 text-ink-faint hover:bg-sky-50 hover:text-sky-700" aria-label="Salin nomor" onClick={() => navigator.clipboard?.writeText(t.code).then(() => toast.success('Nomor pendaftaran disalin.'))}>
              <Copy size={15} />
            </button>
          </dd>
        </div>
        <div className="flex justify-between gap-3 px-5 py-3.5"><dt className="text-ink-faint">Tanggal</dt><dd className="font-semibold">{fmtDate(t.scheduledStart, 'EEEE, d MMMM yyyy')}</dd></div>
        <div className="flex justify-between gap-3 px-5 py-3.5"><dt className="text-ink-faint">Waktu</dt><dd className="font-semibold">{fmtTime(t.scheduledStart)} – {fmtTime(t.scheduledEnd)} WIB</dd></div>
        <div className="flex justify-between gap-3 px-5 py-3.5"><dt className="text-ink-faint">Psikolog</dt><dd className="text-right font-semibold">{fullPsychName(t.psychologist)}</dd></div>
        <div className="flex justify-between gap-3 px-5 py-3.5">
          <dt className="text-ink-faint">Media</dt>
          <dd className="text-right font-semibold">
            <span className="inline-flex items-center gap-1.5"><Icon size={15} /> {MODE_LABEL[t.mode]}</span>
            {t.location && <span className="block text-[13px] font-normal text-ink-soft">{t.location}</span>}
          </dd>
        </div>
      </dl>
      <button className="btn btn-primary mt-7 h-12 w-full" onClick={() => navigate(`/pendaftaran/${t.id}`)}>Lihat Pendaftaran Saya</button>
      <Link to="/" className="link mt-4 inline-block text-sm">Kembali ke Beranda</Link>
    </div>
  );
}

function NotEligible({ el }: { el: Eligibility }) {
  return (
    <div className="mx-auto max-w-xl animate-rise py-6 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-sky-50 text-sky-700"><CalendarDays size={30} strokeWidth={1.75} /></span>
      <h1 className="mt-5 text-[26px] font-semibold leading-tight tracking-tight">Belum bisa membuat janji baru</h1>
      <p className="mx-auto mt-2 max-w-md text-ink-soft">{el.reason}</p>
      {el.activeTicket ? (
        <Link to={`/pendaftaran/${el.activeTicket.id}`} className="btn btn-primary mt-6">Lihat jadwal aktif</Link>
      ) : (
        <Link to="/" className="btn btn-secondary mt-6">Kembali ke Beranda</Link>
      )}
      <p className="mt-6 text-[13px] text-ink-faint">Layanan dapat diikuti maksimal {el.maxPerYear}x dalam setahun dengan jeda minimal 2 minggu antar sesi.</p>
    </div>
  );
}

function Declined({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto max-w-xl animate-rise py-6 text-center">
      <LogoMark className="mx-auto h-20" />
      <h1 className="mt-5 text-[26px] font-semibold leading-tight tracking-tight">Terima kasih sudah membaca</h1>
      <p className="mx-auto mt-2 max-w-md text-ink-soft">
        Kamu memilih untuk tidak melanjutkan pendaftaran. Tidak apa-apa — kapan pun kamu siap, Teman Cerita BRILiaN tetap ada untukmu.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <button className="btn btn-secondary" onClick={onBack}>Baca ulang informasi</button>
        <Link to="/" className="btn btn-primary">Kembali ke Beranda</Link>
      </div>
    </div>
  );
}

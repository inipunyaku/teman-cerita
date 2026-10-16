import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowRight, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { api, errMsg } from '@/lib/api';
import type { Ticket } from '@/lib/types';
import { ChoiceCard, MODE_ICON, PageHeader, Sk, Spinner, StatusChip, TicketCard } from '@/components/ui';
import { ACTIVE_STATUSES, MODE_HINT, MODE_LABEL, REQUEST_TOPICS, URGENCY_LABEL, type Mode, type Urgency } from '@shared/constants';

const URGENCY_HINT: Record<Urgency, string> = {
  low: 'Kapan saja dalam 1–2 minggu ini',
  normal: 'Dalam beberapa hari ke depan',
  high: 'Sedang berat sekali, butuh segera',
};

export default function NewRequest() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['tickets', 'mine'], queryFn: () => api.get<{ tickets: Ticket[] }>('/tickets') });
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<Mode | ''>('');
  const [urgency, setUrgency] = useState<Urgency>('normal');
  const [story, setStory] = useState('');
  const [created, setCreated] = useState<Ticket | null>(null);

  const submit = useMutation({
    mutationFn: () => api.post<{ ticket: Ticket }>('/tickets', { topic, mode, urgency, story }),
    onSuccess: ({ ticket }) => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setCreated(ticket);
      window.scrollTo({ top: 0 });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl" role="status" aria-label="Memuat formulir">
        <div className="mb-8 space-y-3"><Sk className="h-3 w-24" /><Sk className="h-9 w-72 max-w-full" /><Sk className="h-4 w-full max-w-md" /></div>
        {[120, 230, 200, 150].map((h, i) => (
          <div key={i} className="card mb-4 space-y-3 p-5 sm:p-6">
            <Sk className="h-4 w-40" />
            <Sk className="w-full rounded-2xl" style={{ height: h - 60 }} />
          </div>
        ))}
      </div>
    );
  }
  const active = data?.tickets.find((t) => ACTIVE_STATUSES.includes(t.status));

  if (created) {
    return (
      <div className="mx-auto max-w-xl animate-rise py-6 text-center sm:py-10">
        <span className="eyebrow">Permintaan terkirim</span>
        <h1 className="mt-3 text-[30px] font-semibold leading-tight tracking-tight">
          Terima kasih sudah <span className="display italic text-sky-600">mau cerita.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">
          Permintaanmu sudah kami terima. Admin akan menentukan psikolog, jam, dan tempatnya, lalu mengabarimu lewat notifikasi dan email.
        </p>
        <TicketCard code={created.code} className="mt-8 text-left">
          <StatusChip status={created.status} />
          <p className="mt-2 text-sm font-semibold">{REQUEST_TOPICS[created.topic as keyof typeof REQUEST_TOPICS]}</p>
          <p className="text-[13px] text-ink-soft">{MODE_LABEL[created.mode]} · {URGENCY_LABEL[created.urgency]}</p>
        </TicketCard>
        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <button className="btn btn-primary" onClick={() => navigate(`/tiket/${created.id}`)}>
            Lihat tiket <ArrowRight size={16} />
          </button>
          <Link to="/" className="btn btn-secondary">Kembali ke beranda</Link>
        </div>
      </div>
    );
  }

  if (active) {
    return (
      <div className="mx-auto max-w-xl py-6">
        <PageHeader title="Kamu masih punya sesi aktif" description="Supaya antrean adil, setiap karyawan bisa punya satu tiket aktif. Selesaikan atau batalkan tiket ini dulu ya." />
        <Link to={`/tiket/${active.id}`} className="block">
          <TicketCard code={active.code}>
            <StatusChip status={active.status} />
            <p className="mt-2 text-sm font-semibold">{REQUEST_TOPICS[active.topic as keyof typeof REQUEST_TOPICS]}</p>
          </TicketCard>
        </Link>
      </div>
    );
  }

  const ready = topic && mode;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!topic) return toast.error('Pilih topik dulu ya.');
    if (!mode) return toast.error('Pilih cara kamu ingin ngobrol.');
    submit.mutate();
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl animate-rise">
      <PageHeader eyebrow="Ajukan sesi" title={<>Mau cerita soal <span className="display italic text-sky-600">apa?</span></>} description="Isi seperlunya saja. Jadwal dan psikolog akan ditentukan admin, lalu kamu dikabari." />

      <section className="card card-pad">
        <h2 className="text-sm font-semibold">1. Topik utama</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(REQUEST_TOPICS).map(([k, label]) => (
            <button
              type="button"
              key={k}
              onClick={() => setTopic(k)}
              aria-pressed={topic === k}
              className={clsx(
                'h-10 rounded-full border px-4 text-sm font-medium transition-colors',
                topic === k ? 'border-sky-600 bg-sky-600 text-white' : 'border-line bg-white text-ink hover:border-sky-300',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="card card-pad mt-4">
        <h2 className="text-sm font-semibold">2. Mau ngobrol lewat apa?</h2>
        <div className="mt-3 grid gap-2.5">
          {(['chat', 'online', 'offline'] as Mode[]).map((m) => {
            const Icon = MODE_ICON[m];
            return (
              <ChoiceCard key={m} selected={mode === m} onClick={() => setMode(m)} icon={<Icon size={20} strokeWidth={1.75} />} title={MODE_LABEL[m]} description={MODE_HINT[m]} />
            );
          })}
        </div>
      </section>

      <section className="card card-pad mt-4">
        <h2 className="text-sm font-semibold">3. Seberapa mendesak?</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(['low', 'normal', 'high'] as Urgency[]).map((u) => (
            <ChoiceCard key={u} selected={urgency === u} onClick={() => setUrgency(u)} title={URGENCY_LABEL[u]} description={URGENCY_HINT[u]} />
          ))}
        </div>
        {urgency === 'high' && (
          <p className="mt-3 rounded-2xl bg-coral-50 px-4 py-3 text-[13px] leading-relaxed text-coral-700">
            Kami akan memprioritaskan permintaanmu. Bila kamu merasa tidak aman saat ini, segera hubungi <a href="tel:119" className="font-semibold underline">119 ext. 8</a> atau orang terdekat.
          </p>
        )}
      </section>

      <section className="card card-pad mt-4">
        <label htmlFor="story" className="text-sm font-semibold">
          4. Ceritakan sedikit <span className="font-normal text-ink-faint">(boleh dilewati)</span>
        </label>
        <textarea id="story" className="input mt-3" rows={5} maxLength={2000} value={story} onChange={(e) => setStory(e.target.value)} placeholder="Apa yang sedang kamu rasakan atau alami belakangan ini?" />
        <div className="mt-2 flex items-start justify-between gap-4 text-[12.5px] text-ink-faint">
          <span className="flex gap-1.5"><Lock size={13} className="mt-0.5 shrink-0" /> Hanya dibaca admin layanan untuk mencocokkan psikolog, dan psikolog yang mendampingimu.</span>
          <span className="tabular-nums">{story.length}/2000</span>
        </div>
      </section>

      <div className="sticky bottom-20 z-10 mt-6 flex justify-end sm:bottom-4">
        <button className="btn btn-primary h-12 w-full px-6 text-[15px] shadow-pop sm:w-auto" disabled={!ready || submit.isPending}>
          {submit.isPending && <Spinner />} Kirim permintaan
        </button>
      </div>
    </form>
  );
}

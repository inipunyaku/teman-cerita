import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, Clock, Search, Settings2, UserRoundCheck } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, api, errMsg } from '@/lib/api';
import { fmtDay, fmtTime, fromNow } from '@/lib/format';
import type { SupportMessage, SupportThread } from '@/lib/types';
import { Avatar, EmptyState, Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { SUPPORT_MINUTES_MAX, SUPPORT_TEXT_MAX, fillSupportText, type SupportSettings } from '@shared/constants';
import { SupportConversation } from '@/components/support/SupportMessages';

/** Kotak masuk chat bantuan dari tombol chat melayang (pekerja, psikolog, dan tamu). */
export default function AdminSupport() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const activeId = Number(params.get('c')) || null;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data: cfg } = useQuery({
    queryKey: ['support', 'settings'],
    queryFn: () => api.get<{ settings: SupportSettings; defaults: SupportSettings }>('/support/threads/settings'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['support', 'threads', q],
    queryFn: () => api.get<{ threads: SupportThread[] }>(`/support/threads${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    refetchInterval: 30_000,
  });
  const threads = data?.threads ?? [];

  return (
    <div className="animate-rise">
      {/* Di HP, percakapan yang dibuka memakai seluruh layar; judul & info disembunyikan. */}
      <div className={clsx(activeId && 'hidden lg:block')}>
        <PageHeader
          title="Chat bantuan"
          description="Pesan dari tombol chat di setiap halaman. Tamu yang belum masuk mencantumkan nama dan PN."
          actions={
            <button className="btn btn-secondary" onClick={() => setSettingsOpen(true)} disabled={!cfg}>
              <Settings2 size={17} /> Balasan otomatis
            </button>
          }
        />
        {cfg && (
          <p className="mb-4 flex items-start gap-2 text-[13px] text-ink-soft sm:-mt-5">
            <Clock size={14} className="mt-[3px] shrink-0 text-ink-faint" />
            <span>
              {cfg.settings.autoReply
                ? `Balasan otomatis aktif · perkiraan respons ±${cfg.settings.responseMinutes} menit · info "admin tidak tersedia" setelah ${cfg.settings.waitMinutes} menit tanpa balasan`
                : 'Balasan otomatis nonaktif'}
            </span>
          </p>
        )}
      </div>
      {cfg && <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={cfg.settings} defaults={cfg.defaults} />}
      <div
        className={clsx(
          'card grid min-h-[420px] overflow-hidden lg:h-[calc(100dvh-14rem)] lg:min-h-[480px] lg:grid-cols-[340px_1fr]',
          activeId ? 'h-[calc(100dvh-7rem)]' : 'h-[calc(100dvh-14rem)]',
        )}
      >
        <aside className={clsx('flex min-h-0 flex-col border-line lg:border-r', activeId && 'hidden lg:flex')}>
          <div className="border-b border-line p-3">
            <label className="relative block">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input className="input pl-9" placeholder="Cari nama atau PN" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="grid h-40 place-items-center">
                <Spinner className="text-sky-600" />
              </div>
            ) : threads.length === 0 ? (
              <EmptyState title="Belum ada pesan" description={q ? 'Tidak ada percakapan yang cocok.' : 'Pesan bantuan baru akan muncul di sini.'} />
            ) : (
              threads.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setParams({ c: String(t.id) })}
                  className={clsx(
                    'flex w-full items-start gap-3 border-b border-line/70 px-4 py-3 text-left transition-colors',
                    t.id === activeId ? 'bg-sky-50' : 'hover:bg-canvas',
                  )}
                >
                  <Avatar name={t.name} src={t.avatarUrl} tone={t.avatarTone} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={clsx('truncate', t.unread ? 'font-bold' : 'font-semibold')}>{t.name}</span>
                      <span className="ml-auto shrink-0 text-[11.5px] text-ink-faint">{t.lastMessageAt && fmtShort(t.lastMessageAt)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-faint">
                      <span className={clsx('chip h-5 px-2', t.guest ? 'bg-sun-50 text-sun-700' : 'bg-sky-50 text-sky-800')}>{t.roleLabel}</span>
                      {t.pn && <span className="truncate font-mono">PN {t.pn}</span>}
                    </span>
                    {t.awaitingSince && <Waiting since={t.awaitingSince} limit={cfg?.settings.waitMinutes} />}
                    <span className="mt-1 flex items-center gap-2">
                      <span className={clsx('line-clamp-1 flex-1 text-[13px]', t.unread ? 'text-ink' : 'text-ink-soft')}>
                        {t.lastMessage?.auto ? 'Otomatis: ' : t.lastMessage?.fromAdmin && 'Anda: '}
                        {t.lastMessage?.body}
                      </span>
                      {t.unread > 0 && (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-coral-500 px-1.5 text-[11px] font-bold text-white">
                          {t.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>
        <section className={clsx('min-h-0 flex-col', activeId ? 'flex' : 'hidden lg:flex')}>
          {activeId ? (
            <Conversation id={activeId} onBack={() => setParams({})} />
          ) : (
            <div className="grid flex-1 place-items-center">
              <EmptyState title="Pilih percakapan" description="Pilih salah satu pesan di kiri untuk membalas." />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const fmtShort = (iso: string) => (fmtDay(iso) === 'Hari ini' ? fmtTime(iso) : fmtDay(iso));

function Conversation({ id, onBack }: { id: number; onBack: () => void }) {
  const qc = useQueryClient();
  const key = ['support', 'thread', id];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => api.get<{ thread: SupportThread; messages: SupportMessage[] }>(`/support/threads/${id}`),
  });

  const unread = data?.thread.unread ?? 0;
  useEffect(() => {
    if (!unread) return;
    api
      .post(`/support/threads/${id}/read`)
      .then(() => qc.invalidateQueries({ queryKey: ['support'] }))
      .catch(() => {});
  }, [id, unread, qc]);

  const send = useMutation({
    mutationFn: (body: string) =>
      api.post<{ message: SupportMessage }>(`/support/threads/${id}/messages`, {
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support'] }),
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading)
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner className="text-sky-600" />
      </div>
    );
  if (error || !data) return <p className="p-10 text-center text-ink-soft">{errMsg(error)}</p>;
  const t = data.thread;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button className="btn btn-ghost w-10 px-0 lg:hidden" onClick={onBack} aria-label="Kembali ke daftar">
          <ArrowLeft size={18} />
        </button>
        <Avatar name={t.name} src={t.avatarUrl} tone={t.avatarTone} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{t.name}</div>
          <div className="truncate text-[12.5px] text-ink-soft">
            {[t.roleLabel, t.pn && `PN ${t.pn}`, t.unitName, t.email].filter(Boolean).join(' · ')}
          </div>
        </div>
        <span className="hidden text-[12px] text-ink-faint sm:block">Mulai {fromNow(t.createdAt)}</span>
      </div>
      {t.guest && (
        <div
          className={clsx(
            'flex items-center gap-2 border-b border-line px-4 py-2 text-[12.5px]',
            t.pnMatch ? 'bg-mint-50 text-ink-soft' : 'bg-sun-50 text-sun-700',
          )}
        >
          <UserRoundCheck size={15} className="shrink-0" />
          {t.pnMatch
            ? `Belum masuk. PN cocok dengan data pekerja: ${t.pnMatch}.`
            : 'Belum masuk. PN tidak ditemukan di data pekerja — pastikan identitasnya sebelum memberi info akun.'}
        </div>
      )}
      <SupportConversation
        className="flex-1"
        messages={data.messages}
        mineIsAdmin
        sending={send.isPending}
        onSend={(body) => send.mutateAsync(body)}
      />
    </>
  );
}

/** Penanda pesan yang belum dibalas admin; merah bila melewati batas waktu tunggu. */
function Waiting({ since, limit }: { since: string; limit?: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(since)) / 60_000));
  const late = limit !== undefined && mins >= limit;
  return (
    <span className={clsx('mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold', late ? 'text-coral-700' : 'text-sun-700')}>
      <Clock size={12} /> Menunggu balasan {mins < 1 ? '< 1 menit' : `${mins} menit`}
    </span>
  );
}

type SettingsForm = Omit<SupportSettings, 'responseMinutes' | 'waitMinutes'> & {
  responseMinutes: string;
  waitMinutes: string;
};

function SettingsModal({
  open,
  onClose,
  settings,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  settings: SupportSettings;
  defaults: SupportSettings;
}) {
  const qc = useQueryClient();
  const toForm = (s: SupportSettings): SettingsForm => ({
    ...s,
    responseMinutes: String(s.responseMinutes),
    waitMinutes: String(s.waitMinutes),
  });
  const [f, setF] = useState<SettingsForm>(() => toForm(settings));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  useEffect(() => {
    if (open) {
      setF(toForm(settings));
      setErrors({});
    }
  }, [open, settings]);
  const set = <K extends keyof SettingsForm>(k: K, v: SettingsForm[K]) => setF((o) => ({ ...o, [k]: v }));

  const save = useMutation({
    mutationFn: (d: SupportSettings) => api.put<{ settings: SupportSettings }>('/support/threads/settings', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support'] });
      toast.success('Pengaturan balasan otomatis disimpan.');
      onClose();
    },
    onError: (e) => {
      const fields = e instanceof ApiError ? (e.data.fields as Record<string, string[]> | undefined) : undefined;
      if (fields) setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0]])));
      toast.error(errMsg(e));
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const response = Number(f.responseMinutes);
    const wait = Number(f.waitMinutes);
    const errs: Record<string, string | undefined> = {};
    const checkMin = (v: number, label: string) =>
      !Number.isInteger(v) || v < 1 || v > SUPPORT_MINUTES_MAX ? `${label} harus 1–${SUPPORT_MINUTES_MAX} menit.` : undefined;
    errs.responseMinutes = checkMin(response, 'Perkiraan waktu respons');
    errs.waitMinutes =
      checkMin(wait, 'Batas waktu tunggu') ?? (wait < response ? 'Tidak boleh lebih singkat dari perkiraan waktu respons.' : undefined);
    errs.greeting = f.greeting.trim() ? undefined : 'Pesan wajib diisi.';
    errs.unavailable = f.unavailable.trim() ? undefined : 'Pesan wajib diisi.';
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    save.mutate({
      ...f,
      responseMinutes: response,
      waitMinutes: wait,
      greeting: f.greeting.trim(),
      unavailable: f.unavailable.trim(),
    });
  };

  const preview = {
    responseMinutes: Number(f.responseMinutes) || 0,
    waitMinutes: Number(f.waitMinutes) || 0,
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Balasan otomatis chat bantuan"
      description="Pesan pertama pengguna langsung dibalas otomatis. Bila admin belum membalas melewati batas waktu tunggu, pengguna diberi tahu admin sedang tidak tersedia."
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => setF(toForm(defaults))}>
            Kembalikan default
          </button>
          <span className="flex-1" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button type="submit" form="support-settings" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? <Spinner /> : 'Simpan'}
          </button>
        </>
      }
    >
      <form id="support-settings" onSubmit={submit} className="space-y-5">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 accent-sky-600"
            checked={f.autoReply}
            onChange={(e) => set('autoReply', e.target.checked)}
          />
          <span>
            <span className="block font-semibold">Aktifkan balasan otomatis</span>
            <span className="text-[13px] text-ink-soft">Bila dimatikan, tidak ada pesan "mohon tunggu" maupun info "admin tidak tersedia".</span>
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Perkiraan waktu respons (menit)"
            error={errors.responseMinutes}
            hint="Ditampilkan ke pengguna, mis. “membalas dalam ±5 menit”."
          >
            {(id) => (
              <input
                id={id}
                className="input"
                inputMode="numeric"
                value={f.responseMinutes}
                onChange={(e) => set('responseMinutes', e.target.value.replace(/\D/g, ''))}
              />
            )}
          </Field>
          <Field label="Batas waktu tunggu (menit)" error={errors.waitMinutes} hint="Lewat dari ini tanpa balasan admin → info admin tidak tersedia.">
            {(id) => (
              <input
                id={id}
                className="input"
                inputMode="numeric"
                value={f.waitMinutes}
                onChange={(e) => set('waitMinutes', e.target.value.replace(/\D/g, ''))}
              />
            )}
          </Field>
        </div>
        <Field
          label="Pesan balasan otomatis (mohon tunggu)"
          error={errors.greeting}
          hint={
            <>
              Gunakan <code>{'{waktu_respons}'}</code> untuk perkiraan waktu respons. Contoh: “{fillSupportText(f.greeting, preview)}”
            </>
          }
        >
          {(id) => (
            <textarea
              id={id}
              className="input min-h-[90px]"
              maxLength={SUPPORT_TEXT_MAX}
              value={f.greeting}
              onChange={(e) => set('greeting', e.target.value)}
            />
          )}
        </Field>
        <Field
          label="Pesan admin tidak tersedia"
          error={errors.unavailable}
          hint={
            <>
              Bisa memakai <code>{'{batas_tunggu}'}</code> dan <code>{'{waktu_respons}'}</code>.
            </>
          }
        >
          {(id) => (
            <textarea
              id={id}
              className="input min-h-[90px]"
              maxLength={SUPPORT_TEXT_MAX}
              value={f.unavailable}
              onChange={(e) => set('unavailable', e.target.value)}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}

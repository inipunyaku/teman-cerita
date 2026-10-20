import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, Search, UserRoundCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, errMsg } from '@/lib/api';
import { fmtDay, fmtTime, fromNow } from '@/lib/format';
import type { SupportMessage, SupportThread } from '@/lib/types';
import { Avatar, EmptyState, PageHeader, Spinner } from '@/components/ui';
import { SupportConversation } from '@/components/support/SupportMessages';

/** Kotak masuk chat bantuan dari tombol chat melayang (pekerja, psikolog, dan tamu). */
export default function AdminSupport() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const activeId = Number(params.get('c')) || null;

  const { data, isLoading } = useQuery({
    queryKey: ['support', 'threads', q],
    queryFn: () => api.get<{ threads: SupportThread[] }>(`/support/threads${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    refetchInterval: 30_000,
  });
  const threads = data?.threads ?? [];

  return (
    <div className="animate-rise">
      <PageHeader title="Chat bantuan" description="Pesan dari tombol chat di setiap halaman. Tamu yang belum masuk mencantumkan nama dan PN." />
      <div className="card grid h-[calc(100dvh-14rem)] min-h-[480px] overflow-hidden lg:grid-cols-[340px_1fr]">
        <aside className={clsx('flex min-h-0 flex-col border-line lg:border-r', activeId && 'hidden lg:flex')}>
          <div className="border-b border-line p-3">
            <label className="relative block">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input className="input pl-9" placeholder="Cari nama atau PN" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="grid h-40 place-items-center"><Spinner className="text-sky-600" /></div>
            ) : threads.length === 0 ? (
              <EmptyState title="Belum ada pesan" description={q ? 'Tidak ada percakapan yang cocok.' : 'Pesan bantuan baru akan muncul di sini.'} />
            ) : (
              threads.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setParams({ c: String(t.id) })}
                  className={clsx('flex w-full items-start gap-3 border-b border-line/70 px-4 py-3 text-left transition-colors', t.id === activeId ? 'bg-sky-50' : 'hover:bg-canvas')}
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
                    <span className="mt-1 flex items-center gap-2">
                      <span className={clsx('line-clamp-1 flex-1 text-[13px]', t.unread ? 'text-ink' : 'text-ink-soft')}>
                        {t.lastMessage?.fromAdmin && 'Anda: '}
                        {t.lastMessage?.body}
                      </span>
                      {t.unread > 0 && (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-coral-500 px-1.5 text-[11px] font-bold text-white">{t.unread}</span>
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
    mutationFn: (body: string) => api.post<{ message: SupportMessage }>(`/support/threads/${id}/messages`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support'] }),
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading) return <div className="grid flex-1 place-items-center"><Spinner className="text-sky-600" /></div>;
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
        <div className={clsx('flex items-center gap-2 border-b border-line px-4 py-2 text-[12.5px]', t.pnMatch ? 'bg-mint-50 text-ink-soft' : 'bg-sun-50 text-sun-700')}>
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

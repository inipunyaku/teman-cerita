import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { fromNow } from '@/lib/format';
import type { Notification } from '@/lib/types';
import { EmptyState } from './ui';
import { NotificationSkeleton } from './Skeletons';

export function NotificationBell({ align = 'right' }: { align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ items: Notification[]; unread: number }>('/notifications'),
    refetchInterval: 120_000,
  });
  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = async (n: Notification) => {
    setOpen(false);
    if (!n.readAt) {
      await api.post(`/notifications/${n.id}/read`).catch(() => {});
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
    if (n.link) navigate(n.link);
  };

  const unread = data?.unread ?? 0;
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn btn-ghost relative h-10 w-10 px-0"
        aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ''}`}
        aria-expanded={open}
      >
        <Bell size={20} strokeWidth={1.75} absoluteStrokeWidth />
        {unread > 0 && (
          <span className="absolute right-px top-[3px] grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-white bg-coral-500 px-[3px] text-[10.5px] font-bold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className={clsx(
            'fixed inset-x-3 top-16 z-40 animate-rise overflow-hidden rounded-3xl border border-line bg-white shadow-pop sm:absolute sm:inset-x-auto sm:top-12 sm:w-[380px]',
            align === 'right' ? 'sm:right-0' : 'sm:left-0',
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <span className="font-semibold">Notifikasi</span>
            {unread > 0 && (
              <button onClick={() => readAll.mutate()} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-sky-700">
                <CheckCheck size={15} /> Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="scrollbar-thin max-h-[min(70dvh,480px)] overflow-y-auto">
            {isLoading ? (
              <NotificationSkeleton />
            ) : !data?.items.length ? (
              <EmptyState title="Belum ada notifikasi" description="Kabar soal tiket dan jadwalmu akan muncul di sini." />
            ) : (
              data.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={clsx(
                    'flex w-full gap-3 border-b border-line/70 px-5 py-3.5 text-left transition-colors last:border-0 hover:bg-sky-50/60',
                    !n.readAt && 'bg-sky-50/40',
                  )}
                >
                  <span
                    className={clsx(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      n.readAt ? 'bg-transparent' : n.priority ? 'bg-coral-500' : 'bg-sky-500',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={clsx('block text-sm', n.readAt ? 'text-ink-soft' : 'font-semibold text-ink')}>{n.title}</span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-[13px] text-ink-soft">{n.body}</span>}
                    <span className="mt-1 block text-[12px] text-ink-faint">{fromNow(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

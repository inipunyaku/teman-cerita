import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronDown, Headset, LogOut, MessageCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, api, errMsg } from '@/lib/api';
import { revealInvalid } from '@/lib/validation';
import { useAuth } from '@/lib/auth';
import { useKeyboardOpen, useMediaQuery } from '@/lib/viewport';
import type { SupportMessage } from '@/lib/types';
import { Field, Spinner } from '../ui';
import { SupportConversation } from './SupportMessages';

const TOKEN_KEY = 'tc_support_token';
const IDENTITY_KEY = 'tc_support_identity';
/** Dikirim (mis. dari toast) untuk membuka panel chat admin. */
export const OPEN_SUPPORT_EVENT = 'tc:open-support';

interface MeResponse {
  thread: { id: number; name: string | null; pn: string | null } | null;
  messages: SupportMessage[];
  unread: number;
}

/**
 * Area layar yang benar-benar terlihat. Di HP, keyboard menutupi sebagian layar tanpa mengubah tinggi halaman,
 * jadi panel chat mengikuti visualViewport supaya kotak tulis tetap tepat di atas keyboard.
 */
function useVisualViewport(active: boolean): CSSProperties | undefined {
  const [box, setBox] = useState<{ top: number; height: number }>();
  useEffect(() => {
    if (!active) return setBox(undefined);
    const vv = window.visualViewport;
    const update = () => setBox(vv ? { top: vv.offsetTop, height: vv.height } : { top: 0, height: window.innerHeight });
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [active]);
  return box && { top: box.top, height: box.height };
}

/** Kunci gulir halaman di belakang panel layar penuh (HP). */
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const prev = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      [html.style.overflow, document.body.style.overflow] = prev;
    };
  }, [active]);
}

/** Tombol chat melayang untuk menghubungi admin; hanya untuk pengguna yang sudah masuk. */
export function SupportWidget() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const isGuest = !user;
  // Di HP, halaman pendaftaran punya bilah tombol Kembali/Lanjutkan yang menempel di bawah: tombol chat naik di atasnya.
  const onBooking = useLocation().pathname.endsWith('/buat-janji');
  // Tidak tampil di halaman masuk (tamu) maupun untuk admin.
  const hidden = loading || !user || user.role === 'admin';
  const headers = isGuest && token ? { 'x-support-token': token } : undefined;
  const enabled = !hidden && (!isGuest || !!token);
  const mobile = useMediaQuery('(max-width: 639px)');
  const fullscreen = open && mobile;
  // Di HP, tombol melayang disembunyikan selama mengetik di halaman supaya tidak menutupi kolom.
  const typing = useKeyboardOpen() && mobile && !open;
  const viewport = useVisualViewport(fullscreen);
  useScrollLock(fullscreen);

  const forget = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(IDENTITY_KEY);
    setToken(null);
  };

  const key = ['support', 'me', user?.id ?? token];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => api.get<MeResponse>('/support/me', headers),
    enabled,
    // Pengguna yang login menerima pesan lewat SSE; tamu cukup memeriksa berkala.
    refetchInterval: isGuest ? (open ? 5000 : 30_000) : false,
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2,
  });
  useEffect(() => {
    if (error instanceof ApiError && error.code === 'NO_THREAD') forget();
  }, [error]);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_SUPPORT_EVENT, show);
    return () => window.removeEventListener(OPEN_SUPPORT_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const messages = data?.messages ?? [];
  const unread = data?.unread ?? 0;

  // Tandai balasan admin sudah dibaca selama panel terbuka.
  useEffect(() => {
    if (!open || !unread) return;
    api
      .post('/support/me/read', {}, headers)
      .then(() => qc.invalidateQueries({ queryKey: ['support', 'me'] }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unread]);

  const send = useMutation({
    mutationFn: (body: string) => api.post<{ message: SupportMessage }>('/support/me/messages', { body }, headers),
    onSuccess: ({ message }) => {
      qc.setQueryData<MeResponse>(key, (old) =>
        old ? (old.messages.some((m) => m.id === message.id) ? old : { ...old, messages: [...old.messages, message] }) : old,
      );
      // Ambil ulang supaya balasan otomatis ikut tampil (tamu tidak menerima SSE).
      qc.invalidateQueries({ queryKey: ['support', 'me'] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'NO_THREAD') forget();
      toast.error(errMsg(e));
    },
  });

  if (hidden) return null;
  const needIdentity = isGuest && !token;
  const identity = isGuest && token ? readIdentity() : null;
  const subtitle = identity ? `${identity.name} · PN ${identity.pn}` : 'Tanya seputar layanan, akun, atau jadwal';

  return (
    <div className={clsx('fixed right-4 z-40 sm:right-6', user?.role === 'employee' ? (onBooking ? 'bottom-[148px] sm:bottom-6' : 'bottom-[88px] sm:bottom-6') : 'bottom-5 sm:bottom-6')}>
      {open && (
        <div
          role="dialog"
          aria-modal={fullscreen || undefined}
          aria-label="Chat admin Teman Cerita"
          style={fullscreen ? viewport : undefined}
          className={clsx(
            'flex flex-col overflow-hidden bg-white',
            fullscreen
              ? 'fixed inset-x-0 top-0 z-[60] h-dvh'
              : 'absolute bottom-[72px] right-0 h-[min(600px,calc(100dvh-140px))] w-[380px] animate-rise rounded-[24px] border border-line shadow-pop',
          )}
        >
          <div className={clsx('flex shrink-0 items-center gap-3 bg-sky-600 px-4 py-3 text-white', fullscreen && 'pt-[max(0.75rem,env(safe-area-inset-top))]')}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15">
              <Headset size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-tight">Admin Teman Cerita</div>
              <div className="truncate text-[12.5px] text-white/80">{subtitle}</div>
            </div>
            {identity && (
              <button
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-white/15"
                onClick={() => {
                  forget();
                  qc.removeQueries({ queryKey: ['support', 'me'] });
                }}
                aria-label="Akhiri & ganti identitas"
                title="Akhiri & ganti identitas"
              >
                <LogOut size={18} />
              </button>
            )}
            <button className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-white/15" onClick={() => setOpen(false)} aria-label="Tutup chat">
              {fullscreen ? <ChevronDown size={22} /> : <X size={19} />}
            </button>
          </div>

          {needIdentity ? (
            <GuestForm
              className={fullscreen ? 'pb-[max(1.25rem,env(safe-area-inset-bottom))]' : undefined}
              onStarted={(t, ident) => {
                localStorage.setItem(TOKEN_KEY, t);
                localStorage.setItem(IDENTITY_KEY, JSON.stringify(ident));
                setToken(t);
              }}
            />
          ) : isLoading ? (
            <div className="grid flex-1 place-items-center">
              <Spinner className="text-sky-600" />
            </div>
          ) : (
            <SupportConversation
              className="flex-1"
              composerClassName={fullscreen ? 'pb-[max(0.75rem,env(safe-area-inset-bottom))]' : undefined}
              messages={messages}
              mineIsAdmin={false}
              sending={send.isPending}
              onSend={(body) => send.mutateAsync(body)}
              empty={<Welcome name={user?.name ?? identity?.name} />}
            />
          )}
        </div>
      )}

      {!fullscreen && !typing && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="relative grid h-14 w-14 place-items-center rounded-full bg-sky-600 text-white shadow-pop transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
          aria-label={open ? 'Tutup chat admin' : `Chat admin${unread ? `, ${unread} pesan baru` : ''}`}
          aria-expanded={open}
        >
          {open ? <X size={24} /> : <MessageCircle size={25} />}
          {!open && unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-coral-500 px-1 text-[11px] font-bold ring-2 ring-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

function readIdentity(): { name: string; pn: string } | null {
  try {
    return JSON.parse(localStorage.getItem(IDENTITY_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function Welcome({ name }: { name?: string | null }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-[20px] rounded-bl-[6px] border border-line bg-white px-3.5 py-2 text-[14px] leading-relaxed text-ink">
        Halo{name ? ` ${name.split(' ')[0]}` : ''}! 👋 Ada yang bisa kami bantu? Tulis pertanyaanmu di bawah ini.
      </div>
    </div>
  );
}

function GuestForm({ onStarted, className }: { onStarted: (token: string, identity: { name: string; pn: string }) => void; className?: string }) {
  const [name, setName] = useState('');
  const [pn, setPn] = useState('');
  const [errors, setErrors] = useState<{ name?: string; pn?: string }>({});
  const start = useMutation({
    mutationFn: (d: { name: string; pn: string }) => api.post<{ token: string }>('/support/guest', d),
    onSuccess: (r, d) => onStarted(r.token, d),
    onError: (e) => {
      const f = e instanceof ApiError ? (e.data.fields as Record<string, string[]> | undefined) : undefined;
      if (f) {
        setErrors({ name: f.name?.[0], pn: f.pn?.[0] });
        revealInvalid();
      }
      else toast.error(errMsg(e));
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const d = { name: name.trim(), pn: pn.trim() };
    const errs = {
      name: d.name.length < 2 ? 'Isi nama kamu.' : undefined,
      pn: !/^[0-9A-Za-z]{3,20}$/.test(d.pn) ? 'Isi PN kamu (angka/huruf tanpa spasi).' : undefined,
    };
    setErrors(errs);
    if (errs.name || errs.pn) return revealInvalid();
    start.mutate(d);
  };

  return (
    <form onSubmit={submit} className={clsx('flex min-h-0 flex-1 flex-col', className)}>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
        <div>
          <p className="font-semibold">Belum masuk? Kenalan dulu, yuk.</p>
          <p className="mt-1 text-[13.5px] text-ink-soft">Isi nama dan PN supaya admin tahu siapa yang menghubungi, misalnya saat kamu kesulitan masuk.</p>
        </div>
        <Field label="Nama" error={errors.name}>
          {(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} enterKeyHint="next" />}
        </Field>
        <Field label="PN (Personal Number)" error={errors.pn}>
          {(id) => (
            <input
              id={id}
              className="input"
              value={pn}
              onChange={(e) => setPn(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              maxLength={20}
              placeholder="mis. 90001234"
              enterKeyHint="go"
            />
          )}
        </Field>
      </div>
      <div className="shrink-0 border-t border-line bg-white px-5 pt-3 pb-5">
        <button type="submit" className="btn btn-primary w-full" disabled={start.isPending}>
          {start.isPending ? <Spinner /> : 'Mulai chat'}
        </button>
      </div>
    </form>
  );
}

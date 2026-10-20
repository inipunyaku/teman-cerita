import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import { Bot, Check, CheckCheck, SendHorizontal } from 'lucide-react';
import { fmtDay, fmtTime } from '@/lib/format';
import type { SupportMessage } from '@/lib/types';

/** Daftar pesan + kotak tulis untuk chat bantuan; dipakai widget pengguna dan halaman admin. */
export function SupportConversation({
  messages,
  mineIsAdmin,
  empty,
  onSend,
  sending,
  className,
  composerClassName,
}: {
  messages: SupportMessage[];
  /** true di sisi admin: pesan admin tampil sebagai "milik sendiri". */
  mineIsAdmin: boolean;
  empty?: ReactNode;
  onSend: (body: string) => Promise<unknown>;
  sending?: boolean;
  className?: string;
  composerClassName?: string;
}) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: messages.length > 30 ? 'auto' : 'smooth' });
  }, [messages.length]);

  // Saat tinggi panel berubah (mis. keyboard HP muncul), tetap tampilkan pesan terakhir.
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => el.scrollTo({ top: el.scrollHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setText('');
    onSend(body).catch(() => setText(body));
    taRef.current?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) {
      e.preventDefault();
      submit();
    }
  };

  let lastDay = '';
  return (
    <div className={clsx('flex min-h-0 flex-col', className)}>
      <div
        ref={listRef}
        className="scrollbar-thin min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain bg-[linear-gradient(180deg,#F7FAFC,#fff_40%)] px-3 py-4 sm:px-4"
        aria-live="polite"
      >
        {messages.length === 0 && empty}
        {messages.map((m) => {
          const day = fmtDay(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-white px-3 py-1 text-[11.5px] font-semibold text-ink-faint ring-1 ring-line">{day}</span>
                </div>
              )}
              {m.auto && mineIsAdmin ? <AutoNote m={m} /> : <Bubble m={m} mine={m.fromAdmin === mineIsAdmin} showSender={mineIsAdmin} />}
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className={clsx('flex items-end gap-2 border-t border-line bg-white p-3', composerClassName)}>
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          placeholder="Tulis pesan…"
          className="input max-h-32 min-h-[44px] flex-1 resize-none py-2.5 leading-snug [field-sizing:content]"
          aria-label="Tulis pesan"
          maxLength={2000}
          enterKeyHint="send"
        />
        <button type="submit" className="btn btn-primary h-11 w-11 shrink-0 px-0" disabled={!text.trim() || sending} aria-label="Kirim">
          <SendHorizontal size={18} />
        </button>
      </form>
    </div>
  );
}

function Bubble({ m, mine, showSender }: { m: SupportMessage; mine: boolean; showSender: boolean }) {
  return (
    <div className={clsx('flex flex-col', mine ? 'items-end' : 'items-start')}>
      {m.auto ? (
        <span className="mb-0.5 inline-flex items-center gap-1 px-1 text-[11px] text-ink-faint">
          <Bot size={12} /> Balasan otomatis
        </span>
      ) : (
        m.fromAdmin && showSender && m.senderName && <span className="mb-0.5 px-1 text-[11px] text-ink-faint">{m.senderName}</span>
      )}
      <div
        className={clsx(
          'max-w-[85%] animate-rise whitespace-pre-wrap break-words px-3.5 py-2 text-[14px] leading-relaxed',
          mine ? 'rounded-[20px] rounded-br-[6px] bg-sky-600 text-white' : 'rounded-[20px] rounded-bl-[6px] border border-line bg-white text-ink',
        )}
      >
        {m.body}
        <span className={clsx('ml-2 inline-flex translate-y-[2px] items-center gap-0.5 text-[10.5px]', mine ? 'text-white/70' : 'text-ink-faint')}>
          {fmtTime(m.createdAt)}
          {mine && (m.readAt ? <CheckCheck size={13} /> : <Check size={13} />)}
        </span>
      </div>
    </div>
  );
}

/** Di sisi admin, pesan otomatis tampil sebagai catatan sistem, bukan balasan admin. */
function AutoNote({ m }: { m: SupportMessage }) {
  return (
    <div className="my-2 flex justify-center">
      <div className="max-w-[85%] rounded-xl bg-canvas px-3 py-2 text-center text-[12.5px] leading-relaxed text-ink-soft ring-1 ring-line">
        <span className="mb-0.5 flex items-center justify-center gap-1 font-semibold text-ink-faint">
          <Bot size={13} /> Balasan otomatis · {fmtTime(m.createdAt)}
        </span>
        {m.body}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, CheckCheck, Download, FileText, Lock, Paperclip, SendHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtBytes, fmtDay, fmtTime } from '@/lib/format';
import type { Attachment, ChatState, Message } from '@/lib/types';
import { ATTACHMENT_TYPES, attachmentExt } from '@shared/constants';
import { Avatar, Spinner } from './ui';
import { ChatSkeleton } from './Skeletons';
import { useConfig } from '@/lib/config';

const ACCEPT = Object.keys(ATTACHMENT_TYPES)
  .map((ext) => `.${ext}`)
  .join(',');

interface Props {
  ticketId: number;
  otherName: string;
  otherAvatar?: string | null;
  otherTone?: string | null;
  otherSubtitle?: string;
  className?: string;
}

export function ChatPanel({ ticketId, otherName, otherAvatar, otherTone, otherSubtitle, className }: Props) {
  const cfg = useConfig();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['messages', ticketId],
    queryFn: () => api.get<{ messages: Message[]; state: ChatState }>(`/tickets/${ticketId}/messages`),
  });
  const messages = data?.messages ?? [];
  const state = data?.state;
  // Kuota lampiran per sesi chat & ukuran maksimal per file (pengaturan super admin).
  const quota = state?.attachments;
  const maxMB = quota?.maxMB ?? cfg.attachmentMaxMB;
  const quotaFull = !!quota && quota.used >= quota.max;

  const append = ({ message }: { message: Message }) => {
    qc.setQueryData<{ messages: Message[]; state: ChatState }>(['messages', ticketId], (old) =>
      old && !old.messages.some((m) => m.id === message.id) ? { ...old, messages: [...old.messages, message] } : old,
    );
  };

  const send = useMutation({
    mutationFn: (body: string) => api.post<{ message: Message }>(`/tickets/${ticketId}/messages`, { body }),
    onSuccess: append,
    onError: (e, body) => {
      toast.error(errMsg(e));
      setText(body);
    },
  });

  const sendFile = useMutation({
    mutationFn: (file: File) => api.upload<{ message: Message }>(`/tickets/${ticketId}/attachments`, file),
    onSuccess: (r) => {
      append(r);
      // Perbarui hitungan kuota lampiran.
      qc.invalidateQueries({ queryKey: ['messages', ticketId] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const pickFile = (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (!ATTACHMENT_TYPES[attachmentExt(file.name)]) {
      return toast.error('Jenis file tidak didukung.', { description: 'Kirim foto, video pendek, atau dokumen (PDF/Word/Excel/PowerPoint/TXT).' });
    }
    if (quotaFull) {
      return toast.error(`Maksimal ${quota!.max} file per sesi chat.`, { description: 'Batas lampiran untuk sesi ini sudah tercapai.' });
    }
    if (file.size > maxMB * 1024 * 1024) {
      return toast.error('File terlalu besar.', { description: `Ukuran ${fmtBytes(file.size)}, maksimal ${maxMB} MB.` });
    }
    sendFile.mutate(file);
  };

  // Tandai dibaca setiap ada pesan baru dari lawan bicara.
  const lastOther = [...messages].reverse().find((m) => m.senderId !== user?.id && !m.readAt)?.id;
  useEffect(() => {
    if (!lastOther) return;
    api
      .post(`/tickets/${ticketId}/messages/read`)
      .then(() => {
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['tickets'] });
      })
      .catch(() => {});
  }, [lastOther, ticketId, qc]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: messages.length > 30 ? 'auto' : 'smooth' });
  }, [messages.length, sendFile.isPending]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || send.isPending) return;
    setText('');
    send.mutate(body);
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
    <div className={clsx('card flex min-h-0 flex-col overflow-hidden', className)}>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <Avatar name={otherName} src={otherAvatar} tone={otherTone} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{otherName}</div>
          {otherSubtitle && <div className="truncate text-[12.5px] text-ink-soft">{otherSubtitle}</div>}
        </div>
        <span className="hidden items-center gap-1 text-[12px] text-ink-faint sm:inline-flex">
          <Lock size={13} /> Privat
        </span>
      </div>

      <div
        ref={listRef}
        className="scrollbar-thin min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-[linear-gradient(180deg,#F7FAFC,#fff_40%)] px-3 py-4 sm:px-5"
        aria-live="polite"
      >
        {isLoading ? (
          <ChatSkeleton />
        ) : messages.length === 0 ? (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-ink-soft">
            <p>
              Belum ada pesan.
              <br />
              {state?.canSend ? 'Mulai dengan sapaan singkat — pelan-pelan saja.' : state?.reason}
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user?.id;
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
                <div className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div
                    className={clsx(
                      'max-w-[82%] animate-rise whitespace-pre-wrap break-words text-[14.5px] leading-relaxed sm:max-w-[70%]',
                      m.attachment && m.attachment.kind !== 'document' ? 'p-1.5 pb-1' : 'px-3.5 py-2',
                      mine
                        ? 'rounded-[20px] rounded-br-[6px] bg-sky-600 text-white'
                        : 'rounded-[20px] rounded-bl-[6px] border border-line bg-white text-ink',
                    )}
                  >
                    {m.attachment && <AttachmentView a={m.attachment} mine={mine} />}
                    {m.body}
                    <span className={clsx('ml-2 inline-flex translate-y-[2px] items-center gap-0.5 text-[10.5px]', mine ? 'text-white/70' : 'text-ink-faint')}>
                      {fmtTime(m.createdAt)}
                      {mine && (m.readAt ? <CheckCheck size={13} /> : <Check size={13} />)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {sendFile.isPending && (
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12.5px] text-ink-soft ring-1 ring-line">
              <Spinner className="h-3.5 w-3.5" /> Mengirim file…
            </span>
          </div>
        )}
      </div>

      {state?.canSend ? (
        <form onSubmit={submit} className="flex items-end gap-2 border-t border-line bg-white p-3 sm:px-4">
          <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          <button
            type="button"
            className="btn btn-ghost h-11 w-11 shrink-0 px-0"
            onClick={() => fileRef.current?.click()}
            disabled={sendFile.isPending || quotaFull}
            aria-label={quotaFull ? `Batas ${quota!.max} file per sesi chat sudah tercapai` : `Lampirkan foto, video, atau dokumen (maks. ${maxMB} MB)`}
            title={quotaFull ? `Batas ${quota!.max} file per sesi chat sudah tercapai` : `Lampirkan foto, video, atau dokumen (maks. ${maxMB} MB${quota ? ` · ${quota.used}/${quota.max} file` : ''})`}
          >
            <Paperclip size={18} />
          </button>
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder="Tulis pesan…"
            className="input max-h-36 min-h-[44px] flex-1 resize-none py-2.5 leading-snug [field-sizing:content]"
            aria-label="Tulis pesan"
            maxLength={4000}
          />
          <button type="submit" className="btn btn-primary h-11 w-11 shrink-0 px-0" disabled={!text.trim() || send.isPending} aria-label="Kirim">
            <SendHorizontal size={18} />
          </button>
        </form>
      ) : (
        state && (
          <div className="flex items-center justify-center gap-2 border-t border-line bg-canvas px-4 py-3.5 text-[13px] text-ink-soft">
            <Lock size={14} /> {state.reason}
          </div>
        )
      )}
    </div>
  );
}

function AttachmentView({ a, mine }: { a: Attachment; mine: boolean }) {
  if (a.kind === 'image') {
    return (
      <a href={a.url} target="_blank" rel="noreferrer" className="block">
        <img src={a.url} alt={a.name} loading="lazy" className="max-h-72 w-full rounded-[15px] bg-canvas object-cover" />
      </a>
    );
  }
  if (a.kind === 'video') {
    return <video src={a.url} controls playsInline preload="metadata" className="max-h-72 w-full rounded-[15px] bg-black" />;
  }
  return (
    <a
      href={`${a.url}?download`}
      download={a.name}
      className={clsx(
        'my-0.5 flex min-w-[200px] items-center gap-3 rounded-xl px-2.5 py-2 no-underline',
        mine ? 'bg-white/15 hover:bg-white/25' : 'bg-canvas hover:bg-sky-50',
      )}
    >
      <FileText size={26} className={clsx('shrink-0', mine ? 'text-white' : 'text-sky-600')} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold leading-tight">{a.name}</span>
        <span className={clsx('text-[12px]', mine ? 'text-white/75' : 'text-ink-faint')}>
          {attachmentExt(a.name).toUpperCase()} · {fmtBytes(a.size)}
        </span>
      </span>
      <Download size={17} className="shrink-0 opacity-80" />
    </a>
  );
}

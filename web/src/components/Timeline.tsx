import clsx from 'clsx';
import { fmtDate } from '@/lib/format';
import type { TicketEvent } from '@/lib/types';
import { ROLE_LABEL } from '@shared/constants';

const TONE: Record<string, string> = {
  created: 'bg-sun-500',
  scheduled: 'bg-sky-500',
  rescheduled: 'bg-sky-500',
  reschedule_requested: 'bg-peach-500',
  reschedule_rejected: 'bg-peach-500',
  started: 'bg-mint-500',
  completed: 'bg-mint-500',
  reviewed: 'bg-sun-500',
  cancelled: 'bg-coral-500',
};

export function Timeline({ events, hideActors }: { events: TicketEvent[]; hideActors?: boolean }) {
  const list = [...events].reverse();
  return (
    <ol className="relative">
      {list.map((e, i) => (
        <li key={e.id} className="relative flex gap-3.5 pb-5 last:pb-0">
          {i < list.length - 1 && <span className="absolute left-[5px] top-4 h-[calc(100%-8px)] w-px bg-line" />}
          <span
            className={clsx(
              'relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full',
              i === 0 ? TONE[e.type] ?? 'bg-sky-500' : 'border-2 border-line bg-white',
            )}
          />
          <div className="min-w-0">
            <p className={clsx('text-sm', i === 0 ? 'font-medium text-ink' : 'text-ink-soft')}>{e.message}</p>
            <p className="mt-0.5 text-[12px] text-ink-faint">
              {fmtDate(e.createdAt, "d MMM yyyy, HH.mm")}
              {!hideActors && e.actorName && ` · ${e.actorName}${e.actorRole ? ` (${ROLE_LABEL[e.actorRole].toLowerCase()})` : ''}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

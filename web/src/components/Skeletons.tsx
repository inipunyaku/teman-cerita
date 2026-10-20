import clsx from 'clsx';
import { Sk } from './ui';

/** Kerangka loading per halaman — bentuknya meniru konten asli supaya transisinya tenang. */

function Wrap({ children, className, label = 'Memuat…' }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <div className={clsx('animate-rise', className)} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function HeaderSkeleton({ actions }: { actions?: boolean }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
      <div className="w-full max-w-md space-y-3">
        <Sk className="h-8 w-2/3" />
        <Sk className="h-4 w-full" />
      </div>
      {actions && <Sk className="hidden h-11 w-36 rounded-xl sm:block" />}
    </div>
  );
}

/** Daftar kartu (pendaftaran, data pekerja, dsb). */
export function ListSkeleton({ rows = 4, avatar, header = true }: { rows?: number; avatar?: boolean; header?: boolean }) {
  return (
    <Wrap>
      {header && <HeaderSkeleton actions />}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="card flex items-center gap-4 p-4 sm:p-5" style={{ opacity: 1 - i * 0.12 }}>
            {avatar && <Sk className="h-11 w-11 shrink-0 rounded-full" />}
            <div className="flex-1 space-y-2.5">
              <div className="flex gap-2">
                <Sk className="h-4 w-24" />
                <Sk className="h-4 w-20 rounded-full" />
              </div>
              <Sk className="h-4 w-1/2" />
              <Sk className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/** Tabel (antrean admin, sesi psikolog). */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Wrap>
      <div className="card overflow-hidden">
        <div className="hidden gap-4 border-b border-line bg-canvas/60 px-5 py-3.5 lg:flex">
          {[28, 20, 14, 22, 12].map((w, i) => <Sk key={i} className="h-3" style={{ width: `${w}%` }} />)}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-0 lg:flex-row lg:items-center lg:gap-4" style={{ opacity: 1 - i * 0.1 }}>
            <div className="space-y-2 lg:w-[28%]"><Sk className="h-4 w-28" /><Sk className="h-3 w-36" /></div>
            <div className="flex items-center gap-2.5 lg:w-[20%]"><Sk className="h-8 w-8 rounded-full" /><Sk className="h-4 w-28" /></div>
            <Sk className="hidden h-4 lg:block lg:w-[14%]" />
            <div className="space-y-2 lg:w-[22%]"><Sk className="h-4 w-32" /><Sk className="h-3 w-24" /></div>
            <Sk className="h-6 w-24 rounded-full lg:ml-auto" />
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/** Beranda pekerja: kartu tiket aktif + panduan. */
export function HomeSkeleton() {
  return (
    <Wrap className="mt-6 space-y-4">
      <div className="card space-y-3 p-5 sm:p-6">
        <Sk className="h-3 w-28" />
        <div className="flex gap-2"><Sk className="h-6 w-28 rounded-full" /><Sk className="h-6 w-16 rounded-full" /></div>
        <Sk className="h-5 w-56" />
        <Sk className="h-4 w-44" />
      </div>
      <div className="card space-y-4 p-5 sm:p-6">
        <Sk className="h-5 w-32" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3.5"><Sk className="h-8 w-8 rounded-full" /><div className="flex-1 space-y-2"><Sk className="h-4 w-24" /><Sk className="h-3 w-4/5" /></div></div>
        ))}
      </div>
    </Wrap>
  );
}

export function ChatSkeleton() {
  return (
    <div className="space-y-3 py-2" aria-hidden>
      {[['w-3/5', false], ['w-2/5', true], ['w-1/2', false], ['w-1/3', true]].map(([w, mine], i) => (
        <div key={i} className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
          <Sk className={clsx('h-12 rounded-[20px]', w as string, mine ? 'rounded-br-[6px]' : 'rounded-bl-[6px]')} />
        </div>
      ))}
    </div>
  );
}

/** Detail tiket/sesi: kartu kepala, kolom info, dan panel chat. */
export function DetailSkeleton({ chat = true }: { chat?: boolean }) {
  return (
    <Wrap>
      <Sk className="mb-5 h-4 w-24" />
      <div className="card flex items-center gap-4 p-5 sm:p-6">
        <Sk className="h-12 w-12 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2.5"><Sk className="h-5 w-48" /><Sk className="h-4 w-64 max-w-full" /></div>
        <Sk className="hidden h-11 w-36 rounded-xl sm:block" />
      </div>
      <div className={clsx('mt-6 grid gap-6', chat && 'lg:grid-cols-[1fr_minmax(0,440px)]')}>
        <div className="space-y-4">
          <div className="card space-y-4 p-5 sm:p-6">
            <div className="flex gap-2"><Sk className="h-6 w-24 rounded-full" /><Sk className="h-6 w-20 rounded-full" /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Sk className="h-3 w-16" /><Sk className="h-5 w-40" /></div><div className="space-y-2"><Sk className="h-3 w-16" /><Sk className="h-5 w-32" /></div></div>
          </div>
          <div className="card space-y-3 p-5 sm:p-6"><Sk className="h-3 w-32" /><Sk className="h-4 w-full" /><Sk className="h-4 w-4/5" /></div>
          <div className="card space-y-4 p-5 sm:p-6">
            <Sk className="h-5 w-24" />
            {[0, 1, 2].map((i) => <div key={i} className="flex gap-3"><Sk className="mt-1 h-3 w-3 rounded-full" /><div className="flex-1 space-y-2"><Sk className="h-4 w-3/4" /><Sk className="h-3 w-28" /></div></div>)}
          </div>
        </div>
        {chat && (
          <div className="card flex h-[480px] flex-col overflow-hidden">
            <div className="flex items-center gap-3 border-b border-line px-5 py-3"><Sk className="h-9 w-9 rounded-full" /><Sk className="h-4 w-32" /></div>
            <div className="flex-1 px-5 py-4"><ChatSkeleton /></div>
            <div className="border-t border-line p-3"><Sk className="h-11 w-full rounded-xl" /></div>
          </div>
        )}
      </div>
    </Wrap>
  );
}

function StatTileSk() {
  return (
    <div className="card space-y-3 p-5 sm:p-6">
      <Sk className="h-3.5 w-24" />
      <Sk className="h-10 w-16" />
    </div>
  );
}

/** Beranda psikolog. */
export function PsychDashboardSkeleton() {
  return (
    <Wrap>
      <div className="mb-8 space-y-3"><Sk className="h-4 w-28" /><Sk className="h-9 w-80 max-w-full" /></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <StatTileSk key={i} />)}</div>
      <Sk className="mt-6 h-[92px] w-full rounded-3xl" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="card flex gap-4 p-5"><Sk className="h-10 w-14" /><div className="flex-1 space-y-2"><Sk className="h-5 w-28 rounded-full" /><Sk className="h-4 w-40" /><Sk className="h-3 w-52" /></div></div>)}</div>
        <div className="card space-y-1 p-2">{[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-3 p-3"><Sk className="h-9 w-9 rounded-full" /><div className="flex-1 space-y-2"><Sk className="h-4 w-32" /><Sk className="h-3 w-24" /></div></div>)}</div>
      </div>
    </Wrap>
  );
}

/** Statistik admin. */
export function StatsSkeleton() {
  return (
    <Wrap className="space-y-4" label="Memuat statistik…">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <StatTileSk key={i} />)}</div>
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="card p-5 sm:p-6"><Sk className="h-5 w-32" /><div className="mt-6 flex h-[220px] items-end gap-3">{[40, 55, 48, 70, 62, 85].map((h, i) => <Sk key={i} className="flex-1 rounded-md" style={{ height: `${h}%` }} />)}</div></div>
        <div className="card space-y-4 p-5 sm:p-6"><Sk className="h-5 w-36" /><Sk className="h-10 w-full rounded-md" />{[0, 1, 2, 3].map((i) => <Sk key={i} className="h-4 w-full" />)}</div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((c) => <div key={c} className="card space-y-4 p-5 sm:p-6"><Sk className="h-5 w-48" />{[90, 75, 60, 45, 30].map((w, i) => <div key={i} className="space-y-1.5"><Sk className="h-3.5 w-1/3" /><Sk className="h-2 rounded-full" style={{ width: `${w}%` }} /></div>)}</div>)}
      </div>
    </Wrap>
  );
}

/** Kartu grid (psikolog di halaman staf). */
export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Wrap className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card space-y-4 p-5 sm:p-6">
          <div className="flex gap-3"><Sk className="h-12 w-12 rounded-full" /><div className="flex-1 space-y-2"><Sk className="h-4 w-32" /><Sk className="h-3 w-24" /></div></div>
          <Sk className="h-3 w-full" />
          <div className="grid grid-cols-3 gap-2 border-t border-line pt-4">{[0, 1, 2].map((j) => <Sk key={j} className="mx-auto h-7 w-8" />)}</div>
        </div>
      ))}
    </Wrap>
  );
}

export function NotificationSkeleton() {
  return (
    <div className="divide-y divide-line" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 px-5 py-3.5">
          <Sk className="mt-1.5 h-2 w-2 rounded-full" />
          <div className="flex-1 space-y-2"><Sk className="h-4 w-3/5" /><Sk className="h-3 w-full" /><Sk className="h-3 w-16" /></div>
        </div>
      ))}
    </div>
  );
}

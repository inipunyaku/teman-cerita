import React, { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Loader2, MapPin, MessageCircle, Video, X } from 'lucide-react';
import {
  MODE_LABEL,
  OUTCOME_LABEL,
  SCREENING_LEVEL_LABEL,
  TICKET_STATUS_LABEL,
  type Mode,
  type Outcome,
  type ScreeningLevel,
  type TicketStatus,
} from '@shared/constants';
import { LogoMark } from './Brand';

// ---------------------------------------------------------------------------
// Merek

// Logo diambil dari aset logo-teman-cerita.png — lihat Brand.tsx.
export { Logo, LogoMark } from './Brand';

/** Awan dekoratif untuk latar halaman. */
export function Clouds({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 260" className={className} aria-hidden fill="none">
      <defs>
        <linearGradient id="cloudA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".75" stopColor="#F0F8FE" />
          <stop offset="1" stopColor="#FBEFE7" />
        </linearGradient>
        <linearGradient id="cloudB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#DBF0FE" />
          <stop offset="1" stopColor="#fff" stopOpacity=".6" />
        </linearGradient>
      </defs>
      <path
        d="M70 210c-33 0-56-22-56-50 0-26 20-47 46-49 9-38 43-64 83-64 33 0 61 18 75 45 7-2 14-3 22-3 39 0 70 30 70 68s-31 53-70 53H70z"
        fill="url(#cloudB)"
        opacity=".9"
      />
      <path
        d="M300 236c-28 0-48-19-48-43 0-22 16-40 38-43 8-33 37-56 72-56 28 0 52 15 64 38 6-2 12-2 19-2 34 0 60 26 60 58s-26 48-60 48H300z"
        fill="url(#cloudA)"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Status

const STATUS_STYLE: Record<TicketStatus, { chip: string; dot: string }> = {
  scheduled: { chip: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
  in_progress: { chip: 'bg-mint-50 text-mint-700', dot: 'bg-mint-500 animate-pulseDot' },
  awaiting_report: { chip: 'bg-sun-50 text-sun-700', dot: 'bg-sun-500' },
  completed: { chip: 'bg-mint-50 text-mint-700', dot: 'bg-mint-500' },
  no_show: { chip: 'bg-[#EDF2F6] text-[#3E5566]', dot: 'bg-ink-faint' },
  cancelled: { chip: 'bg-coral-50 text-coral-700', dot: 'bg-coral-500' },
};

export function StatusChip({ status, className }: { status: TicketStatus; className?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={clsx('chip', s.chip, className)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', s.dot)} />
      {TICKET_STATUS_LABEL[status]}
    </span>
  );
}

export const OUTCOME_STYLE: Record<Outcome, { chip: string; color: string }> = {
  terminasi: { chip: 'bg-mint-50 text-mint-700', color: '#17B4A4' },
  lanjutan: { chip: 'bg-sky-100 text-sky-700', color: '#2BA9EF' },
  referral: { chip: 'bg-[#EEEAFB] text-[#5B4B9A]', color: '#8B7BD8' },
  no_show: { chip: 'bg-[#EDF2F6] text-[#3E5566]', color: '#8AA0B0' },
};

export function OutcomeChip({ outcome }: { outcome: Outcome }) {
  return (
    <span className={clsx('chip', OUTCOME_STYLE[outcome].chip)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: OUTCOME_STYLE[outcome].color }} />
      {OUTCOME_LABEL[outcome]}
    </span>
  );
}

export const SCREENING_STYLE: Record<ScreeningLevel, { chip: string; color: string }> = {
  rendah: { chip: 'bg-mint-50 text-mint-700', color: '#17B4A4' },
  sedang: { chip: 'bg-sun-50 text-sun-700', color: '#E8A317' },
  tinggi: { chip: 'bg-coral-50 text-coral-700', color: '#E8604C' },
};

export function ScreeningChip({ level, score }: { level: string; score?: number }) {
  const l = (level in SCREENING_STYLE ? level : 'sedang') as ScreeningLevel;
  return (
    <span className={clsx('chip', SCREENING_STYLE[l].chip)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: SCREENING_STYLE[l].color }} />
      Skrining {SCREENING_LEVEL_LABEL[l].toLowerCase()}
      {score != null && <span className="font-normal opacity-80">· {score}</span>}
    </span>
  );
}

export const MODE_ICON: Record<Mode, typeof MessageCircle> = { chat: MessageCircle, online: Video, offline: MapPin };

export function ModeTag({ mode, className }: { mode: Mode; className?: string }) {
  const Icon = MODE_ICON[mode];
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-[13px] text-ink-soft', className)}>
      <Icon size={15} strokeWidth={1.75} />
      {MODE_LABEL[mode]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Primitif

/** Warna avatar yang bisa dipilih pengguna (kunci disimpan di server). */
export const AVATAR_TONES: Record<string, { label: string; cls: string; swatch: string }> = {
  sky: { label: 'Langit', cls: 'bg-sky-100 text-sky-700', swatch: '#93D6FB' },
  mint: { label: 'Mint', cls: 'bg-mint-50 text-mint-700', swatch: '#7FD8CE' },
  sun: { label: 'Mentari', cls: 'bg-sun-50 text-sun-700', swatch: '#FFD36B' },
  peach: { label: 'Senja', cls: 'bg-haze text-peach-700', swatch: '#F8B98F' },
  lilac: { label: 'Lavender', cls: 'bg-[#EEEAFB] text-[#5B4B9A]', swatch: '#C6BCF2' },
  rose: { label: 'Bunga', cls: 'bg-rose-50 text-rose-700', swatch: '#F2A7BC' },
  ink: { label: 'Malam', cls: 'bg-sky-900 text-sky-100', swatch: '#0B3F60' },
};
const TONE_KEYS = Object.keys(AVATAR_TONES);

export function Avatar({
  name,
  src,
  tone,
  size = 36,
  shape = 'circle',
  className,
}: {
  name: string;
  src?: string | null;
  tone?: string | null;
  size?: number;
  /** rounded = kotak bersudut lembut, mis. foto psikolog di kartu "Sesi terakhir". */
  shape?: 'circle' | 'rounded';
  className?: string;
}) {
  const round = shape === 'rounded' ? 'rounded-[37%]' : 'rounded-full';
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={clsx('shrink-0 object-cover ring-1 ring-black/5', round, className)}
        style={{ width: size, height: size }}
        loading="lazy"
      />
    );
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  const key = tone && AVATAR_TONES[tone] ? tone : TONE_KEYS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 5];
  return (
    <span
      className={clsx('inline-grid shrink-0 place-items-center font-semibold', round, AVATAR_TONES[key].cls, className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin', className)} size={18} />;
}

/** Penanda singkat saat kode halaman sedang diunduh (halaman dimuat terpisah). */
export function PageLoading() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="Memuat halaman">
      <Spinner className="text-sky-600" />
    </div>
  );
}

/** Blok skeleton dengan kilau halus; dipakai untuk menyusun kerangka tiap halaman. */
export function Sk({ className, style }: { className?: string; style?: React.CSSProperties }) {
  // Sudut default hanya bila pemanggil tidak menentukan sendiri (mis. rounded-full untuk avatar).
  return <span aria-hidden className={clsx('skeleton block', !/\brounded/.test(className ?? '') && 'rounded-lg', className)} style={style} />;
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  optional,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (id: string) => ReactNode;
  className?: string;
  optional?: boolean;
}) {
  const id = useId();
  // Kolom wajib yang belum benar: bingkai merah (lihat [data-invalid] di index.css) & dibaca pembaca layar.
  useEffect(() => {
    const el = document.getElementById(id);
    if (!el) return;
    if (error) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
  }, [id, error]);
  return (
    <div className={className} data-invalid={error ? '' : undefined}>
      <label htmlFor={id} className="label">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-faint">(opsional)</span>}
      </label>
      {children(id)}
      {error ? <p className="err">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px] lg:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex flex-col items-center px-6 py-12 text-center', className)}>
      <LogoMark className="mb-4 h-14" />
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={clsx(
          'relative flex max-h-[92dvh] w-full animate-rise flex-col rounded-t-4xl bg-white shadow-pop sm:rounded-4xl',
          size === 'xl' ? 'sm:max-w-6xl' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-7 sm:pt-6">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm -mr-2 -mt-1 w-9 px-0" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <div className="scrollbar-thin overflow-y-auto px-5 py-3 sm:px-7">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:px-7">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Kartu pilihan (radio/checkbox) bergaya. */
export function ChoiceCard({
  selected,
  onClick,
  icon,
  title,
  description,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        'relative flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors',
        selected ? 'border-sky-500 bg-sky-50' : 'border-line bg-white hover:border-sky-200',
        className,
      )}
    >
      {icon && (
        <span
          className={clsx(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
            selected ? 'bg-sky-500 text-white' : 'bg-sky-50 text-sky-700',
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">{description}</span>}
      </span>
      <span
        className={clsx(
          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
          selected ? 'border-sky-500 bg-sky-500' : 'border-line',
        )}
      >
        {selected && (
          <svg viewBox="0 0 12 12" className="h-3 w-3 text-white">
            <path d="m2.5 6.2 2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </button>
  );
}

/** Tombol segmen kecil (filter rentang, tab). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={clsx('inline-flex rounded-xl border border-line bg-white p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'h-8 whitespace-nowrap rounded-[10px] px-3 text-[13px] font-semibold transition-colors',
            value === o.value ? 'bg-sky-600 text-white' : 'text-ink-soft hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'sky' | 'sun' | 'coral' | 'mint';
}) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-2 text-[13px] text-ink-soft">
        {tone && (
          <span
            className={clsx('h-2 w-2 rounded-full', {
              'bg-sky-500': tone === 'sky',
              'bg-sun-500': tone === 'sun',
              'bg-coral-500': tone === 'coral',
              'bg-mint-500': tone === 'mint',
            })}
          />
        )}
        {label}
      </div>
      <div className="display mt-2 text-[40px] tabular-nums lg:text-[28px] text-ink">{value}</div>
      {hint && <div className="mt-1 text-[12.5px] text-ink-faint">{hint}</div>}
    </div>
  );
}

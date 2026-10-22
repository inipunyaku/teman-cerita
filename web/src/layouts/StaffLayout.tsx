import { Suspense, useEffect, useRef, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Menu, X, type LucideProps } from 'lucide-react';
import { Logo, PageLoading } from '@/components/ui';
import { NotificationBell } from '@/components/NotificationBell';
import { useAutoHideHeader, useKeyboardOpen, useMediaQuery } from '@/lib/viewport';
import { UserMenu } from './UserMenu';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<LucideProps>;
  end?: boolean;
  badge?: number;
}

export function StaffLayout({ nav, profilePath, label }: { nav: NavItem[]; profilePath: string; label: string }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const headerRef = useRef<HTMLElement>(null);
  const mobile = useMediaQuery('(max-width: 1023px)');
  // Di layar kecil: header bersembunyi bila didiamkan, dan saat keyboard terbuka.
  const keyboard = useKeyboardOpen() && mobile;
  const idle = useAutoHideHeader(headerRef, { enabled: mobile && !open, resetKey: loc.pathname });

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo />
        <button className="btn btn-ghost w-10 px-0 lg:hidden" onClick={() => setOpen(false)} aria-label="Tutup menu">
          <X size={20} />
        </button>
      </div>
      <div className="px-5 pb-2 pt-3">
        <span className="eyebrow">{label}</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              clsx(
                'group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',
                isActive ? 'bg-white text-sky-800 shadow-soft ring-1 ring-line' : 'text-ink-soft hover:bg-white/70 hover:text-ink',
              )
            }
          >
            <n.icon size={19} strokeWidth={1.75} />
            <span className="flex-1">{n.label}</span>
            {!!n.badge && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-coral-500 px-1.5 text-[11px] font-bold text-white">{n.badge}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <UserMenu profilePath={profilePath} direction="up" full />
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-[248px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line bg-sky-50/60 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] animate-rise bg-[#F3F9FE] shadow-pop">{sidebar}</aside>
        </div>
      )}
      <header
        ref={headerRef}
        className={clsx(
          'sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line/70 bg-canvas/85 px-4 backdrop-blur-md transition-transform duration-300 ease-out sm:px-6',
          (idle || keyboard) && '-translate-y-full',
        )}
      >
        <div className="flex items-center gap-2 lg:hidden">
          <button className="btn btn-ghost w-10 px-0" onClick={() => setOpen(true)} aria-label="Buka menu">
            <Menu size={20} />
          </button>
          <Logo />
        </div>
        <div className="hidden lg:block" />
        <NotificationBell />
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

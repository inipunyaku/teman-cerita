import { Suspense, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Calendar, ClipboardList, House, UserRound } from 'lucide-react';
import { Logo, PageLoading } from '@/components/ui';
import { NotificationBell } from '@/components/NotificationBell';
import { useAutoHideHeader, useKeyboardOpen, useMediaQuery } from '@/lib/viewport';
import { UserMenu } from './UserMenu';

const NAV = [
  { to: '/', label: 'Beranda', icon: House, stroke: 1.75, end: true },
  { to: '/buat-janji', label: 'Buat janji', icon: Calendar, stroke: 2 },
  { to: '/pendaftaran', label: 'Pendaftaran', icon: ClipboardList, stroke: 2 },
  { to: '/profil', label: 'Profil', icon: UserRound, stroke: 2 },
];

export function EmployeeLayout() {
  const { pathname } = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const mobile = useMediaQuery('(max-width: 639px)');
  // Di HP: header bersembunyi bila didiamkan; header & menu bawah disembunyikan saat keyboard terbuka.
  const keyboard = useKeyboardOpen() && mobile;
  const idle = useAutoHideHeader(headerRef, { enabled: mobile, resetKey: pathname });
  return (
    <div className={clsx('min-h-dvh sm:pb-10', keyboard ? 'pb-4' : 'pb-24')}>
      <header
        ref={headerRef}
        className={clsx(
          'sticky top-0 z-30 border-b border-line bg-white/80 backdrop-blur-md transition-transform duration-300 ease-out',
          (idle || keyboard) && '-translate-y-full',
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-[72px] sm:px-6">
          <NavLink to="/" aria-label="Beranda">
            <Logo />
          </NavLink>
          <nav className="hidden items-center gap-1.5 sm:flex">
            {NAV.slice(0, 3).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 rounded-xl border px-3.5 py-[9px] text-sm font-semibold leading-normal transition-colors',
                    isActive ? 'border-sky-100 bg-sky-50 text-brand' : 'border-transparent text-ink-soft hover:text-ink',
                  )
                }
              >
                <n.icon size={18} strokeWidth={n.stroke} absoluteStrokeWidth />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2.5">
            <NotificationBell />
            <UserMenu profilePath="/profil" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
      <nav className={clsx('pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur-md sm:hidden', keyboard && 'hidden')}>
        <div className="grid grid-cols-4">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx('flex flex-col items-center gap-1 py-2.5 text-[11.5px] font-semibold', isActive ? 'text-sky-700' : 'text-ink-faint')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={clsx('grid h-8 w-12 place-items-center rounded-full transition-colors', isActive && 'bg-sky-100')}>
                    <n.icon size={20} strokeWidth={1.75} />
                  </span>
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { House, PlusCircle, UserRound } from 'lucide-react';
import { TalkIcon } from '@/components/icons';
import { Logo } from '@/components/ui';
import { NotificationBell } from '@/components/NotificationBell';
import { UserMenu } from './UserMenu';

const NAV = [
  { to: '/', label: 'Beranda', icon: House, end: true },
  { to: '/buat-janji', label: 'Buat janji', icon: PlusCircle },
  { to: '/pendaftaran', label: 'Pendaftaran', icon: TalkIcon },
  { to: '/profil', label: 'Profil', icon: UserRound },
];

export function EmployeeLayout() {
  return (
    <div className="min-h-dvh pb-24 sm:pb-10">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <NavLink to="/" aria-label="Beranda">
            <Logo />
          </NavLink>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.slice(0, 3).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  clsx('rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors', isActive ? 'bg-sky-100 text-sky-800' : 'text-ink-soft hover:text-ink')
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <UserMenu profilePath="/profil" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10">
        <Outlet />
      </main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur-md sm:hidden">
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

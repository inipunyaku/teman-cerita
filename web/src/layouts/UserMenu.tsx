import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { LogOut, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/ui';
import { ROLE_LABEL } from '@shared/constants';

export function UserMenu({ profilePath, direction = 'down', full }: { profilePath: string; direction?: 'down' | 'up'; full?: boolean }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  if (!user) return null;
  return (
    <div className={clsx('relative', full && 'w-full')} ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex items-center gap-2.5 rounded-2xl text-left transition-colors hover:bg-sky-50',
          full ? 'w-full p-2' : 'p-1',
        )}
        aria-expanded={open}
        aria-label="Menu akun"
      >
        <Avatar name={user.name} src={user.avatarUrl} tone={user.avatarTone} size={34} />
        {full && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{user.name}</span>
            <span className="block truncate text-[12px] text-ink-faint">{user.statusText || ROLE_LABEL[user.role]}</span>
          </span>
        )}
      </button>
      {open && (
        <div
          className={clsx(
            'absolute z-40 w-56 animate-rise overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-pop',
            direction === 'up' ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-2',
          )}
        >
          <div className="px-3 py-2">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="truncate text-[12px] text-ink-faint">{user.email}</div>
          </div>
          <Link to={profilePath} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-sky-50">
            <UserRound size={16} /> Profil & keamanan
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              void logout();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-coral-700 hover:bg-coral-50"
          >
            <LogOut size={16} /> Keluar
          </button>
        </div>
      )}
    </div>
  );
}

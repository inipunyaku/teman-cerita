import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from './api';
import type { User } from './types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ user: User | null }>('/auth/me'),
    staleTime: 60_000,
  });
  const setUser = useCallback((u: User | null) => qc.setQueryData(['me'], { user: u }), [qc]);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    // Kosongkan status login lebih dulu (observer 'me' tetap tersambung),
    // baru buang data lain supaya tidak ada sisa data akun sebelumnya.
    qc.setQueryData(['me'], { user: null });
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    navigate('/masuk', { replace: true });
  }, [qc, navigate]);

  return (
    <Ctx.Provider value={{ user: data?.user ?? null, loading: isLoading, setUser, logout }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth di luar AuthProvider');
  return c;
}

export const homeFor = (u: User) => (u.role === 'admin' ? '/admin' : u.role === 'psychologist' ? '/psikolog' : '/');

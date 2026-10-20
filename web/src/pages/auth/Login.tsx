import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { api, errMsg } from '@/lib/api';
import { homeFor, useAuth } from '@/lib/auth';
import type { User } from '@/lib/types';
import { Field, Spinner } from '@/components/ui';
import { AuthLayout } from '@/layouts/AuthLayout';
import { useWelcomeSplash } from '@/components/WelcomeSplash';
import logo from '@/assets/auth/logo-brilian.png';

const DEMO = [
  { label: 'Pekerja', id: '90001234' },
  { label: 'Psikolog', id: 'psikolog@temancerita.id' },
  { label: 'Admin', id: 'admin@temancerita.id' },
];

export default function Login() {
  const { setUser } = useAuth();
  const splash = useWelcomeSplash();
  const navigate = useNavigate();
  const loc = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);

  const login = useMutation({
    mutationFn: (body: { identifier: string; password: string }) => api.post<{ user: User }>('/auth/login', body),
    onSuccess: ({ user }) => {
      // Sambutan menutupi layar sementara halaman utama dimuat di belakangnya.
      splash.show(user);
      setUser(user);
      const from = (loc.state as { from?: string } | null)?.from;
      navigate(from && from !== '/masuk' ? from : homeFor(user), { replace: true });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ identifier, password });
  };

  return (
    <AuthLayout>
      <div className="text-center">
        <img src={logo} alt="Teman Cerita BRILiaN" width={100} height={115} className="mx-auto h-[115px] w-[100px] object-contain" />
        <h1 className="mt-3 text-[30px] font-semibold leading-tight tracking-tight">
          Hai, senang <span className="display italic text-sky-600">ketemu</span> lagi.
        </h1>
        <p className="mt-2 text-ink-soft">Masuk pakai email atau PN kamu.</p>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Email atau PN">
          {(id) => (
            <input
              id={id}
              className="input"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="nama@kantor.co.id atau 90001234"
              required
            />
          )}
        </Field>
        <Field label="Password">
          {(id) => (
            <div className="relative">
              <input id={id} type={show ? 'text' : 'password'} className="input pr-11" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:text-ink" aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}>
                {show ? <EyeOff size={18} strokeWidth={2.33} /> : <Eye size={18} strokeWidth={2.33} />}
              </button>
            </div>
          )}
        </Field>
        {login.error && <p className="rounded-xl bg-coral-50 px-3.5 py-2.5 text-sm font-medium text-coral-700">{errMsg(login.error)}</p>}
        <button className="btn btn-primary w-full" disabled={login.isPending}>
          {login.isPending && <Spinner />} Masuk
        </button>
      </form>

      {/* Ruang kosong di bawah tombol sesuai desain; akun demo hanya tampil saat pengembangan. */}
      <div className="min-h-[45px] pt-6">
        {import.meta.env.DEV && (
          <div className="rounded-3xl border border-dashed border-sky-200 bg-sky-50/50 p-4">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow text-sky-700/80">Akun demo</span>
              <span className="text-[12px] text-ink-faint">password: demo1234</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  disabled={login.isPending}
                  onClick={() => {
                    setIdentifier(d.id);
                    setPassword('demo1234');
                    login.mutate({ identifier: d.id, password: 'demo1234' });
                  }}
                  className="btn btn-secondary btn-sm rounded-xl"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

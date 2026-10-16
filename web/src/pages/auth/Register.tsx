import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { api, ApiError, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { User } from '@/lib/types';
import { Spinner } from '@/components/ui';
import { AuthLayout } from '@/layouts/AuthLayout';
import { useWelcomeSplash } from '@/components/WelcomeSplash';
import { EmployeeFields, type EmployeeData } from './EmployeeForm';

export default function Register() {
  const { setUser } = useAuth();
  const splash = useWelcomeSplash();
  const navigate = useNavigate();
  const [data, setData] = useState<EmployeeData>({ name: '', pn: '', email: '', phone: '', unitId: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});

  const register = useMutation({
    mutationFn: () => api.post<{ user: User }>('/auth/register', { ...data, unitId: Number(data.unitId) }),
    onSuccess: ({ user }) => {
      splash.show(user, 'Selamat datang');
      setUser(user);
      navigate('/', { replace: true });
    },
    onError: (e) => setErrors(e instanceof ApiError ? ((e.data.fields as typeof errors) ?? {}) : {}),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (data.password !== data.confirm) return setErrors({ confirm: ['Password tidak sama.'] });
    setErrors({});
    register.mutate();
  };

  return (
    <AuthLayout>
      <h1 className="text-[30px] font-semibold leading-tight tracking-tight">
        Buat akun <span className="display italic text-sky-600">Teman Cerita</span>
      </h1>
      <p className="mt-2 text-ink-soft">Admin akan memverifikasi data kepegawaianmu sebelum kamu bisa mengajukan sesi.</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <EmployeeFields data={data} set={(p) => setData((d) => ({ ...d, ...p }))} errors={errors} />
        {register.error && !Object.keys(errors).length && (
          <p className="rounded-xl bg-coral-50 px-3.5 py-2.5 text-sm font-medium text-coral-700">{errMsg(register.error)}</p>
        )}
        <div className="flex gap-2.5 rounded-2xl bg-mint-50 px-4 py-3 text-[13px] leading-relaxed text-mint-700">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          Data akunmu hanya dipakai untuk verifikasi dan penjadwalan. Isi sesi konseling tidak dibagikan ke atasan atau unit kerjamu.
        </div>
        <button className="btn btn-primary w-full" disabled={register.isPending}>
          {register.isPending && <Spinner />} Daftar
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        Sudah punya akun? <Link to="/masuk" className="link">Masuk</Link>
      </p>
    </AuthLayout>
  );
}

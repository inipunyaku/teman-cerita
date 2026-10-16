import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Clock3, LogOut, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { firstName, fmtDate } from '@/lib/format';
import type { User } from '@/lib/types';
import { Clouds, Logo, Spinner } from '@/components/ui';
import { EmployeeFields, type EmployeeData } from './EmployeeForm';

export default function VerificationStatus() {
  const { user, setUser, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState<EmployeeData>({
    name: user!.name, pn: user!.pn ?? '', email: user!.email, phone: user!.phone ?? '', unitId: String(user!.unitId ?? ''), password: '', confirm: '',
  });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const resubmit = useMutation({
    mutationFn: () => api.post<{ user: User }>('/auth/resubmit', { name: data.name, pn: data.pn, phone: data.phone, unitId: Number(data.unitId) }),
    onSuccess: ({ user }) => {
      setUser(user);
      setEditing(false);
      toast.success('Data terkirim. Admin akan memeriksanya kembali.');
    },
    onError: (e) => {
      setErrors(e instanceof ApiError ? ((e.data.fields as typeof errors) ?? {}) : {});
      toast.error(errMsg(e));
    },
  });
  const rejected = user!.status === 'rejected';

  return (
    <div className="grain relative min-h-dvh overflow-hidden bg-gradient-to-b from-sky-50 to-canvas">
      <Clouds className="pointer-events-none absolute -right-32 top-10 w-[560px] animate-drift opacity-70" />
      <div className="relative mx-auto max-w-xl px-4 py-8 sm:py-14">
        <div className="mb-12 flex items-center justify-between">
          <Logo />
          <button onClick={() => logout()} className="btn btn-ghost btn-sm">
            <LogOut size={16} /> Keluar
          </button>
        </div>

        {!rejected ? (
          <div className="animate-rise">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-sun-50 text-sun-700">
              <Clock3 size={26} strokeWidth={1.75} />
            </span>
            <h1 className="mt-6 text-[32px] font-semibold leading-tight tracking-tight">
              Sebentar ya, <span className="display italic text-sky-600">{firstName(user!.name)}</span>.
            </h1>
            <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">
              Akunmu sedang diverifikasi admin. Begitu selesai, kamu akan dapat notifikasi di sini dan lewat email, lalu bisa langsung mengajukan sesi.
            </p>
            <dl className="card card-pad mt-8 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-faint">PN</dt><dd className="mt-0.5 font-semibold tabular-nums">{user!.pn}</dd></div>
              <div><dt className="text-ink-faint">Unit kerja</dt><dd className="mt-0.5 font-semibold">{user!.unitName}</dd></div>
              <div><dt className="text-ink-faint">Email</dt><dd className="mt-0.5 font-semibold">{user!.email}</dd></div>
              <div><dt className="text-ink-faint">Didaftarkan</dt><dd className="mt-0.5 font-semibold">{fmtDate(user!.createdAt, 'd MMM yyyy, HH.mm')}</dd></div>
            </dl>
            <p className="mt-6 text-[13px] text-ink-faint">Butuh bantuan segera? Hubungi tim Human Capital di unitmu.</p>
          </div>
        ) : (
          <div className="animate-rise">
            <h1 className="text-[30px] font-semibold leading-tight tracking-tight">Verifikasi belum disetujui</h1>
            <div className="mt-4 rounded-2xl border border-coral-500/20 bg-coral-50 px-4 py-3.5 text-sm text-coral-700">
              <span className="font-semibold">Catatan admin:</span> {user!.rejectReason}
            </div>
            <p className="mt-4 text-ink-soft">Perbaiki datamu lalu ajukan verifikasi ulang.</p>
            {!editing ? (
              <button className="btn btn-primary mt-6" onClick={() => setEditing(true)}>
                <RefreshCw size={16} /> Perbaiki data
              </button>
            ) : (
              <form
                className="card card-pad mt-6 space-y-5"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  resubmit.mutate();
                }}
              >
                <EmployeeFields data={data} set={(p) => setData((d) => ({ ...d, ...p }))} errors={errors} withAccount={false} />
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Batal</button>
                  <button className="btn btn-primary" disabled={resubmit.isPending}>{resubmit.isPending && <Spinner />} Ajukan ulang</button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

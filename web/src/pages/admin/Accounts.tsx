import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, errMsg } from '@/lib/api';
import { fmtDate, fromNow } from '@/lib/format';
import type { User } from '@/lib/types';
import { Avatar, EmptyState, Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { ListSkeleton } from '@/components/Skeletons';
import { ACCOUNT_STATUS_LABEL, type AccountStatus } from '@shared/constants';

const STATUS_CHIP: Record<AccountStatus, string> = {
  pending: 'bg-sun-50 text-sun-700',
  verified: 'bg-mint-50 text-mint-700',
  rejected: 'bg-coral-50 text-coral-700',
  disabled: 'bg-[#EDF2F6] text-[#3E5566]',
};

export default function Accounts() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'pending';
  const [q, setQ] = useState('');
  const [rejecting, setRejecting] = useState<User | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['users', status, q],
    queryFn: () => api.get<{ users: User[] }>(`/admin/users?role=employee${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['admin-overview'] });
  };
  const verify = useMutation({
    mutationFn: (id: number) => api.post(`/admin/users/${id}/verify`),
    onSuccess: () => { toast.success('Akun diverifikasi. Karyawan sudah diberi tahu.'); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => api.post(`/admin/users/${id}/status`, { active }),
    onSuccess: () => { toast.success('Status akun diperbarui.'); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="animate-rise">
      <PageHeader title="Akun karyawan" description="Verifikasi pendaftaran dan kelola akses karyawan." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="scrollbar-thin -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {(['pending', 'verified', 'rejected', 'disabled', ''] as const).map((s) => (
            <button key={s} onClick={() => setParams(s ? { status: s } : { status: '' }, { replace: true })} className={clsx('h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold', status === s ? 'border-sky-600 bg-sky-600 text-white' : 'border-line bg-white text-ink-soft hover:text-ink')}>
              {s ? ACCOUNT_STATUS_LABEL[s] : 'Semua'}
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input className="input pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, email, PN" aria-label="Cari akun" />
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton header={false} avatar />
      ) : !data?.users.length ? (
        <div className="card"><EmptyState title={status === 'pending' ? 'Semua pendaftaran sudah diproses' : 'Tidak ada akun'} /></div>
      ) : (
        <div className="space-y-3">
          {data.users.map((u) => (
            <div key={u.id} className="card flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <Avatar name={u.name} src={u.avatarUrl} tone={u.avatarTone} size={44} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{u.name}</p>
                    <span className={clsx('chip', STATUS_CHIP[u.status])}>{ACCOUNT_STATUS_LABEL[u.status]}</span>
                  </div>
                  <p className="truncate text-[13px] text-ink-soft">{u.email} · {u.phone}</p>
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-4 text-[13px] md:w-[400px]">
                <div><dt className="text-ink-faint">PN</dt><dd className="font-semibold tabular-nums">{u.pn}</dd></div>
                <div><dt className="text-ink-faint">Unit</dt><dd className="font-medium leading-snug">{u.unitName}</dd></div>
                <div><dt className="text-ink-faint">{u.status === 'pending' ? 'Mendaftar' : 'Tiket'}</dt><dd className="font-medium">{u.status === 'pending' ? fromNow(u.createdAt) : u.ticketCount}</dd></div>
              </dl>
              <div className="flex shrink-0 gap-2 md:w-[220px] md:justify-end">
                {u.status === 'pending' && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={() => setRejecting(u)}><X size={15} /> Tolak</button>
                    <button className="btn btn-mint btn-sm" disabled={verify.isPending} onClick={() => verify.mutate(u.id)}><Check size={15} /> Verifikasi</button>
                  </>
                )}
                {u.status === 'verified' && <button className="btn btn-ghost btn-sm" onClick={() => confirm(`Nonaktifkan akun ${u.name}?`) && toggle.mutate({ id: u.id, active: false })}>Nonaktifkan</button>}
                {u.status === 'disabled' && <button className="btn btn-soft btn-sm" onClick={() => toggle.mutate({ id: u.id, active: true })}>Aktifkan lagi</button>}
                {u.status === 'rejected' && <span className="text-[12.5px] text-ink-faint" title={u.rejectReason ?? ''}>Ditolak · {fmtDate(u.createdAt)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {rejecting && <RejectModal user={rejecting} onClose={() => setRejecting(null)} onDone={refresh} />}
    </div>
  );
}

function RejectModal({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => api.post(`/admin/users/${user.id}/reject`, { reason }),
    onSuccess: () => { toast.success('Pendaftaran ditolak. Karyawan bisa memperbaiki data.'); onClose(); onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Modal open onClose={onClose} title={`Tolak pendaftaran ${user.name}?`} description="Alasan akan ditampilkan ke karyawan agar bisa memperbaiki datanya."
      footer={<><button className="btn btn-secondary" onClick={onClose}>Batal</button><button className="btn btn-danger" disabled={reason.trim().length < 5 || m.isPending} onClick={() => m.mutate()}>{m.isPending && <Spinner />} Tolak</button></>}>
      <Field label="Alasan">{(id) => <textarea id={id} className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Misalnya: PN tidak ditemukan di data kepegawaian" />}</Field>
    </Modal>
  );
}

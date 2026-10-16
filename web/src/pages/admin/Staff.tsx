import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Star } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, errMsg } from '@/lib/api';
import type { Psychologist, User } from '@/lib/types';
import { Avatar, Field, Modal, PageHeader, Segmented, Spinner } from '@/components/ui';
import { CardGridSkeleton, ListSkeleton } from '@/components/Skeletons';

type Tab = 'psychologist' | 'admin';
interface StaffForm { id?: number; role: Tab; name: string; email: string; phone: string; title: string; bio: string; password: string }

export default function Staff() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('psychologist');
  const [editing, setEditing] = useState<StaffForm | null>(null);
  const psychs = useQuery({ queryKey: ['psychologists'], queryFn: () => api.get<{ psychologists: Psychologist[] }>('/admin/psychologists') });
  const admins = useQuery({ queryKey: ['users', 'admins'], queryFn: () => api.get<{ users: User[] }>('/admin/users?role=admin'), enabled: tab === 'admin' });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => api.post(`/admin/users/${id}/status`, { active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['psychologists'] }); qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Status diperbarui.'); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const blank: StaffForm = { role: tab, name: '', email: '', phone: '', title: tab === 'psychologist' ? 'M.Psi., Psikolog' : '', bio: '', password: '' };

  return (
    <div className="animate-rise">
      <PageHeader
        title="Psikolog & admin"
        description="Akun staf dibuat oleh admin dan langsung aktif."
        actions={<button className="btn btn-primary" onClick={() => setEditing(blank)}><Plus size={18} /> Tambah {tab === 'psychologist' ? 'psikolog' : 'admin'}</button>}
      />
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'psychologist', label: 'Psikolog' }, { value: 'admin', label: 'Admin' }]} />

      {tab === 'psychologist' ? (
        psychs.isLoading ? <CardGridSkeleton /> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {psychs.data?.psychologists.map((p) => (
              <div key={p.id} className={`card card-pad flex flex-col ${p.status === 'disabled' ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <Avatar name={p.name} src={p.avatarUrl} tone={p.avatarTone} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-[13px] text-ink-soft">{p.title}</p>
                    <p className="truncate text-[12.5px] text-ink-faint">{p.email}</p>
                  </div>
                  <button className="btn btn-ghost btn-sm w-9 px-0" aria-label="Ubah" onClick={() => setEditing({ id: p.id, role: 'psychologist', name: p.name, email: p.email, phone: p.phone ?? '', title: p.title ?? '', bio: p.bio ?? '', password: '' })}><Pencil size={16} /></button>
                </div>
                {p.bio && <p className="mt-3 line-clamp-2 text-[13px] text-ink-soft">{p.bio}</p>}
                <div className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
                  <div><div className="display text-[26px]">{p.active}</div><div className="text-[11.5px] text-ink-faint">aktif</div></div>
                  <div><div className="display text-[26px]">{p.completed}</div><div className="text-[11.5px] text-ink-faint">selesai</div></div>
                  <div><div className="display inline-flex items-center gap-1 text-[26px]">{p.rating ? p.rating.toFixed(1) : '–'}{p.rating && <Star size={14} className="fill-sun-500 text-sun-500" />}</div><div className="text-[11.5px] text-ink-faint">rating</div></div>
                </div>
                <button className="btn btn-ghost btn-sm mt-3 self-start" onClick={() => toggle.mutate({ id: p.id, active: p.status === 'disabled' })}>
                  {p.status === 'disabled' ? 'Aktifkan' : 'Nonaktifkan'}
                </button>
              </div>
            ))}
          </div>
        )
      ) : admins.isLoading ? <ListSkeleton header={false} avatar rows={2} /> : (
        <div className="card divide-y divide-line">
          {admins.data?.users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-4">
              <Avatar name={u.name} src={u.avatarUrl} tone={u.avatarTone} size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{u.name}</p>
                <p className="truncate text-[13px] text-ink-faint">{u.email}{u.status === 'disabled' && ' · nonaktif'}</p>
              </div>
              <button className="btn btn-ghost btn-sm w-9 px-0" aria-label="Ubah" onClick={() => setEditing({ id: u.id, role: 'admin', name: u.name, email: u.email, phone: u.phone ?? '', title: '', bio: '', password: '' })}><Pencil size={16} /></button>
            </div>
          ))}
        </div>
      )}
      {editing && <StaffModal initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function StaffModal({ initial, onClose }: { initial: StaffForm; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const isNew = !initial.id;
  const m = useMutation({
    mutationFn: () => (isNew ? api.post('/admin/staff', f) : api.patch(`/admin/staff/${f.id}`, f)),
    onSuccess: () => {
      toast.success(isNew ? 'Akun dibuat. Bagikan email & password ke pemiliknya.' : 'Perubahan tersimpan.');
      qc.invalidateQueries({ queryKey: ['psychologists'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (e) => {
      setErrors(e instanceof ApiError ? ((e.data.fields as typeof errors) ?? {}) : {});
      toast.error(errMsg(e));
    },
  });
  const set = (k: keyof StaffForm) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const err = (k: string) => errors[k]?.[0];
  return (
    <Modal open onClose={onClose} title={`${isNew ? 'Tambah' : 'Ubah'} ${f.role === 'psychologist' ? 'psikolog' : 'admin'}`}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending && <Spinner />} Simpan</button></>}>
      <div className="grid gap-4 pb-2 sm:grid-cols-2">
        <Field label="Nama lengkap" error={err('name')} className="sm:col-span-2">{(id) => <input id={id} className="input" value={f.name} onChange={set('name')} />}</Field>
        <Field label="Email" error={err('email')}>{(id) => <input id={id} type="email" className="input" value={f.email} onChange={set('email')} />}</Field>
        <Field label="No. WhatsApp" optional>{(id) => <input id={id} className="input" value={f.phone} onChange={set('phone')} />}</Field>
        {f.role === 'psychologist' && (
          <>
            <Field label="Gelar / sebutan" className="sm:col-span-2">{(id) => <input id={id} className="input" value={f.title} onChange={set('title')} />}</Field>
            <Field label="Bio singkat" optional className="sm:col-span-2">{(id) => <textarea id={id} className="input min-h-[80px]" rows={2} value={f.bio} onChange={set('bio')} />}</Field>
          </>
        )}
        <Field label={isNew ? 'Password awal' : 'Password baru'} optional={!isNew} error={err('password')} hint={isNew ? 'Minimal 8 karakter.' : 'Kosongkan bila tidak diubah.'} className="sm:col-span-2">
          {(id) => <input id={id} type="text" autoComplete="off" className="input" value={f.password} onChange={set('password')} />}
        </Field>
      </div>
    </Modal>
  );
}

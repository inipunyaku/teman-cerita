import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, errMsg } from '@/lib/api';
import { revealInvalid } from '@/lib/validation';
import { fullPsychName } from '@/lib/format';
import type { Psychologist, User } from '@/lib/types';
import { Avatar, EmptyState, Field, Modal, PageHeader, Segmented, Spinner } from '@/components/ui';
import { CardGridSkeleton, ListSkeleton } from '@/components/Skeletons';
import { Pagination, SearchInput, matchText, usePaged } from '@/components/table';

type Tab = 'psychologist' | 'admin';
interface StaffForm {
  id?: number;
  role: Tab;
  name: string;
  email: string;
  phone: string;
  title: string;
  bio: string;
  specialization: string;
  approach: string;
  languages: string;
  meetingUrl: string;
  password: string;
}

export default function Staff() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('psychologist');
  const [editing, setEditing] = useState<StaffForm | null>(null);
  const psychs = useQuery({ queryKey: ['psychologists'], queryFn: () => api.get<{ psychologists: Psychologist[] }>('/admin/psychologists') });
  const admins = useQuery({ queryKey: ['admins'], queryFn: () => api.get<{ users: User[] }>('/admin/admins'), enabled: tab === 'admin' });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => api.post(`/admin/users/${id}/status`, { active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['psychologists'] }); qc.invalidateQueries({ queryKey: ['admins'] }); toast.success('Status diperbarui.'); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'disabled'>('all');
  const statusOk = (s: string) => status === 'all' || (status === 'disabled') === (s === 'disabled');
  const psychList = (psychs.data?.psychologists ?? []).filter((p) => statusOk(p.status) && matchText(q, p.name, p.email, p.specialization, p.approach));
  const adminList = (admins.data?.users ?? []).filter((u) => statusOk(u.status) && matchText(q, u.name, u.email));
  const psychPaged = usePaged(psychList, `${tab}|${q}|${status}`, 12);
  const adminPaged = usePaged(adminList, `${tab}|${q}|${status}`);
  const filtered = !!(q || status !== 'all');
  const blank: StaffForm = {
    role: tab, name: '', email: '', phone: '', title: tab === 'psychologist' ? 'S.Psi., Psikolog' : '', bio: '',
    specialization: '', approach: '', languages: 'Indonesia', meetingUrl: '', password: '',
  };

  return (
    <div className="animate-rise">
      <PageHeader
        title="Psikolog & admin"
        description="Akun staf dibuat oleh admin dan langsung aktif. Profil psikolog tampil ke pekerja saat memilih jadwal."
        actions={<button className="btn btn-primary" onClick={() => setEditing(blank)}><Plus size={18} /> Tambah {tab === 'psychologist' ? 'psikolog' : 'admin'}</button>}
      />
      <Segmented className="mb-4" value={tab} onChange={setTab} options={[{ value: 'psychologist', label: 'Psikolog' }, { value: 'admin', label: 'Admin' }]} />
      <div className={`mb-5 grid gap-2 sm:grid-cols-[1fr_170px]`}>
        <SearchInput value={q} onChange={setQ} placeholder={tab === 'psychologist' ? 'Cari nama, email, spesialisasi' : 'Cari nama atau email'} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
          <option value="all">Semua status</option>
          <option value="active">Aktif</option>
          <option value="disabled">Nonaktif</option>
        </select>
      </div>

      {tab === 'psychologist' ? (
        psychs.isLoading ? <CardGridSkeleton /> : psychList.length === 0 ? (
          <div className="card"><EmptyState title="Tidak ada psikolog" description={filtered ? 'Tidak ada psikolog yang cocok dengan pencarian atau filter ini.' : undefined} /></div>
        ) : (
          <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {psychPaged.pageItems.map((p) => (
              <div key={p.id} className={`card card-pad flex flex-col ${p.status === 'disabled' ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <Avatar name={p.name} src={p.avatarUrl} tone={p.avatarTone} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{fullPsychName(p)}</p>
                    <p className="text-[13px] text-ink-soft">{p.specialization || 'Spesialisasi belum diisi'}</p>
                    <p className="truncate text-[12.5px] text-ink-faint">{p.email}</p>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm w-9 px-0"
                    aria-label="Ubah"
                    onClick={() => setEditing({
                      id: p.id, role: 'psychologist', name: p.name, email: p.email, phone: p.phone ?? '', title: p.title ?? '', bio: p.bio ?? '',
                      specialization: p.specialization ?? '', approach: p.approach ?? '', languages: p.languages ?? '', meetingUrl: p.meetingUrl ?? '', password: '',
                    })}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
                {p.bio && <p className="mt-3 line-clamp-2 text-[13px] text-ink-soft">{p.bio}</p>}
                <div className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
                  <div><div className="display text-[26px]">{p.upcoming}</div><div className="text-[11.5px] text-ink-faint">akan datang</div></div>
                  <div><div className="display text-[26px]">{p.completed}</div><div className="text-[11.5px] text-ink-faint">selesai</div></div>
                  <div><div className="display text-[26px]">{p.satisfaction != null ? Math.round((p.satisfaction / 32) * 100) : '–'}<span className="text-base">{p.satisfaction != null && '%'}</span></div><div className="text-[11.5px] text-ink-faint">kepuasan</div></div>
                </div>
                {p.awaiting > 0 && <p className="mt-3 rounded-xl bg-sun-50 px-3 py-2 text-[12.5px] text-sun-700">{p.awaiting} sesi menunggu hasil</p>}
                {p.status === 'verified' && p.openBlocks === 0 && <p className="mt-3 rounded-xl bg-coral-50 px-3 py-2 text-[12.5px] text-coral-700">Belum membuka ketersediaan ke depan</p>}
                <div className="mt-3 flex flex-wrap gap-1">
                  <Link to={`/admin/ketersediaan`} className="btn btn-ghost btn-sm"><CalendarRange size={15} /> Ketersediaan</Link>
                  <button className="btn btn-ghost btn-sm" onClick={() => toggle.mutate({ id: p.id, active: p.status === 'disabled' })}>
                    {p.status === 'disabled' ? 'Aktifkan' : 'Nonaktifkan'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Pagination className="mt-4" page={psychPaged.page} pageSize={psychPaged.pageSize} total={psychPaged.total} unit="psikolog" onPage={psychPaged.setPage} onPageSize={psychPaged.setPageSize} sizes={[12, 24, 48]} />
          </>
        )
      ) : admins.isLoading ? <ListSkeleton header={false} avatar rows={2} /> : adminList.length === 0 ? (
        <div className="card"><EmptyState title="Tidak ada admin" description={filtered ? 'Tidak ada admin yang cocok dengan pencarian atau filter ini.' : undefined} /></div>
      ) : (
        <>
        <div className="card divide-y divide-line">
          {adminPaged.pageItems.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-4">
              <Avatar name={u.name} src={u.avatarUrl} tone={u.avatarTone} size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{u.name}</p>
                <p className="truncate text-[13px] text-ink-faint">{u.email}{u.status === 'disabled' && ' · nonaktif'}</p>
              </div>
              <button className="btn btn-ghost btn-sm w-9 px-0" aria-label="Ubah" onClick={() => setEditing({ ...blank, id: u.id, role: 'admin', name: u.name, email: u.email, phone: u.phone ?? '', title: '' })}><Pencil size={16} /></button>
            </div>
          ))}
        </div>
        <Pagination className="mt-4" page={adminPaged.page} pageSize={adminPaged.pageSize} total={adminPaged.total} unit="admin" onPage={adminPaged.setPage} onPageSize={adminPaged.setPageSize} />
        </>
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
  const psych = f.role === 'psychologist';
  const m = useMutation({
    mutationFn: () => (isNew ? api.post('/admin/staff', f) : api.patch(`/admin/staff/${f.id}`, f)),
    onSuccess: () => {
      toast.success(isNew ? 'Akun dibuat. Bagikan email & password ke pemiliknya.' : 'Perubahan tersimpan.');
      qc.invalidateQueries({ queryKey: ['psychologists'] });
      qc.invalidateQueries({ queryKey: ['admins'] });
      qc.invalidateQueries({ queryKey: ['booking'] });
      onClose();
    },
    onError: (e) => {
      setErrors(e instanceof ApiError ? ((e.data.fields as typeof errors) ?? {}) : {});
      revealInvalid();
      toast.error(errMsg(e));
    },
  });
  const set = (k: keyof StaffForm) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const err = (k: string) => errors[k]?.[0];
  return (
    <Modal open onClose={onClose} size={psych ? 'lg' : 'md'} title={`${isNew ? 'Tambah' : 'Ubah'} ${psych ? 'psikolog' : 'admin'}`}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending && <Spinner />} Simpan</button></>}>
      <div className="grid gap-4 pb-2 sm:grid-cols-2">
        <Field label="Nama lengkap (tanpa gelar)" error={err('name')} className="sm:col-span-2">{(id) => <input id={id} className="input" value={f.name} onChange={set('name')} />}</Field>
        <Field label="Email" error={err('email')}>{(id) => <input id={id} type="email" className="input" value={f.email} onChange={set('email')} />}</Field>
        <Field label="No. WhatsApp" optional>{(id) => <input id={id} className="input" value={f.phone} onChange={set('phone')} />}</Field>
        {psych && (
          <>
            <Field label="Gelar" hint="Contoh: S.Psi., Psikolog">{(id) => <input id={id} className="input" value={f.title} onChange={set('title')} />}</Field>
            <Field label="Spesialisasi" optional hint="Contoh: Dewasa, Karier, Manajemen Stres">{(id) => <input id={id} className="input" value={f.specialization} onChange={set('specialization')} />}</Field>
            <Field label="Pendekatan" optional>{(id) => <input id={id} className="input" value={f.approach} onChange={set('approach')} placeholder="Cognitive Behavioral Therapy (CBT)" />}</Field>
            <Field label="Bahasa" optional>{(id) => <input id={id} className="input" value={f.languages} onChange={set('languages')} />}</Field>
            <Field label="Deskripsi singkat" optional className="sm:col-span-2" hint="Tampil di profil psikolog saat pekerja memilih jadwal.">{(id) => <textarea id={id} className="input min-h-[80px]" rows={2} value={f.bio} onChange={set('bio')} />}</Field>
            <Field label="Tautan Microsoft Teams" optional error={err('meetingUrl')} className="sm:col-span-2" hint="Dipakai otomatis untuk sesi video/voice call.">{(id) => <input id={id} className="input" value={f.meetingUrl} onChange={set('meetingUrl')} placeholder="https://teams.microsoft.com/l/meetup-join/…" />}</Field>
          </>
        )}
        <Field label={isNew ? 'Password awal' : 'Password baru'} optional={!isNew} error={err('password')} hint={isNew ? 'Minimal 8 karakter.' : 'Kosongkan bila tidak diubah.'} className="sm:col-span-2">
          {(id) => <input id={id} type="text" autoComplete="off" className="input" value={f.password} onChange={set('password')} />}
        </Field>
      </div>
    </Modal>
  );
}

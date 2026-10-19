import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Download, Pencil, Plus, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, errMsg } from '@/lib/api';
import { ageOf } from '@/lib/format';
import type { Unit, User } from '@/lib/types';
import { Avatar, EmptyState, Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { ListSkeleton } from '@/components/Skeletons';
import { GENDER_LABEL, type Gender } from '@shared/constants';

interface Form {
  id?: number;
  pn: string;
  name: string;
  email: string;
  phone: string;
  unitId: string;
  band: string;
  region: string;
  gender: string;
  birthDate: string;
  password: string;
}
const blank: Form = { pn: '', name: '', email: '', phone: '', unitId: '', band: '', region: '', gender: '', birthDate: '', password: '' };

export function useUnits() {
  return useQuery({ queryKey: ['units-public'], queryFn: () => api.get<{ units: Unit[] }>('/meta/units'), staleTime: 300_000 });
}

export default function Employees() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'active' | 'disabled' | ''>('active');
  const [unit, setUnit] = useState('');
  const [editing, setEditing] = useState<Form | null>(null);
  const [importing, setImporting] = useState(false);
  const { data: units } = useUnits();
  const { data, isLoading } = useQuery({
    queryKey: ['employees', status, unit, q],
    queryFn: () => api.get<{ users: User[] }>(`/admin/employees?status=${status}&unit=${unit}&q=${encodeURIComponent(q)}`),
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => api.post(`/admin/users/${id}/status`, { active }),
    onSuccess: () => { toast.success('Status pekerja diperbarui.'); qc.invalidateQueries({ queryKey: ['employees'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="animate-rise">
      <PageHeader
        title="Data pekerja"
        description="Master data pekerja yang bisa masuk ke Teman Cerita dengan PN. Tidak ada pendaftaran mandiri."
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setImporting(true)}><Upload size={17} /> Impor CSV</button>
            <button className="btn btn-primary" onClick={() => setEditing(blank)}><Plus size={18} /> Tambah pekerja</button>
          </>
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_160px_240px]">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input className="input pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, PN, email" aria-label="Cari pekerja" />
        </div>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
          <option value="active">Aktif</option>
          <option value="disabled">Nonaktif</option>
          <option value="">Semua</option>
        </select>
        <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit kerja">
          <option value="">Semua unit kerja</option>
          {units?.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <ListSkeleton header={false} avatar />
      ) : !data?.users.length ? (
        <div className="card"><EmptyState title="Tidak ada pekerja" description="Tambahkan pekerja atau impor dari file CSV." /></div>
      ) : (
        <div className="card overflow-hidden">
          <p className="border-b border-line px-5 py-2.5 text-[12.5px] text-ink-faint">{data.users.length} pekerja</p>
          <table className="w-full">
            <thead className="hidden border-b border-line bg-canvas/60 md:table-header-group">
              <tr>
                <th className="table-head px-5 py-3">Pekerja</th>
                <th className="table-head px-3 py-3">PN</th>
                <th className="table-head px-3 py-3">Unit · band · region</th>
                <th className="table-head px-3 py-3 text-right">Sesi</th>
                <th className="w-[150px] px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.users.map((u) => (
                <tr key={u.id} className={clsx('block px-5 py-3.5 md:table-row md:p-0', u.status !== 'verified' && 'opacity-60')}>
                  <td className="block md:table-cell md:px-5 md:py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} src={u.avatarUrl} tone={u.avatarTone} size={36} />
                      <div className="min-w-0">
                        <p className="font-semibold">{u.name}{u.status !== 'verified' && <span className="chip ml-2 bg-canvas text-ink-faint">nonaktif</span>}</p>
                        <p className="truncate text-[12.5px] text-ink-faint">
                          {u.email}
                          {u.gender && ` · ${GENDER_LABEL[u.gender as Gender]}`}
                          {ageOf(u.birthDate) != null && ` · ${ageOf(u.birthDate)} th`}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="inline-block pr-3 pt-1 text-sm tabular-nums md:table-cell md:px-3 md:py-3">{u.pn}</td>
                  <td className="inline-block pt-1 text-[13px] text-ink-soft md:table-cell md:px-3 md:py-3">{[u.unitName, u.band, u.region].filter(Boolean).join(' · ')}</td>
                  <td className="hidden px-3 py-3 text-right text-sm tabular-nums md:table-cell">{u.ticketCount}</td>
                  <td className="mt-2 flex gap-1 md:mt-0 md:table-cell md:px-5 md:py-3 md:text-right">
                    <button className="btn btn-ghost btn-sm w-9 px-0" aria-label={`Ubah ${u.name}`} onClick={() => setEditing({ id: u.id, pn: u.pn ?? '', name: u.name, email: u.email, phone: u.phone ?? '', unitId: String(u.unitId ?? ''), band: u.band ?? '', region: u.region ?? '', gender: u.gender ?? '', birthDate: u.birthDate ?? '', password: '' })}>
                      <Pencil size={15} />
                    </button>
                    {u.status === 'verified' ? (
                      <button className="btn btn-ghost btn-sm" onClick={() => confirm(`Nonaktifkan ${u.name}? Pekerja tidak bisa masuk sampai diaktifkan lagi.`) && toggle.mutate({ id: u.id, active: false })}>Nonaktifkan</button>
                    ) : (
                      <button className="btn btn-soft btn-sm" onClick={() => toggle.mutate({ id: u.id, active: true })}>Aktifkan</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <EmployeeModal initial={editing} units={units?.units ?? []} onClose={() => setEditing(null)} />}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
    </div>
  );
}

function EmployeeModal({ initial, units, onClose }: { initial: Form; units: Unit[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const isNew = !initial.id;
  const m = useMutation({
    mutationFn: () => {
      const body = { ...f, unitId: Number(f.unitId) };
      return isNew ? api.post('/admin/employees', body) : api.patch(`/admin/employees/${f.id}`, body);
    },
    onSuccess: () => {
      toast.success(isNew ? 'Pekerja ditambahkan.' : 'Data pekerja tersimpan.');
      qc.invalidateQueries({ queryKey: ['employees'] });
      onClose();
    },
    onError: (e) => {
      setErrors(e instanceof ApiError ? ((e.data.fields as typeof errors) ?? {}) : {});
      toast.error(errMsg(e));
    },
  });
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const err = (k: string) => errors[k]?.[0];
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isNew ? 'Tambah pekerja' : 'Ubah data pekerja'}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending && <Spinner />} Simpan</button></>}
    >
      <div className="grid gap-4 pb-2 sm:grid-cols-2">
        <Field label="PN" error={err('pn')}>{(id) => <input id={id} className="input tabular-nums" inputMode="numeric" value={f.pn} onChange={(e) => setF({ ...f, pn: e.target.value.replace(/\D/g, '') })} />}</Field>
        <Field label="Nama lengkap" error={err('name')}>{(id) => <input id={id} className="input" value={f.name} onChange={set('name')} />}</Field>
        <Field label="Email" error={err('email')}>{(id) => <input id={id} type="email" className="input" value={f.email} onChange={set('email')} />}</Field>
        <Field label="No. WhatsApp" optional error={err('phone')}>{(id) => <input id={id} className="input" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="081234567890" />}</Field>
        <Field label="Unit kerja" error={err('unitId')} className="sm:col-span-2">
          {(id) => (
            <select id={id} className="input" value={f.unitId} onChange={set('unitId')}>
              <option value="">Pilih unit kerja</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Band" optional>{(id) => <input id={id} className="input" value={f.band} onChange={set('band')} placeholder="Band 3" />}</Field>
        <Field label="Region" optional>{(id) => <input id={id} className="input" value={f.region} onChange={set('region')} placeholder="Kantor Pusat" />}</Field>
        <Field label="Jenis kelamin" optional>
          {(id) => (
            <select id={id} className="input" value={f.gender} onChange={set('gender')}>
              <option value="">-</option>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          )}
        </Field>
        <Field label="Tanggal lahir" optional error={err('birthDate')}>{(id) => <input id={id} type="date" className="input" value={f.birthDate} onChange={set('birthDate')} />}</Field>
        <Field
          label={isNew ? 'Password awal' : 'Reset password'}
          optional
          className="sm:col-span-2"
          hint={isNew ? 'Kosongkan untuk memakai tanggal lahir (DDMMYYYY), atau PN bila tanggal lahir kosong.' : 'Kosongkan bila tidak diubah.'}
        >
          {(id) => <input id={id} type="text" autoComplete="off" className="input" value={f.password} onChange={set('password')} />}
        </Field>
      </div>
    </Modal>
  );
}

const CSV_HEADER = ['pn', 'nama', 'email', 'no_wa', 'unit', 'band', 'region', 'jenis_kelamin', 'tanggal_lahir'];

/** Pengurai CSV sederhana: mendukung koma atau titik koma, dan kolom dalam tanda kutip. */
function parseCsv(text: string) {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) row.push(cell), (cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  const [head = [], ...body] = rows;
  const keys = head.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [name, setName] = useState('');
  const [result, setResult] = useState<{ created: number; updated: number; errors: { row: number; error: string }[] } | null>(null);
  const m = useMutation({
    mutationFn: () => api.post<NonNullable<typeof result>>('/admin/employees/import', { rows }),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(`${r.created} pekerja baru, ${r.updated} diperbarui.`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const template = () => {
    const sample = ['90012345', 'Nama Pekerja', 'nama.pekerja@bri.co.id', '081234567890', 'Divisi Teknologi Informasi', 'Band 3', 'Kantor Pusat', 'P', '1995-08-17'];
    const blob = new Blob([`${CSV_HEADER.join(',')}\n${sample.join(',')}\n`], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'template-data-pekerja.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Impor data pekerja"
      description="Unggah file CSV. Pekerja dengan PN yang sudah ada akan diperbarui; yang baru akan ditambahkan dengan password awal = tanggal lahir (DDMMYYYY) atau PN."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{result ? 'Tutup' : 'Batal'}</button>
          {!result && <button className="btn btn-primary" disabled={!rows.length || m.isPending} onClick={() => m.mutate()}>{m.isPending && <Spinner />} Impor {rows.length > 0 && `${rows.length} baris`}</button>}
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <p className="text-sm text-ink-soft">
          Kolom: <code className="rounded bg-canvas px-1.5 py-0.5 text-[12.5px]">{CSV_HEADER.join(', ')}</code>. Unit bisa diisi nama atau kode unit; tanggal lahir berformat YYYY-MM-DD.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-soft btn-sm" onClick={template}><Download size={15} /> Unduh template</button>
          <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}><Upload size={15} /> Pilih file CSV</button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setName(f.name);
              setResult(null);
              setRows(parseCsv(await f.text()));
            }}
          />
        </div>
        {name && <p className="text-sm"><b>{name}</b> · {rows.length} baris data</p>}
        {rows.length > 0 && !result && (
          <div className="scrollbar-thin max-h-56 overflow-auto rounded-2xl border border-line">
            <table className="w-full text-[12.5px]">
              <thead className="bg-canvas"><tr>{Object.keys(rows[0]).map((k) => <th key={k} className="px-3 py-2 text-left font-semibold text-ink-faint">{k}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, 8).map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j} className="whitespace-nowrap px-3 py-1.5">{v}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        )}
        {result && (
          <div className="rounded-2xl bg-canvas px-4 py-3 text-sm">
            <p><b>{result.created}</b> ditambahkan · <b>{result.updated}</b> diperbarui · <b>{result.errors.length}</b> gagal</p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-[12.5px] text-coral-700">
                {result.errors.map((e) => <li key={e.row}>Baris {e.row}: {e.error}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

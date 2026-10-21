import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, errMsg } from '@/lib/api';
import { revealInvalid } from '@/lib/validation';
import type { Unit } from '@/lib/types';
import { EmptyState, Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { TableSkeleton } from '@/components/Skeletons';
import { Pagination, SearchInput, matchText, usePaged } from '@/components/table';

export default function Units() {
  const [editing, setEditing] = useState<Partial<Unit> | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['units-admin'], queryFn: () => api.get<{ units: Unit[] }>('/admin/units') });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const list = (data?.units ?? []).filter((u) => (status === 'all' || (status === 'active') === !!u.active) && matchText(q, u.name, u.code));
  const paged = usePaged(list, `${q}|${status}`);
  return (
    <div className="animate-rise">
      <PageHeader title="Unit kerja" description="Unit kerja pada master data pekerja dan laporan dashboard." actions={<button className="btn btn-primary" onClick={() => setEditing({ name: '', code: '', active: 1 })}><Plus size={18} /> Tambah unit</button>} />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px]">
        <SearchInput value={q} onChange={setQ} placeholder="Cari nama atau kode unit" label="Cari unit" />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
          <option value="all">Semua status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
      </div>
      {isLoading ? <TableSkeleton rows={5} /> : list.length === 0 ? (
        <div className="card"><EmptyState title="Tidak ada unit" description={q || status !== 'all' ? 'Tidak ada unit yang cocok dengan pencarian atau filter ini.' : undefined} /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-line bg-canvas/60">
              <tr>
                <th className="table-head px-5 py-3">Unit</th>
                <th className="table-head hidden px-3 py-3 sm:table-cell">Kode</th>
                <th className="table-head px-3 py-3 text-right">Pekerja</th>
                <th className="table-head px-3 py-3 text-right">Sesi</th>
                <th className="w-12 px-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paged.pageItems.map((u) => (
                <tr key={u.id} className={u.active ? '' : 'text-ink-faint'}>
                  <td className="px-5 py-3.5 text-sm font-semibold">{u.name}{!u.active && <span className="chip ml-2 bg-canvas text-ink-faint">nonaktif</span>}</td>
                  <td className="hidden px-3 py-3.5 font-mono text-[12.5px] sm:table-cell">{u.code}</td>
                  <td className="px-3 py-3.5 text-right text-sm tabular-nums">{u.employees}</td>
                  <td className="px-3 py-3.5 text-right text-sm tabular-nums">{u.tickets}</td>
                  <td className="px-3 py-2"><button className="btn btn-ghost btn-sm w-9 px-0" aria-label={`Ubah ${u.name}`} onClick={() => setEditing(u)}><Pencil size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination className="mt-4" page={paged.page} pageSize={paged.pageSize} total={paged.total} unit="unit" onPage={paged.setPage} onPageSize={paged.setPageSize} />
      {editing && <UnitModal unit={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function UnitModal({ unit, onClose }: { unit: Partial<Unit>; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(unit.name ?? '');
  const [tried, setTried] = useState(false);
  const [code, setCode] = useState(unit.code ?? '');
  const [active, setActive] = useState(unit.active !== 0);
  const m = useMutation({
    mutationFn: () => (unit.id ? api.patch(`/admin/units/${unit.id}`, { name, code, active }) : api.post('/admin/units', { name, code, active })),
    onSuccess: () => {
      toast.success('Unit tersimpan.');
      qc.invalidateQueries({ queryKey: ['units-admin'] });
      qc.invalidateQueries({ queryKey: ['units-public'] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Modal open onClose={onClose} title={unit.id ? 'Ubah unit kerja' : 'Tambah unit kerja'}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={m.isPending} onClick={() => (name.trim().length < 2 ? (setTried(true), revealInvalid()) : m.mutate())}>{m.isPending && <Spinner />} Simpan</button></>}>
      <div className="grid gap-4 pb-2 sm:grid-cols-[1fr_140px]">
        <Field label="Nama unit" error={tried && name.trim().length < 2 ? 'Nama unit minimal 2 karakter.' : undefined}>{(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Kode" optional>{(id) => <input id={id} className="input uppercase" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />}</Field>
        <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-sky-600" /> Aktif (bisa dipilih di master data pekerja)
        </label>
      </div>
    </Modal>
  );
}

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Unit } from '@/lib/types';
import { Field } from '@/components/ui';

export interface EmployeeData {
  name: string;
  pn: string;
  email: string;
  phone: string;
  unitId: string;
  password: string;
  confirm: string;
}

export function useUnits() {
  return useQuery({ queryKey: ['units-public'], queryFn: () => api.get<{ units: Unit[] }>('/meta/units'), staleTime: 300_000 });
}

/** Isian identitas karyawan — dipakai saat daftar dan saat mengajukan ulang verifikasi. */
export function EmployeeFields({
  data,
  set,
  errors,
  withAccount = true,
}: {
  data: EmployeeData;
  set: (patch: Partial<EmployeeData>) => void;
  errors: Record<string, string[] | undefined>;
  withAccount?: boolean;
}) {
  const { data: units } = useUnits();
  const e = (k: string) => errors[k]?.[0];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nama lengkap" error={e('name')} className="sm:col-span-2">
        {(id) => <input id={id} className="input" autoComplete="name" value={data.name} onChange={(ev) => set({ name: ev.target.value })} required />}
      </Field>
      <Field label="PN (Personal Number)" error={e('pn')}>
        {(id) => <input id={id} className="input tabular-nums" inputMode="numeric" value={data.pn} onChange={(ev) => set({ pn: ev.target.value.replace(/\D/g, '') })} placeholder="90001234" required />}
      </Field>
      <Field label="No. WhatsApp" error={e('phone')}>
        {(id) => <input id={id} className="input tabular-nums" inputMode="tel" autoComplete="tel" value={data.phone} onChange={(ev) => set({ phone: ev.target.value })} placeholder="081234567890" required />}
      </Field>
      {withAccount && (
        <Field label="Email kantor" error={e('email')} className="sm:col-span-2">
          {(id) => <input id={id} type="email" className="input" autoComplete="email" value={data.email} onChange={(ev) => set({ email: ev.target.value })} required />}
        </Field>
      )}
      <Field label="Unit kerja" error={e('unitId')} className="sm:col-span-2">
        {(id) => (
          <select id={id} className="input" value={data.unitId} onChange={(ev) => set({ unitId: ev.target.value })} required>
            <option value="">Pilih unit kerja</option>
            {units?.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      {withAccount && (
        <>
          <Field label="Password" error={e('password')} hint="Minimal 8 karakter.">
            {(id) => <input id={id} type="password" className="input" autoComplete="new-password" value={data.password} onChange={(ev) => set({ password: ev.target.value })} required />}
          </Field>
          <Field label="Ulangi password" error={e('confirm')}>
            {(id) => <input id={id} type="password" className="input" autoComplete="new-password" value={data.confirm} onChange={(ev) => set({ confirm: ev.target.value })} required />}
          </Field>
        </>
      )}
    </div>
  );
}

import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, Star, Table2 } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Avatar, MODE_ICON, PageHeader, SEVERITY_STYLE, Segmented, Stat } from '@/components/ui';
import { StatsSkeleton } from '@/components/Skeletons';
import { MODE_LABEL, REPORT_TOPICS, REQUEST_TOPICS, SEVERITIES, SEVERITY_LABEL, type Mode, type Severity } from '@shared/constants';

type KV = { key: string; value: number };
interface Stats {
  kpi: Record<string, number | null>;
  severity: KV[];
  topics: KV[];
  requestTopics: KV[];
  modes: KV[];
  units: { id: number; name: string; total: number; severe: number; ringan: number; sedang: number; berat: number; kritis: number }[];
  matrix: { unitId: number; topic: string; value: number }[];
  trend: { month: string; requests: number; completed: number; severe: number }[];
  psychologists: { id: number; name: string; title: string | null; avatarUrl: string | null; avatarTone: string | null; completed: number; active: number; rating: number | null }[];
}
type Range = '30' | '90' | '365' | 'all';

const num = (v: number | null | undefined) => (v ?? 0).toLocaleString('id-ID');

/** Tooltip ringan berbasis CSS untuk mark HTML. */
function Tip({ label, children, className, style }: { label: ReactNode; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={clsx('group/tip relative outline-none', className)} style={style} tabIndex={0}>
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-[12px] leading-snug text-white shadow-pop group-hover/tip:block group-focus/tip:block">
        {label}
      </div>
    </div>
  );
}

/** Batang bertumpuk: segmen dipisah celah 2px, tiap segmen punya tooltip. */
function StackBar({ segments, className, radius }: { segments: { label: string; value: number; color: string }[]; className?: string; radius: number }) {
  const shown = segments.filter((x) => x.value > 0);
  const total = shown.reduce((a, x) => a + x.value, 0) || 1;
  return (
    <div className={clsx('flex gap-[2px]', className)}>
      {shown.map((x, i) => (
        <Tip
          key={x.label}
          label={`${x.label}: ${x.value} (${Math.round((x.value / total) * 100)}%)`}
          className="h-full"
          style={{ width: `${(x.value / total) * 100}%` }}
        >
          <div
            className="h-full"
            style={{
              background: x.color,
              borderTopLeftRadius: i === 0 ? radius : 0,
              borderBottomLeftRadius: i === 0 ? radius : 0,
              borderTopRightRadius: i === shown.length - 1 ? radius : 0,
              borderBottomRightRadius: i === shown.length - 1 ? radius : 0,
            }}
          />
        </Tip>
      ))}
    </div>
  );
}

function Panel({ title, sub, children, className, action }: { title: string; sub?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={clsx('card card-pad min-w-0', className)}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {sub && <p className="mt-0.5 text-[13px] text-ink-faint">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function AdminDashboard() {
  const [range, setRange] = useState<Range>('90');
  const { data, isLoading } = useQuery({ queryKey: ['stats', range], queryFn: () => api.get<Stats>(`/stats?range=${range}`) });
  const { data: ov } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get<{ pendingAccounts: number; pendingTickets: number; rescheduleRequests: number; urgentPending: number }>('/admin/overview'),
  });

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Statistik layanan"
        title={<>Gambaran <span className="display italic text-sky-600">kesejahteraan</span> karyawan</>}
        description="Data agregat dari laporan psikolog. Isi sesi tetap rahasia."
        actions={
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { value: '30', label: '30 hari' },
              { value: '90', label: '90 hari' },
              { value: '365', label: '12 bulan' },
              { value: 'all', label: 'Semua' },
            ]}
          />
        }
      />

      {ov && (ov.pendingTickets + ov.pendingAccounts + ov.rescheduleRequests > 0) && (
        <div className="mb-6 flex flex-col gap-2 sm:flex-row">
          {ov.pendingTickets > 0 && (
            <Link to="/admin/tiket?status=pending" className="flex flex-1 items-center justify-between gap-3 rounded-2xl border border-sun-500/30 bg-sun-50 px-4 py-3 text-sm font-semibold text-sun-700">
              <span>{ov.pendingTickets} tiket menunggu penjadwalan{ov.urgentPending ? ` · ${ov.urgentPending} mendesak` : ''}</span>
              <ArrowRight size={16} />
            </Link>
          )}
          {ov.rescheduleRequests > 0 && (
            <Link to="/admin/tiket?status=reschedule_requested" className="flex flex-1 items-center justify-between gap-3 rounded-2xl border border-peach-500/30 bg-peach-50 px-4 py-3 text-sm font-semibold text-peach-700">
              <span>{ov.rescheduleRequests} permintaan jadwal ulang</span>
              <ArrowRight size={16} />
            </Link>
          )}
          {ov.pendingAccounts > 0 && (
            <Link to="/admin/akun?status=pending" className="flex flex-1 items-center justify-between gap-3 rounded-2xl border border-sky-500/25 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800">
              <span>{ov.pendingAccounts} akun menunggu verifikasi</span>
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      )}

      {isLoading || !data ? (
        <StatsSkeleton />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Permintaan" value={num(data.kpi.total)} tone="sky" hint={`${num(data.kpi.urgent)} mendesak · ${num(data.kpi.cancelled)} batal`} />
            <Stat label="Sesi selesai" value={num(data.kpi.completed)} tone="mint" hint={`${num(data.kpi.active)} sedang berjalan`} />
            <Stat
              label="Rata-rata waktu tunggu"
              value={<>{data.kpi.avgWaitHours ?? '–'}<span className="ml-1 font-sans text-base not-italic text-ink-faint">jam</span></>}
              tone="sun"
              hint="dari pengajuan sampai dijadwalkan"
            />
            <Stat
              label="Kepuasan"
              value={<span className="inline-flex items-center gap-2">{data.kpi.avgRating ?? '–'}<Star size={22} className="fill-sun-500 text-sun-500" /></span>}
              hint={`${num(data.kpi.reviews)} ulasan · ${data.kpi.followUpRate ?? 0}% perlu lanjutan`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
            <TrendPanel trend={data.trend} />
            <SeverityPanel severity={data.severity} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BarsPanel title="Topik yang paling sering dibahas" sub="Dari laporan psikolog (satu sesi bisa >1 topik)" rows={data.topics.map((t) => ({ label: REPORT_TOPICS[t.key as keyof typeof REPORT_TOPICS] ?? t.key, value: t.value }))} unit="sesi" limit={8} />
            <UnitsPanel units={data.units} />
          </div>

          <MatrixPanel units={data.units} matrix={data.matrix} topics={data.topics} />

          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div className="space-y-4">
              <ModesPanel modes={data.modes} />
              <BarsPanel title="Topik saat mengajukan" sub="Pilihan karyawan di formulir" rows={data.requestTopics.map((t) => ({ label: REQUEST_TOPICS[t.key as keyof typeof REQUEST_TOPICS] ?? t.key, value: t.value }))} unit="tiket" limit={7} />
            </div>
            <PsychPanel rows={data.psychologists} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function TrendPanel({ trend }: { trend: Stats['trend'] }) {
  const rows = trend.map((r) => ({ ...r, label: fmtDate(`${r.month}-01T00:00`, 'MMM') }));
  return (
    <Panel title="Tren 6 bulan" sub="Permintaan masuk vs. sesi yang selesai, per bulan pengajuan">
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="#E3EDF5" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#E3EDF5' }} tick={{ fill: '#8AA0B0', fontSize: 12 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#8AA0B0', fontSize: 12 }} />
            <Tooltip
              cursor={{ stroke: '#93D6FB', strokeWidth: 1 }}
              contentStyle={{ borderRadius: 14, border: '1px solid #E3EDF5', boxShadow: '0 18px 50px -20px rgba(15,92,138,.45)', fontSize: 13 }}
              labelStyle={{ fontWeight: 600, color: '#0E2A3D' }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, color: '#4F6A7D', paddingTop: 8 }} />
            <Line type="monotone" dataKey="requests" name="Permintaan" stroke="#1E88D6" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="completed" name="Selesai" stroke="#17B4A4" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function SeverityPanel({ severity }: { severity: KV[] }) {
  const counts = Object.fromEntries(severity.map((s) => [s.key, s.value])) as Record<Severity, number>;
  const total = SEVERITIES.reduce((a, s) => a + (counts[s] ?? 0), 0);
  return (
    <Panel title="Tingkat keparahan" sub={`${total} laporan sesi`}>
      {total === 0 ? (
        <p className="text-sm text-ink-faint">Belum ada laporan pada rentang ini.</p>
      ) : (
        <>
          <StackBar
            className="h-10"
            radius={6}
            segments={SEVERITIES.map((sv) => ({ label: SEVERITY_LABEL[sv], value: counts[sv] ?? 0, color: SEVERITY_STYLE[sv].color }))}
          />
          <ul className="mt-6 space-y-3">
            {SEVERITIES.map((s) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEVERITY_STYLE[s].color }} />
                <span className="flex-1 text-ink">{SEVERITY_LABEL[s]}</span>
                <span className="font-semibold tabular-nums">{counts[s] ?? 0}</span>
                <span className="w-11 text-right tabular-nums text-ink-faint">{total ? Math.round(((counts[s] ?? 0) / total) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
          {(counts.kritis ?? 0) > 0 && (
            <p className="mt-5 rounded-2xl bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
              {counts.kritis} sesi bertanda <b>Kritis</b>. Pastikan sudah ditindaklanjuti sesuai SOP eskalasi.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

function BarsPanel({ title, sub, rows, unit, limit }: { title: string; sub?: string; rows: { label: string; value: number }[]; unit: string; limit: number }) {
  const top = rows.slice(0, limit);
  const max = Math.max(1, ...top.map((r) => r.value));
  return (
    <Panel title={title} sub={sub}>
      {top.length === 0 ? (
        <p className="text-sm text-ink-faint">Belum ada data.</p>
      ) : (
        <ul className="space-y-3">
          {top.map((r) => (
            <li key={r.label}>
              <Tip label={`${r.label}: ${r.value} ${unit}`}>
                <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                  <span className="truncate text-ink">{r.label}</span>
                  <span className="font-semibold tabular-nums text-ink">{r.value}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-canvas">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${(r.value / max) * 100}%` }} />
                </div>
              </Tip>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function UnitsPanel({ units }: { units: Stats['units'] }) {
  const top = units.slice(0, 8);
  const max = Math.max(1, ...top.map((u) => u.total));
  return (
    <Panel title="Unit kerja dengan permintaan terbanyak" sub="Batang diwarnai menurut keparahan laporan">
      <ul className="space-y-3.5">
        {top.map((u) => {
          const unreported = u.total - (u.ringan + u.sedang + u.berat + u.kritis);
          const segs: [string, number, string][] = [
            ...SEVERITIES.map((s) => [SEVERITY_LABEL[s], u[s], SEVERITY_STYLE[s].color] as [string, number, string]),
            ['Belum ada laporan', unreported, '#D5E1EA'],
          ];
          return (
            <li key={u.id}>
              <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span className="truncate">{u.name}</span>
                <span className="shrink-0 tabular-nums">
                  <b>{u.total}</b>
                  {u.severe > 0 && <span className="ml-2 text-[12px] text-coral-700">{u.severe} berat/kritis</span>}
                </span>
              </div>
              <div style={{ width: `${(u.total / max) * 100}%` }}>
                <StackBar className="mt-1.5 h-2.5" radius={999} segments={segs.map(([label, value, color]) => ({ label, value, color }))} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-ink-soft">
        {SEVERITIES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_STYLE[s].color }} />{SEVERITY_LABEL[s]}</span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#D5E1EA]" />Belum ada laporan</span>
      </div>
    </Panel>
  );
}

const HEAT = ['#F0F8FE', '#DBF0FE', '#BFE5FD', '#93D6FB', '#5FC0F7', '#2BA9EF', '#1E88D6', '#0B6FA9'];

function MatrixPanel({ units, matrix, topics }: { units: Stats['units']; matrix: Stats['matrix']; topics: KV[] }) {
  const [showTable, setShowTable] = useState(false);
  const cols = topics.slice(0, 8).map((t) => t.key);
  const rows = units.filter((u) => matrix.some((m) => m.unitId === u.id));
  const get = (u: number, t: string) => matrix.find((m) => m.unitId === u && m.topic === t)?.value ?? 0;
  const max = Math.max(1, ...matrix.map((m) => m.value));
  const step = (v: number) => (v === 0 ? 0 : Math.min(HEAT.length - 1, Math.ceil((v / max) * (HEAT.length - 1))));
  const label = (k: string) => REPORT_TOPICS[k as keyof typeof REPORT_TOPICS] ?? k;

  return (
    <Panel
      title="Topik per unit kerja"
      sub="Semakin gelap, semakin sering topik itu muncul di unit tersebut"
      action={
        <button className="btn btn-ghost btn-sm" onClick={() => setShowTable((s) => !s)} aria-pressed={showTable}>
          <Table2 size={15} /> {showTable ? 'Peta' : 'Tabel'}
        </button>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-ink-faint">Belum ada data.</p>
      ) : (
        <div className="scrollbar-thin -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[760px] table-fixed border-separate" style={{ borderSpacing: showTable ? 0 : 3 }}>
            <thead>
              <tr>
                <th className="table-head w-[190px] pb-2 pr-3">Unit</th>
                {cols.map((c) => (
                  <th key={c} className="table-head px-1 pb-2 text-center normal-case tracking-normal">
                    <span className="block text-[11.5px] leading-tight">{label(c)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="truncate py-0.5 pr-3 text-[13px] text-ink">{u.name}</td>
                  {cols.map((c) => {
                    const v = get(u.id, c);
                    const s = step(v);
                    return showTable ? (
                      <td key={c} className="border-b border-line py-2 text-center text-[13px] tabular-nums">{v || '–'}</td>
                    ) : (
                      <td key={c} className="p-0">
                        <Tip label={`${u.name} · ${label(c)}: ${v} sesi`}>
                          <div
                            className="grid h-9 place-items-center rounded-[6px] text-[12px] font-semibold tabular-nums"
                            style={{ background: v ? HEAT[s] : '#F7FAFC', color: s >= 5 ? '#fff' : '#4F6A7D' }}
                          >
                            {v || ''}
                          </div>
                        </Tip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!showTable && rows.length > 0 && (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-ink-faint">
          <span>Sedikit</span>
          <div className="flex gap-[2px]">{HEAT.slice(1).map((c) => <span key={c} className="h-2.5 w-5 rounded-[3px]" style={{ background: c }} />)}</div>
          <span>Banyak</span>
        </div>
      )}
    </Panel>
  );
}

function ModesPanel({ modes }: { modes: KV[] }) {
  const total = modes.reduce((a, m) => a + m.value, 0) || 1;
  return (
    <Panel title="Metode sesi">
      <div className="grid grid-cols-3 gap-2">
        {(['chat', 'online', 'offline'] as Mode[]).map((m) => {
          const v = modes.find((x) => x.key === m)?.value ?? 0;
          const Icon = MODE_ICON[m];
          return (
            <div key={m} className="rounded-2xl bg-canvas p-3">
              <Icon size={18} className="text-sky-600" strokeWidth={1.75} />
              <div className="display mt-2 text-[30px]">{Math.round((v / total) * 100)}<span className="text-lg">%</span></div>
              <div className="text-[12.5px] text-ink-soft">{MODE_LABEL[m]} · {v}</div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function PsychPanel({ rows }: { rows: Stats['psychologists'] }) {
  return (
    <Panel title="Beban kerja psikolog" action={<Link to="/admin/psikolog" className="text-sm font-semibold text-sky-700">Kelola</Link>}>
      <div className="-mx-5 overflow-x-auto sm:-mx-6">
        <table className="w-full min-w-[420px]">
          <thead>
            <tr className="border-b border-line">
              <th className="table-head px-5 pb-2.5 sm:px-6">Psikolog</th>
              <th className="table-head px-2 pb-2.5 text-right">Selesai</th>
              <th className="table-head px-2 pb-2.5 text-right">Aktif</th>
              <th className="table-head px-5 pb-2.5 text-right sm:px-6">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="px-5 py-3 sm:px-6">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} src={p.avatarUrl} tone={p.avatarTone} size={34} />
                    <div>
                      <p className="text-sm font-semibold">{p.name}</p>
                      <p className="text-[12px] text-ink-faint">{p.title}</p>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-3 text-right text-sm font-semibold tabular-nums">{p.completed ?? 0}</td>
                <td className="px-2 py-3 text-right text-sm tabular-nums">{p.active ?? 0}</td>
                <td className="px-5 py-3 text-right text-sm tabular-nums sm:px-6">
                  {p.rating ? <span className="inline-flex items-center gap-1">{p.rating.toFixed(1)}<Star size={13} className="fill-sun-500 text-sun-500" /></span> : '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

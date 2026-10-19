import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, CalendarRange, Table2 } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Avatar, PageHeader, Segmented, Stat } from '@/components/ui';
import { StatsSkeleton } from '@/components/Skeletons';
import { CASE_CATEGORIES, GENDER_LABEL, MODE_LABEL, SCREENING_LEVEL_LABEL, SCREENING_LEVELS, type CaseCategory, type Gender, type Mode, type ScreeningLevel } from '@shared/constants';

type KV = { key: string; value: number };
type Cross = { group: string; values: Record<string, number>; total?: number };
interface Breakdown { total: KV[]; band: Cross[]; region: Cross[]; unit: Cross[]; month: Cross[] }
interface Stats {
  period: { year: number; month: number | null };
  overview: {
    clients: number; completed: number; bookings: number; upcoming: number;
    cancelRate: number | null; noShowRate: number | null; rescheduleRate: number | null; utilization: number | null; capacity: number;
    satisfaction: { rate: number | null; avgScore: number | null; responses: number };
    gender: KV[]; age: KV[]; modes: KV[];
  };
  trend: { month: string; clients: number; sessions: number; bookings: number; utilization: number | null; satisfaction: number | null }[];
  clientsByBand: KV[];
  clientsByRegion: KV[];
  problems: Breakdown;
  screening: Breakdown;
  monitoring: Record<'upcoming' | 'inProgress' | 'completed' | 'cancelled' | 'noShow' | 'followUp' | 'terminasi' | 'referral' | 'awaitingReport', number>;
  outcomes: { total: number; terminasi: number; lanjutan: number; referral: number; pending: number };
  psychologists: { id: number; name: string; title: string | null; avatarUrl: string | null; avatarTone: string | null; slots: number; booked: number; remaining: number; utilization: number | null; sessions: number; upcoming: number; satisfaction: number | null }[];
}

// Palet tervalidasi (dataviz): kategorikal 6 slot berurutan tetap; ordinal satu hue untuk tingkat skrining.
const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
const ORDINAL: Record<ScreeningLevel, string> = { rendah: '#86b6ef', sedang: '#2a78d6', tinggi: '#104281' };
const NEUTRAL = '#C9D6E0';
const SERIES = '#2a78d6';
const CATEGORY_KEYS = Object.keys(CASE_CATEGORIES) as CaseCategory[];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const num = (v: number | null | undefined) => (v ?? 0).toLocaleString('id-ID');
const pct = (v: number | null | undefined) => (v == null ? '–' : `${v.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`);
const monthLabel = (m: string) => fmtDate(`${m}-15T05:00:00Z`, 'MMM');

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
        <Tip key={x.label} label={`${x.label}: ${x.value} (${Math.round((x.value / total) * 100)}%)`} className="h-full" style={{ width: `${(x.value / total) * 100}%` }}>
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
          <h3 className="font-semibold">{title}</h3>
          {sub && <p className="mt-0.5 text-[13px] text-ink-faint">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-3 mt-10 first:mt-0">
      <h2 className="text-lg font-semibold">{children}</h2>
      {sub && <p className="text-[13px] text-ink-faint">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(0);
  const { data, isLoading } = useQuery({ queryKey: ['stats', year, month], queryFn: () => api.get<Stats>(`/stats?year=${year}&month=${month}`) });
  const { data: ov } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get<{ awaitingReport: number; today: number; upcoming: number }>('/admin/overview'),
  });
  const period = month ? `${MONTHS[month - 1]} ${year}` : `Tahun ${year}`;

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Dashboard layanan"
        title={<>Gambaran <span className="display italic text-sky-600">Teman Cerita</span> BRILiaN</>}
        description="Data agregat berdasarkan tanggal sesi. Isi keluhan dan catatan klinis tetap rahasia."
        actions={
          <div className="flex gap-2">
            <select className="input h-10 w-auto" value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Bulan">
              <option value={0}>Semua bulan</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select className="input h-10 w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Tahun">
              {[now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        }
      />

      {ov && ov.awaitingReport > 0 && (
        <Link to="/admin/sesi?status=awaiting_report" className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-sun-500/30 bg-sun-50 px-4 py-3 text-sm font-semibold text-sun-700">
          <span>{ov.awaitingReport} sesi sudah berakhir dan menunggu hasil dari psikolog · {ov.today} sesi hari ini</span>
          <ArrowRight size={16} />
        </Link>
      )}

      {isLoading || !data ? (
        <StatsSkeleton />
      ) : (
        <div>
          <SectionTitle sub={period}>Overview</SectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total klien" value={num(data.overview.clients)} tone="sky" hint="pekerja unik yang mengikuti sesi" />
            <Stat label="Sesi konseling selesai" value={num(data.overview.completed)} tone="mint" />
            <Stat label="Total booking" value={num(data.overview.bookings)} hint="termasuk yang dibatalkan" />
            <Stat label="Booking akan datang" value={num(data.overview.upcoming)} tone="sun" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Rate label="Pembatalan" value={data.overview.cancelRate} />
            <Rate label="No show" value={data.overview.noShowRate} />
            <Rate label="Reschedule" value={data.overview.rescheduleRate} />
            <Rate label="Utilisasi layanan" value={data.overview.utilization} hint={`dari ${num(data.overview.capacity)} slot`} meter />
            <Rate label="Kepuasan (CSQ)" value={data.overview.satisfaction.rate} hint={data.overview.satisfaction.responses ? `rata-rata ${data.overview.satisfaction.avgScore}/32 · ${data.overview.satisfaction.responses} respons` : 'belum ada respons'} meter />
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <BarsPanel title="Jenis kelamin" rows={data.overview.gender.map((g) => ({ label: GENDER_LABEL[g.key as Gender] ?? g.key, value: g.value }))} unit="klien" />
            <BarsPanel title="Usia" rows={['< 25', '25–34', '35–44', '45–54', '≥ 55', 'Tidak diisi'].map((k) => ({ label: k, value: data.overview.age.find((a) => a.key === k)?.value ?? 0 })).filter((r) => r.value || r.label !== 'Tidak diisi')} unit="klien" />
            <BarsPanel title="Media konseling" rows={(['offline', 'chat', 'online'] as Mode[]).map((m) => ({ label: MODE_LABEL[m], value: data.overview.modes.find((x) => x.key === m)?.value ?? 0 }))} unit="sesi" />
          </div>

          <SectionTitle sub={`12 bulan di tahun ${year}`}>Tren layanan</SectionTitle>
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <TrendPanel trend={data.trend} />
            <div className="grid gap-3">
              <BarsPanel title="Klien per band" rows={data.clientsByBand.map((x) => ({ label: x.key, value: x.value }))} unit="klien" limit={6} />
              <BarsPanel title="Klien per region" rows={data.clientsByRegion.map((x) => ({ label: x.key, value: x.value }))} unit="klien" limit={6} />
            </div>
          </div>

          <SectionTitle sub="Kategori dari form pasca-sesi psikolog, dan hasil skrining EANSCALE saat pendaftaran">Distribusi permasalahan</SectionTitle>
          <div className="grid gap-3 xl:grid-cols-2">
            <BreakdownPanel
              title="Topik permasalahan pasca konseling"
              data={data.problems}
              keys={CATEGORY_KEYS}
              label={(k) => CASE_CATEGORIES[k as CaseCategory]?.label ?? k}
              color={(k) => CATEGORICAL[CATEGORY_KEYS.indexOf(k as CaseCategory)] ?? NEUTRAL}
              unit="sesi"
            />
            <BreakdownPanel
              title="Hasil skrining EANSCALE"
              data={data.screening}
              keys={SCREENING_LEVELS}
              label={(k) => `Tekanan ${SCREENING_LEVEL_LABEL[k as ScreeningLevel]?.toLowerCase() ?? k}`}
              color={(k) => ORDINAL[k as ScreeningLevel] ?? NEUTRAL}
              unit="klien"
            />
          </div>

          <SectionTitle sub={period}>Monitoring sesi</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Tile to="/admin/sesi?status=upcoming" label="Akan datang" value={data.monitoring.upcoming + data.monitoring.inProgress} />
            <Tile to="/admin/sesi?status=completed" label="Selesai" value={data.monitoring.completed} />
            <Tile to="/admin/sesi?status=awaiting_report" label="Menunggu hasil psikolog" value={data.monitoring.awaitingReport} warn={data.monitoring.awaitingReport > 0} />
            <Tile to="/admin/sesi?status=cancelled" label="Dibatalkan" value={data.monitoring.cancelled} />
            <Tile to="/admin/sesi?status=no_show" label="No show" value={data.monitoring.noShow} />
            <Tile label="Follow-up (sesi lanjutan)" value={data.monitoring.followUp} />
            <Tile label="Terminasi" value={data.monitoring.terminasi} />
            <Tile label="Referral" value={data.monitoring.referral} />
          </div>

          <SectionTitle sub={period}>Monitoring psikolog</SectionTitle>
          <PsychPanel rows={data.psychologists} />

          <SectionTitle sub={`${period} · dari ${num(data.outcomes.total)} sesi yang sudah berlangsung`}>Hasil & tindak lanjut</SectionTitle>
          <OutcomePanel o={data.outcomes} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Rate({ label, value, hint, meter }: { label: string; value: number | null; hint?: string; meter?: boolean }) {
  return (
    <div className="card card-pad">
      <p className="text-[13px] text-ink-soft">{label}</p>
      <p className="display mt-2 text-[34px] tabular-nums text-ink">{pct(value)}</p>
      {meter && (
        <div className="mt-2 h-1.5 rounded-full bg-canvas">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, value ?? 0)}%`, background: SERIES }} />
        </div>
      )}
      {hint && <p className="mt-1.5 text-[12px] text-ink-faint">{hint}</p>}
    </div>
  );
}

function Tile({ label, value, to, warn }: { label: string; value: number; to?: string; warn?: boolean }) {
  const body = (
    <>
      <p className="text-[13px] text-ink-soft">{label}</p>
      <p className={clsx('display mt-1.5 text-[34px] tabular-nums', warn ? 'text-sun-700' : 'text-ink')}>{num(value)}</p>
    </>
  );
  return to ? (
    <Link to={to} className={clsx('card card-pad transition-shadow hover:shadow-soft', warn && 'border-sun-500/40 bg-sun-50/40')}>{body}</Link>
  ) : (
    <div className="card card-pad">{body}</div>
  );
}

function BarsPanel({ title, sub, rows, unit, limit = 10 }: { title: string; sub?: string; rows: { label: string; value: number }[]; unit: string; limit?: number }) {
  const top = rows.slice(0, limit);
  const max = Math.max(1, ...top.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <Panel title={title} sub={sub}>
      {total === 0 ? (
        <p className="text-sm text-ink-faint">Belum ada data.</p>
      ) : (
        <ul className="space-y-3">
          {top.map((r) => (
            <li key={r.label}>
              <Tip label={`${r.label}: ${r.value} ${unit} (${Math.round((r.value / total) * 100)}%)`}>
                <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                  <span className="truncate text-ink">{r.label}</span>
                  <span className="shrink-0 tabular-nums"><b>{r.value}</b> <span className="text-ink-faint">{Math.round((r.value / total) * 100)}%</span></span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-canvas">
                  <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: SERIES }} />
                </div>
              </Tip>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

type Metric = 'clients' | 'sessions' | 'bookings' | 'utilization' | 'satisfaction';
const METRICS: { value: Metric; label: string; unit: string }[] = [
  { value: 'clients', label: 'Klien unik', unit: 'klien' },
  { value: 'sessions', label: 'Sesi', unit: 'sesi' },
  { value: 'bookings', label: 'Booking', unit: 'booking' },
  { value: 'utilization', label: 'Utilisasi', unit: '%' },
  { value: 'satisfaction', label: 'Kepuasan', unit: '%' },
];

/** Satu metrik per grafik (tanpa sumbu ganda); metrik dipilih lewat tab. */
function TrendPanel({ trend }: { trend: Stats['trend'] }) {
  const [metric, setMetric] = useState<Metric>('clients');
  const m = METRICS.find((x) => x.value === metric)!;
  const rows = trend.map((r) => ({ label: monthLabel(r.month), value: r[metric] }));
  const percent = m.unit === '%';
  return (
    <Panel title={`${m.label} per bulan`} sub={percent ? (metric === 'utilization' ? 'Sesi terpesan ÷ kapasitas slot ketersediaan' : 'Rata-rata skor CSQ ÷ skor maksimum 32') : undefined}>
      <Segmented className="mb-4 max-w-full overflow-x-auto" value={metric} onChange={setMetric} options={METRICS.map(({ value, label }) => ({ value, label }))} />
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="#E3EDF5" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#E3EDF5' }} tick={{ fill: '#8AA0B0', fontSize: 12 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#8AA0B0', fontSize: 12 }} domain={percent ? [0, 100] : [0, 'auto']} unit={percent ? '%' : ''} />
            <Tooltip
              cursor={{ stroke: '#93D6FB', strokeWidth: 1 }}
              formatter={(v) => [v == null ? '–' : percent ? `${v}%` : `${v} ${m.unit}`, m.label]}
              contentStyle={{ borderRadius: 14, border: '1px solid #E3EDF5', boxShadow: '0 18px 50px -20px rgba(15,92,138,.45)', fontSize: 13 }}
              labelStyle={{ fontWeight: 600, color: '#0E2A3D' }}
            />
            <Line isAnimationActive={false} type="monotone" dataKey="value" name={m.label} stroke={SERIES} strokeWidth={2} connectNulls dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

type By = 'total' | 'band' | 'region' | 'unit' | 'month';

function BreakdownPanel({ title, data, keys, label, color, unit }: { title: string; data: Breakdown; keys: string[]; label: (k: string) => string; color: (k: string) => string; unit: string }) {
  const [by, setBy] = useState<By>('total');
  const [table, setTable] = useState(false);
  const total = data.total.reduce((a, x) => a + x.value, 0);
  const groups: Cross[] =
    by === 'total'
      ? [{ group: 'Total', values: Object.fromEntries(data.total.map((x) => [x.key, x.value])) }]
      : by === 'month'
        ? data.month.map((g) => ({ ...g, group: monthLabel(g.group) }))
        : data[by].slice(0, 10);
  const sum = (g: Cross) => keys.reduce((a, k) => a + (g.values[k] ?? 0), 0);
  const max = Math.max(1, ...groups.map(sum));

  return (
    <Panel
      title={title}
      sub={`${num(total)} ${unit}`}
      action={
        <button className="btn btn-ghost btn-sm" onClick={() => setTable((s) => !s)} aria-pressed={table}>
          <Table2 size={15} /> {table ? 'Grafik' : 'Tabel'}
        </button>
      }
    >
      <Segmented
        className="mb-4"
        value={by}
        onChange={setBy}
        options={[
          { value: 'total', label: 'Total' },
          { value: 'band', label: 'Band' },
          { value: 'region', label: 'Region' },
          { value: 'unit', label: 'Unit' },
          { value: 'month', label: 'Bulan' },
        ]}
      />
      {total === 0 ? (
        <p className="text-sm text-ink-faint">Belum ada data pada periode ini.</p>
      ) : table ? (
        <div className="scrollbar-thin -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="border-b border-line">
                <th className="table-head py-2 pr-3">{by === 'total' ? '' : 'Grup'}</th>
                {keys.map((k) => <th key={k} className="table-head px-2 py-2 text-right normal-case tracking-normal">{label(k)}</th>)}
                <th className="table-head py-2 pl-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {groups.map((g) => (
                <tr key={g.group}>
                  <td className="py-2 pr-3">{g.group}</td>
                  {keys.map((k) => <td key={k} className="px-2 py-2 text-right tabular-nums">{g.values[k] ?? 0}</td>)}
                  <td className="py-2 pl-2 text-right font-semibold tabular-nums">{sum(g)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : by === 'total' ? (
        <ul className="space-y-3">
          {keys.map((k) => {
            const v = groups[0].values[k] ?? 0;
            return (
              <li key={k}>
                <Tip label={`${label(k)}: ${v} ${unit}`}>
                  <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                    <span className="flex items-center gap-2 truncate"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color(k) }} />{label(k)}</span>
                    <span className="shrink-0 tabular-nums"><b>{v}</b> <span className="text-ink-faint">{Math.round((v / total) * 100)}%</span></span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-canvas">
                    <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: color(k) }} />
                  </div>
                </Tip>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <ul className="space-y-2.5">
            {groups.map((g) => (
              <li key={g.group} className="grid grid-cols-[minmax(0,130px)_1fr_36px] items-center gap-3 text-[13px]">
                <span className="truncate text-ink-soft" title={g.group}>{g.group}</span>
                <div style={{ width: `${(sum(g) / max) * 100}%` }} className="min-w-[2px]">
                  <StackBar className="h-3" radius={4} segments={keys.map((k) => ({ label: label(k), value: g.values[k] ?? 0, color: color(k) }))} />
                </div>
                <span className="text-right font-semibold tabular-nums">{sum(g)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {!table && total > 0 && (
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-ink-soft">
          {keys.map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: color(k) }} />{label(k)}</span>)}
        </div>
      )}
    </Panel>
  );
}

function PsychPanel({ rows }: { rows: Stats['psychologists'] }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <p className="text-[13px] text-ink-faint">Slot = kapasitas sesi dari blok ketersediaan (maks. 4 sesi/hari, jeda 30 menit).</p>
        <Link to="/admin/ketersediaan" className="btn btn-soft btn-sm shrink-0"><CalendarRange size={15} /> Jadwal & ketersediaan</Link>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-y border-line bg-canvas/60">
              <th className="table-head px-5 py-2.5 sm:px-6">Psikolog</th>
              <th className="table-head px-2 py-2.5 text-right">Slot</th>
              <th className="table-head px-2 py-2.5 text-right">Terpesan</th>
              <th className="table-head px-2 py-2.5 text-right">Tersisa</th>
              <th className="table-head w-[180px] px-3 py-2.5">Utilisasi</th>
              <th className="table-head px-2 py-2.5 text-right">Sesi</th>
              <th className="table-head px-5 py-2.5 text-right sm:px-6">Kepuasan</th>
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
                      <p className="text-[12px] text-ink-faint">{p.title}{p.upcoming ? ` · ${p.upcoming} akan datang` : ''}</p>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-3 text-right text-sm tabular-nums">{p.slots}</td>
                <td className="px-2 py-3 text-right text-sm font-semibold tabular-nums">{p.booked}</td>
                <td className="px-2 py-3 text-right text-sm tabular-nums">{p.remaining}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-canvas"><div className="h-full rounded-full" style={{ width: `${Math.min(100, p.utilization ?? 0)}%`, background: SERIES }} /></div>
                    <span className="w-12 text-right text-[13px] tabular-nums">{pct(p.utilization)}</span>
                  </div>
                </td>
                <td className="px-2 py-3 text-right text-sm tabular-nums">{p.sessions}</td>
                <td className="px-5 py-3 text-right text-sm tabular-nums sm:px-6">{pct(p.satisfaction)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OutcomePanel({ o }: { o: Stats['outcomes'] }) {
  const parts = [
    { key: 'terminasi', label: 'Terminasi', value: o.terminasi, color: CATEGORICAL[0] },
    { key: 'lanjutan', label: 'Sesi lanjutan', value: o.lanjutan, color: CATEGORICAL[1] },
    { key: 'referral', label: 'Referral', value: o.referral, color: CATEGORICAL[2] },
    { key: 'pending', label: 'Belum ada hasil', value: o.pending, color: NEUTRAL },
  ];
  return (
    <section className="card card-pad">
      {o.total === 0 ? (
        <p className="text-sm text-ink-faint">Belum ada sesi yang berlangsung pada periode ini.</p>
      ) : (
        <>
          <StackBar className="h-10" radius={6} segments={parts} />
          <ul className="mt-5 grid gap-3 sm:grid-cols-4">
            {parts.map((p) => (
              <li key={p.key} className="rounded-2xl bg-canvas px-4 py-3">
                <span className="flex items-center gap-2 text-[13px] text-ink-soft"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.label}</span>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {Math.round((p.value / o.total) * 100)}% <span className="text-sm font-normal text-ink-faint">· {p.value}</span>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

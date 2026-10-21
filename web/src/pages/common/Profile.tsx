import { useRef, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import { Camera, LogOut, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errMsg } from '@/lib/api';
import { revealInvalid } from '@/lib/validation';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import type { User } from '@/lib/types';
import { AVATAR_TONES, Avatar, Field, PageHeader, Spinner } from '@/components/ui';
import { AvatarCropper } from '@/components/AvatarCropper';
import { ACCOUNT_STATUS_LABEL, ROLE_LABEL } from '@shared/constants';

const STATUS_IDEAS = ['Lagi semangat', 'Butuh kopi dulu', 'Lagi belajar istirahat', 'Mode fokus', 'Pelan-pelan saja', 'Siap cerita'];

/** Latar kartu profil mengikuti warna pilihan pengguna. */
const BANNER: Record<string, string> = {
  sky: 'from-sky-200 via-sky-100 to-haze',
  mint: 'from-mint-100 via-[#E9F8F5] to-sky-50',
  sun: 'from-sun-100 via-sun-50 to-haze',
  peach: 'from-[#F9D2B8] via-haze to-sky-50',
  lilac: 'from-[#DCD5F7] via-[#EEEAFB] to-sky-50',
  rose: 'from-[#F7C9D6] via-rose-50 to-haze',
  ink: 'from-sky-900 via-sky-800 to-[#2D4E7A]',
};

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const u = user!;
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: u.name,
    phone: u.phone ?? '',
    nickname: u.nickname ?? '',
    title: u.title ?? '',
    bio: u.bio ?? '',
    specialization: u.specialization ?? '',
    approach: u.approach ?? '',
    languages: u.languages ?? '',
    meetingUrl: u.meetingUrl ?? '',
  });
  const [tone, setTone] = useState(u.avatarTone ?? 'sky');
  const [statusText, setStatusText] = useState(u.statusText ?? '');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  // Isian wajib yang kosong/salah ditandai merah setelah pengguna menekan Simpan.
  const [triedProfile, setTriedProfile] = useState(false);
  const [triedPw, setTriedPw] = useState(false);
  const nameErr = triedProfile && !form.name.trim() ? 'Nama lengkap wajib diisi.' : undefined;
  const pwErr = {
    current: triedPw && !pw.current ? 'Isi password lamamu.' : undefined,
    next: triedPw && pw.next.length < 8 ? 'Password baru minimal 8 karakter.' : undefined,
    confirm: triedPw && (!pw.confirm || pw.confirm !== pw.next) ? 'Ulangi password baru dengan sama persis.' : undefined,
  };

  const save = useMutation({
    mutationFn: (extra: { avatarTone?: string; statusText?: string } = {}) =>
      api.patch<{ user: User }>('/auth/profile', {
        ...form,
        avatarTone: tone,
        statusText,
        ...extra,
      }),
    onSuccess: ({ user }) => {
      setUser(user);
      toast.success('Tersimpan.');
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const upload = useMutation({
    mutationFn: (image: string) => api.post<{ user: User }>('/auth/avatar', { image }),
    onSuccess: ({ user }) => {
      setUser(user);
      setFile(null);
      toast.success('Foto profil diperbarui.');
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const removePhoto = useMutation({
    mutationFn: () => api.del<{ user: User }>('/auth/avatar'),
    onSuccess: ({ user }) => {
      setUser(user);
      toast.success('Foto profil dihapus.');
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const changePw = useMutation({
    mutationFn: () => api.post('/auth/password', { current: pw.current, next: pw.next }),
    onSuccess: () => {
      setPw({ current: '', next: '', confirm: '' });
      setTriedPw(false);
      toast.success('Password diperbarui.');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast.error('Pilih file gambar ya.');
    if (f.size > 15 * 1024 * 1024) return toast.error('Ukuran file maksimal 15 MB.');
    setFile(f);
  };

  return (
    <div className="mx-auto max-w-3xl animate-rise">
      <PageHeader title="Profil" description="Tunjukkan sedikit tentang dirimu. Foto dan statusmu terlihat oleh psikolog yang mendampingimu dan admin." />

      {/* Kartu diri */}
      <section className="card overflow-hidden">
        <div className={clsx('grain relative h-28 bg-gradient-to-br sm:h-32', BANNER[tone] ?? BANNER.sky)} />
        <div className="px-5 pb-6 sm:px-7">
          <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end">
            <div className="relative w-fit">
              <Avatar name={u.name} src={u.avatarUrl} tone={tone} size={104} className="ring-4 ring-white" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full bg-sky-600 text-white shadow-pop ring-2 ring-white transition-colors hover:bg-sky-700"
                aria-label="Ganti foto profil"
              >
                <Camera size={17} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <p className="truncate text-xl font-semibold">{u.name}</p>
              {u.statusText ? (
                <p className="display truncate text-[22px] italic text-sky-700">“{u.statusText}”</p>
              ) : (
                <p className="text-sm text-ink-faint">Belum ada status</p>
              )}
            </div>
          </div>
          <p className="mt-3 text-[13px] text-ink-soft">
            {ROLE_LABEL[u.role]} · {u.email}
            {u.pn && ` · PN ${u.pn}`} · {ACCOUNT_STATUS_LABEL[u.status]} · sejak {fmtDate(u.createdAt, 'MMMM yyyy')}
          </p>
          {u.avatarUrl && (
            <button className="btn btn-ghost btn-sm mt-3 text-coral-700 hover:bg-coral-50 hover:text-coral-700" onClick={() => removePhoto.mutate()} disabled={removePhoto.isPending}>
              <Trash2 size={15} /> Hapus foto
            </button>
          )}
        </div>
      </section>

      {/* Ekspresi diri */}
      <section className="card card-pad mt-4">
        <h2 className="font-semibold">Ekspresikan dirimu</h2>
        <p className="mt-1 text-sm text-ink-soft">Warna dipakai untuk latar profil dan avatar saat kamu tidak memasang foto.</p>

        <p className="label mt-5">Warna</p>
        <div className="flex flex-wrap gap-2.5">
          {Object.entries(AVATAR_TONES).map(([key, t]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTone(key)}
              aria-pressed={tone === key}
              aria-label={t.label}
              title={t.label}
              className={clsx('flex flex-col items-center gap-1.5 rounded-2xl p-1.5 text-[11.5px] font-medium transition-colors', tone === key ? 'bg-sky-50 text-sky-800' : 'text-ink-soft hover:bg-canvas')}
            >
              <span className={clsx('h-10 w-10 rounded-full ring-2 ring-offset-2 transition-all', tone === key ? 'ring-sky-500' : 'ring-transparent')} style={{ background: t.swatch }} />
              {t.label}
            </button>
          ))}
        </div>

        <Field label="Status singkat" className="mt-5" hint={`${statusText.length}/60 · Contoh: “lagi belajar istirahat”`}>
          {(id) => <input id={id} className="input" maxLength={60} value={statusText} onChange={(e) => setStatusText(e.target.value)} placeholder="Lagi apa hari ini?" />}
        </Field>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {STATUS_IDEAS.map((s) => (
            <button key={s} type="button" onClick={() => setStatusText(s)} className={clsx('chip h-8 border px-3 transition-colors', statusText === s ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-line bg-white text-ink-soft hover:border-sky-200')}>
              {s}
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate({})}>
            {save.isPending && <Spinner />} Simpan
          </button>
        </div>
      </section>

      <form
        noValidate
        className="card card-pad mt-4 space-y-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (!form.name.trim()) {
            setTriedProfile(true);
            return revealInvalid();
          }
          save.mutate({});
        }}
      >
        <h2 className="font-semibold">Data diri</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama lengkap" className="sm:col-span-2" error={nameErr}>
            {(id) => <input id={id} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
          </Field>
          <Field label="No. WhatsApp">
            {(id) => <input id={id} className="input" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}
          </Field>
          {u.role === 'employee' && (
            <>
              <Field label="Nama panggilan" hint="Dipakai psikolog selama proses konseling.">
                {(id) => <input id={id} className="input" maxLength={40} value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />}
              </Field>
              <div className="rounded-2xl bg-canvas px-4 py-3 text-sm sm:col-span-2">
                <p className="eyebrow mb-2">Master data pekerja</p>
                <dl className="grid gap-2 sm:grid-cols-3">
                  <div><dt className="text-ink-faint">Unit kerja</dt><dd className="font-semibold">{u.unitName ?? '-'}</dd></div>
                  <div><dt className="text-ink-faint">Band</dt><dd className="font-semibold">{u.band ?? '-'}</dd></div>
                  <div><dt className="text-ink-faint">Region</dt><dd className="font-semibold">{u.region ?? '-'}</dd></div>
                </dl>
                <p className="mt-2 text-[12.5px] text-ink-faint">Perubahan unit, band, atau region dilakukan oleh admin.</p>
              </div>
            </>
          )}
          {u.role === 'psychologist' && (
            <>
              <Field label="Gelar">
                {(id) => <input id={id} className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="S.Psi., Psikolog" />}
              </Field>
              <Field label="Spesialisasi">
                {(id) => <input id={id} className="input" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="Dewasa, Karier, Manajemen Stres" />}
              </Field>
              <Field label="Pendekatan">
                {(id) => <input id={id} className="input" value={form.approach} onChange={(e) => setForm({ ...form, approach: e.target.value })} placeholder="Cognitive Behavioral Therapy (CBT)" />}
              </Field>
              <Field label="Bahasa">
                {(id) => <input id={id} className="input" value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} placeholder="Indonesia, English" />}
              </Field>
              <Field label="Deskripsi singkat" className="sm:col-span-2" hint="Tampil di profilmu saat pekerja memilih psikolog dan jadwal.">
                {(id) => <textarea id={id} className="input" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />}
              </Field>
              <Field label="Tautan Microsoft Teams pribadi" className="sm:col-span-2" hint="Otomatis dipakai untuk sesi video/voice call. Bisa diganti per sesi.">
                {(id) => <input id={id} className="input" inputMode="url" value={form.meetingUrl} onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })} placeholder="https://teams.microsoft.com/l/meetup-join/…" />}
              </Field>
            </>
          )}
        </div>
        <div className="flex justify-end">
          <button className="btn btn-primary" disabled={save.isPending}>{save.isPending && <Spinner />} Simpan</button>
        </div>
      </form>

      <form
        noValidate
        className="card card-pad mt-4 space-y-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (!pw.current || pw.next.length < 8 || pw.next !== pw.confirm) {
            setTriedPw(true);
            return revealInvalid();
          }
          changePw.mutate();
        }}
      >
        <h2 className="font-semibold">Ganti password</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Password lama" error={pwErr.current}>{(id) => <input id={id} type="password" autoComplete="current-password" className="input" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />}</Field>
          <Field label="Password baru" error={pwErr.next}>{(id) => <input id={id} type="password" autoComplete="new-password" className="input" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />}</Field>
          <Field label="Ulangi" error={pwErr.confirm}>{(id) => <input id={id} type="password" autoComplete="new-password" className="input" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />}</Field>
        </div>
        <div className="flex justify-end">
          <button className="btn btn-secondary" disabled={changePw.isPending}>{changePw.isPending && <Spinner />} Perbarui password</button>
        </div>
      </form>

      <section className="card card-pad mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Keluar dari akun</h2>
          <p className="text-sm text-ink-soft">Kamu perlu masuk lagi untuk membuka Teman Cerita di perangkat ini.</p>
        </div>
        <button
          className="btn btn-danger"
          onClick={() => void logout()}
        >
          <LogOut size={17} /> Keluar
        </button>
      </section>

      {file && <AvatarCropper file={file} saving={upload.isPending} onCancel={() => setFile(null)} onDone={(img) => upload.mutate(img)} />}
    </div>
  );
}

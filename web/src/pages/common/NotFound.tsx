import { Link } from 'react-router-dom';
import { LogoMark } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <LogoMark className="mx-auto h-14 w-16" />
        <h1 className="display mt-6 text-[44px] italic">Ups, tersesat.</h1>
        <p className="mt-2 text-ink-soft">Halaman yang kamu cari tidak ada atau sudah dipindah.</p>
        <Link to="/" className="btn btn-primary mt-6">Kembali ke beranda</Link>
      </div>
    </div>
  );
}

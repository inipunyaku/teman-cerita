import type { LucideProps } from 'lucide-react';

/** Dua orang sedang ngobrol dengan gelembung cerita di antara mereka — ikon "Tiket/Ceritaku". */
export function TalkIcon({ size = 24, strokeWidth = 2, className, ...rest }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...(rest as React.SVGProps<SVGSVGElement>)}
    >
      {/* gelembung cerita */}
      <path d="M10 2.5h4a1.6 1.6 0 0 1 1.6 1.6v1.3A1.6 1.6 0 0 1 14 7h-1.1L12 8.3 11.1 7H10a1.6 1.6 0 0 1-1.6-1.6V4.1A1.6 1.6 0 0 1 10 2.5z" />
      {/* orang kiri */}
      <circle cx="6.5" cy="11.5" r="2.4" />
      <path d="M2.5 20.5c0-2.4 1.8-4.3 4-4.3s4 1.9 4 4.3" />
      {/* orang kanan */}
      <circle cx="17.5" cy="11.5" r="2.4" />
      <path d="M13.5 20.5c0-2.4 1.8-4.3 4-4.3s4 1.9 4 4.3" />
    </svg>
  );
}

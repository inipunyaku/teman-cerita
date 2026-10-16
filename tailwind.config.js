/** @type {import('tailwindcss').Config} */
export default {
  content: ['./web/index.html', './web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F7FAFC',
        line: '#E3EDF5',
        ink: { DEFAULT: '#0E2A3D', soft: '#4F6A7D', faint: '#8AA0B0' },
        sky: {
          50: '#F0F8FE', 100: '#DBF0FE', 200: '#BFE5FD', 300: '#93D6FB', 400: '#5FC0F7',
          500: '#2BA9EF', 600: '#1E88D6', 700: '#0B6FA9', 800: '#0F5C8A', 900: '#0B3F60',
        },
        mint: { 50: '#E3F6F3', 100: '#C7EEE8', 500: '#17B4A4', 700: '#0B6B62' },
        sun: { 50: '#FFF3C4', 100: '#FFE79A', 500: '#FFB020', 700: '#8A5A00' },
        coral: { 50: '#FDE9E5', 500: '#E8604C', 700: '#A23A2A' },
        rose: { 50: '#FBE3EA', 500: '#B4234A', 700: '#8E1838' },
        peach: { 50: '#FDE9DA', 500: '#F08A3E', 700: '#8A3B12' },
        haze: '#FBEFE7',
      },
      fontFamily: {
        sans: ['"Onest Variable"', 'Onest', 'system-ui', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { xl: '14px', '2xl': '18px', '3xl': '22px', '4xl': '28px' },
      boxShadow: {
        soft: '0 1px 0 #E3EDF5, 0 12px 32px -20px rgba(15,92,138,.35)',
        pop: '0 18px 50px -20px rgba(15,92,138,.45)',
      },
      keyframes: {
        rise: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        pulseDot: { '0%,100%': { boxShadow: '0 0 0 0 rgba(23,180,164,.45)' }, '50%': { boxShadow: '0 0 0 5px rgba(23,180,164,0)' } },
        drift: { '0%,100%': { transform: 'translateX(0)' }, '50%': { transform: 'translateX(14px)' } },
        sway: { '0%,100%': { transform: 'translateX(0)' }, '50%': { transform: 'translateX(36px)' } },
        // Dipasang pada wrapper selebar panel: awan masuk dari kiri, keluar di kanan.
        cloudPass: { from: { transform: 'translateX(-35%)' }, to: { transform: 'translateX(105%)' } },
      },
      animation: {
        rise: 'rise .28s ease-out both',
        pulseDot: 'pulseDot 1.8s ease-in-out infinite',
        drift: 'drift 14s ease-in-out infinite',
        sway: 'sway 18s ease-in-out infinite',
        cloudPass: 'cloudPass 60s linear infinite',
      },
    },
  },
  plugins: [],
};

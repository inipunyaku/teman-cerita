import { useEffect, useState, type RefObject } from 'react';

export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

const NO_KEYBOARD_INPUT = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image', 'hidden']);

/** Elemen yang memunculkan keyboard layar saat difokus. */
function typesText(el: Element | null) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el instanceof HTMLInputElement && !NO_KEYBOARD_INPUT.has(el.type) && !el.readOnly;
}

/**
 * Perkiraan keyboard layar HP sedang terbuka: kolom teks sedang difokus di perangkat sentuh, atau area yang
 * terlihat (visualViewport) jauh lebih pendek dari jendela. Dipakai untuk menyembunyikan header, menu bawah,
 * dan tombol melayang supaya ruang mengetik tidak sempit.
 */
export function useKeyboardOpen() {
  const touch = useMediaQuery('(pointer: coarse)');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!touch) return setOpen(false);
    const vv = window.visualViewport;
    const update = () => {
      const shrunk = !!vv && window.innerHeight - vv.height > 150;
      setOpen(typesText(document.activeElement) || shrunk);
    };
    // focusout terjadi sebelum fokus pindah; tunggu sebentar supaya tidak berkedip saat pindah kolom.
    let t: number | undefined;
    const later = () => {
      window.clearTimeout(t);
      t = window.setTimeout(update, 60);
    };
    update();
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', later);
    vv?.addEventListener('resize', later);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', later);
      vv?.removeEventListener('resize', later);
    };
  }, [touch]);
  return open;
}

/**
 * Header yang muncul saat halaman di paling atas atau sedang digulir, lalu bersembunyi bila didiamkan.
 * Tidak bersembunyi selama ada menu header yang terbuka (aria-expanded) atau fokus berada di dalamnya.
 * `resetKey` (mis. pathname) memunculkan header lagi setiap pindah halaman.
 */
export function useAutoHideHeader(ref: RefObject<HTMLElement>, { enabled, resetKey, idleMs = 1800 }: { enabled: boolean; resetKey?: unknown; idleMs?: number }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(false);
    if (!enabled) return;
    let timer: number | undefined;
    const pinned = () => {
      const el = ref.current;
      return !!el && (el.contains(document.activeElement) || !!el.querySelector('[aria-expanded="true"]'));
    };
    const schedule = () => {
      window.clearTimeout(timer);
      if (window.scrollY <= 8) return;
      timer = window.setTimeout(function hide() {
        if (window.scrollY <= 8) return;
        if (pinned()) timer = window.setTimeout(hide, idleMs);
        else setHidden(true);
      }, idleMs);
    };
    const onScroll = () => {
      setHidden(false);
      schedule();
    };
    schedule();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [enabled, resetKey, idleMs, ref]);
  return enabled && hidden;
}

/**
 * Menandai <html data-keyboard="open"> selama keyboard HP terbuka. Elemen dengan class `kb-hide` (mis. bar tombol
 * Kembali/Lanjutkan) disembunyikan lewat CSS supaya kolom yang sedang diisi tidak tertutup.
 */
export function useKeyboardFlag() {
  const open = useKeyboardOpen();
  useEffect(() => {
    const html = document.documentElement;
    if (open) html.dataset.keyboard = 'open';
    else delete html.dataset.keyboard;
  }, [open]);
}

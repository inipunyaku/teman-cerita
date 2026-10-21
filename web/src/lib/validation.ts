/**
 * Gulir ke isian wajib pertama yang belum diisi/benar ([data-invalid]) lalu fokuskan, supaya pengguna langsung
 * tahu bagian mana yang perlu dilengkapi. Dipanggil setelah status error di-set (menunggu render berikutnya).
 */
export function revealInvalid(root: ParentNode = document) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      // Lewati yang tidak terlihat (mis. versi tabel desktop yang disembunyikan di HP).
      const el = [...root.querySelectorAll<HTMLElement>('[data-invalid]')].find((e) => e.getClientRects().length > 0);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const target = el.matches('input, textarea, select, button')
        ? el
        : el.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), textarea, select, button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      target?.focus({ preventScroll: true });
    }),
  );
}

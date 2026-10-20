import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { ManualChunkMeta } from 'rollup';

// Paket grafik (recharts & dependensinya) — hanya dipakai dashboard admin.
const CHART_PKG = /node_modules\/(recharts|@reduxjs\/toolkit|redux|redux-thunk|reselect|immer|react-redux|d3-[^/]+|victory-vendor|internmap|decimal\.js-light|es-toolkit|eventemitter3|tiny-invariant)\//;
// Batas per file dalam karakter kode sebelum minify (±120 KB setelah minify).
const CHART_BUDGET = 300_000;
let chartChunkOf: Map<string, string> | undefined;

/**
 * recharts punya import melingkar, jadi tidak bisa dipecah sembarangan per folder. Modul dikelompokkan per
 * komponen terhubung kuat (Tarjan), diurutkan dari dependensi paling dasar, lalu dikemas berurutan ke beberapa
 * file. Tiap file hanya mengimpor file sebelumnya sehingga urutan inisialisasi tetap sama seperti satu file.
 */
function chartChunks(meta: ManualChunkMeta) {
  const ids = [...meta.getModuleIds()].filter((id) => CHART_PKG.test(id)).sort();
  const inSet = new Set(ids);
  const deps = (id: string) => (meta.getModuleInfo(id)?.importedIds ?? []).filter((d) => inSet.has(d));
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const comps: string[][] = [];
  const visit = (v: string) => {
    index.set(v, index.size);
    low.set(v, index.get(v)!);
    stack.push(v);
    onStack.add(v);
    for (const w of deps(v)) {
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
    }
    if (low.get(v) === index.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      comps.push(comp); // Tarjan menghasilkan komponen dengan dependensi lebih dulu.
    }
  };
  for (const id of ids) if (!index.has(id)) visit(id);

  const map = new Map<string, string>();
  let part = 1;
  let used = 0;
  for (const comp of comps) {
    const size = comp.reduce((n, id) => n + (meta.getModuleInfo(id)?.code?.length ?? 0), 0);
    if (used > 0 && used + size > CHART_BUDGET) {
      part++;
      used = 0;
    }
    used += size;
    for (const id of comp) map.set(id, `charts-${part}`);
  }
  return map;
}

export default defineConfig({
  root: 'web',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'web/src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:3410', changeOrigin: false } },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 150,
    rollupOptions: {
      output: {
        // Tiap file dijaga di bawah ±150 KB: vendor besar dipecah per bagian, grafik hanya dimuat di dashboard admin.
        manualChunks(id, meta) {
          if (CHART_PKG.test(id)) return (chartChunkOf ??= chartChunks(meta)).get(id);
          const m = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
          if (!m) return;
          const pkg = m[1];
          // react & react-dom satu file supaya tidak saling menunggu saat inisialisasi.
          if (/^(react|react-dom|scheduler)$/.test(pkg)) return 'react';
          if (/^(react-router|react-router-dom|@remix-run\/router|use-sync-external-store)$/.test(pkg)) return 'router';
          if (pkg.startsWith('@tanstack/')) return 'query';
          if (/^(lucide-react|sonner|date-fns|clsx)$/.test(pkg)) return 'ui';
        },
      },
    },
  },
});

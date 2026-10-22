import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Alias @ dan @shared diambil dari vite.config.ts supaya impor di tes sama dengan aplikasi.
export default defineConfig({
  resolve: viteConfig.resolve,
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['tests/server/**/*.test.ts'],
          // Wajib: mengarahkan DATABASE_PATH ke file sementara sebelum server/db.ts dimuat.
          setupFiles: ['tests/server/setup.ts'],
          pool: 'forks',
        },
      },
      {
        extends: true,
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['tests/web/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/web/setup.ts'],
        },
      },
    ],
  },
});

// The web view's page: web/ built into dist/web. `npx vite` serves it while editing, with /api
// from `./skill-atlas web` on its default port.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
    rollupOptions: {
      // Ring UI marks its components "use no memo" for the React compiler; harmless once bundled.
      onwarn(warning, warn) {
        if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning);
      },
    },
  },
  server: { proxy: { '/api': 'http://localhost:4173' } },
});

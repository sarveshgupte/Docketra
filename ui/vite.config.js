import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    ...(command === 'build'
      ? [
          // Run `npm run build` and open `stats.html` to inspect bundle composition.
          visualizer({
            open: true,
            filename: 'stats.html',
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
}));

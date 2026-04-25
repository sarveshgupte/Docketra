import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isTruthyEnv = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const enableProdSourceMaps = isTruthyEnv(process.env.VITE_ENABLE_PROD_SOURCEMAPS);

  return {
    plugins: [
      react(),
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
      sourcemap: !isProduction || enableProdSourceMaps,
    },
  };
});

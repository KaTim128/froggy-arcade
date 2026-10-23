import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: process.env.VERCEL ? '/' : '/froggy-arcade/',

  define: {
    __DEV__: JSON.stringify(mode !== 'production'),
  },

  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },

  server: {
    port: 5173,
    open: false,
  },
}));

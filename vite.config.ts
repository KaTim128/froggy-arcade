import { defineConfig } from 'vite';

// PRD §6.9 / DB-1: the debug panel is stripped from production builds by this define.
export default defineConfig(({ mode }) => ({
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

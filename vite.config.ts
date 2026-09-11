import { defineConfig } from 'vite';

// PRD §6.9 / DB-1: the debug panel is stripped from production builds by this define.
export default defineConfig(({ mode }) => ({
  /**
   * Where the built game will be served from.
   *
   * GitHub Pages puts a project site under /<repo>/, so every asset URL has to
   * be prefixed with it or the page loads and then 404s on its own script.  The
   * dev server still runs at the root, hence the mode check.
   */
  base: mode === 'production' ? '/froggy-arcade/' : '/',
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

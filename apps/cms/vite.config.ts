/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * Emits `src/sw.js` as `dist/sw.js` with the cache name stamped with the release (APP_VERSION = git short SHA in
 * Docker, else a timestamp). The worker lives outside `public/` because a public copy would win over the emitted file.
 */
function versionServiceWorker(build: string): Plugin {
  return {
    name: 'otvori:sw-version',
    apply: 'build',
    generateBundle() {
      const source = readFileSync(new URL('./src/sw.js', import.meta.url), 'utf8');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: source.replaceAll('__BUILD__', build) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Browser-facing API origin for production builds ('' = same origin as the CMS, reverse-proxied).
  const apiUrl = (env.VITE_API_URL ?? '').trim();
  // Where the dev/preview server forwards `/api`. In dev the browser always talks to the Vite origin, so the
  // refresh cookie stays first-party (SameSite=Lax, path /api/auth).
  const proxyTarget = env.API_PROXY_TARGET || apiUrl || 'http://localhost:3000';
  const proxy = { '/api': { target: proxyTarget, changeOrigin: false } };
  const build = (env.APP_VERSION ?? '').trim() || new Date().toISOString().replace(/\D/g, '').slice(0, 14);

  return {
    plugins: [react(), tailwindcss(), versionServiceWorker(build)],
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    server: { port: 5173, strictPort: true, proxy },
    preview: { port: 5173, strictPort: true, proxy },
    build: {
      target: 'esnext',
      modulePreload: { polyfill: false },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./test/setup.ts'],
      include: ['test/**/*.test.{ts,tsx}'],
      css: false,
      restoreMocks: true,
    },
  };
});

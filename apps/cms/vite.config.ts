/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Browser-facing API origin for production builds ('' = same origin as the CMS, reverse-proxied).
  const apiUrl = (env.VITE_API_URL ?? '').trim();
  // Where the dev/preview server forwards `/api`. In dev the browser always talks to the Vite origin, so the
  // refresh cookie stays first-party (SameSite=Lax, path /api/auth).
  const proxyTarget = env.API_PROXY_TARGET || apiUrl || 'http://localhost:3000';
  const proxy = { '/api': { target: proxyTarget, changeOrigin: false } };

  return {
    plugins: [react(), tailwindcss()],
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

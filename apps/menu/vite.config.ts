/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/** Inline the (small) stylesheet into index.html so the first paint needs no extra request. */
function inlineCss(): Plugin {
  return {
    name: 'tabla:inline-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html;
      for (const [fileName, asset] of Object.entries(ctx.bundle)) {
        if (asset.type !== 'asset' || !fileName.endsWith('.css')) continue;
        const tag = new RegExp(`<link[^>]+href="[^"]*${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`);
        if (!tag.test(html)) continue;
        html = html.replace(tag, `<style>${String(asset.source)}</style>`);
        delete ctx.bundle[fileName];
      }
      return html;
    },
  };
}

/**
 * Same-origin deployments ({slug}.salveta.menu with /api reverse-proxied): start fetching the menu while the JS
 * is still downloading. The app requests exactly this URL in that setup (host-based, no locale parameter).
 */
function preloadMenu(enabled: boolean): Plugin {
  return {
    name: 'tabla:preload-menu',
    apply: 'build',
    transformIndexHtml: enabled
      ? () => [{ tag: 'link', attrs: { rel: 'preload', as: 'fetch', href: '/api/public/menu', crossorigin: '' }, injectTo: 'head' }]
      : () => [],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Browser-facing API origin for production builds ('' = same origin as the menu).
  const apiUrl = (env.VITE_API_URL ?? '').trim();
  // Where the dev/preview server forwards `/api`. The browser always talks to the Vite origin in dev, so cookies
  // stay first-party and the Host header ({slug}.localhost:5174) reaches the API untouched.
  const proxyTarget = env.API_PROXY_TARGET || apiUrl || 'http://localhost:3000';
  const proxy = { '/api': { target: proxyTarget, changeOrigin: false } };

  return {
    plugins: [react(), tailwindcss(), inlineCss(), preloadMenu(apiUrl === '')],
    server: { port: 5174, strictPort: true, proxy },
    preview: { port: 5174, strictPort: true, proxy },
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

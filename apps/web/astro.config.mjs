// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const site = (process.env.SITE_URL ?? 'https://otvori.menu').replace(/\/$/, '');

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  // The whole stylesheet is small; inlining it removes a render-blocking request.
  build: { inlineStylesheets: 'always' },
  i18n: {
    defaultLocale: 'sr',
    locales: ['sr', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/print/'),
      // Only the landing page exists in both languages; the blog is Serbian only, so hreflang is set per URL here
      // instead of through the integration's `i18n` option (which would claim an English twin for every page).
      serialize: (item) => {
        const path = new URL(item.url).pathname;
        if (path === '/' || path === '/en/') {
          item.links = [
            { lang: 'sr', url: `${site}/` },
            { lang: 'en', url: `${site}/en/` },
            { lang: 'x-default', url: `${site}/` },
          ];
        }
        return item;
      },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});

// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const site = process.env.SITE_URL ?? 'https://otvori.menu';

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
      i18n: { defaultLocale: 'sr', locales: { sr: 'sr', en: 'en' } },
      filter: (page) => !page.includes('/print/'),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});

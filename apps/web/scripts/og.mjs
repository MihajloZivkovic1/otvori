// Renders the 1200×630 Open Graph images (design/otvori-brand.html "05 · OG image") with headless Chrome:
// plum field, the mark + "otvori" lockup, the tagline in the page's language and the domain. Run: npm run og -w @qr-menu/web
// `og-blog.png` is the shared image of every blog page (the second line names the blog instead of the tagline).
// `og-blog.png` is the shared image of every blog page (the second line names the blog instead of the tagline).
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { brand } from '../src/config.ts';
import { en } from '../src/i18n/en.ts';
import { sr } from '../src/i18n/sr.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fonts = pathToFileURL(path.join(root, 'public', 'fonts')).href;
const chrome =
  process.env.CHROME_PATH ??
  (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');

const MARK =
  '<path d="M23 6H9a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/>' +
  '<rect x="11.3" y="12" width="8" height="8" rx="1.5" fill="#fff"/><path d="M24.5 6.4 30 2.2v27.6l-5.5-4.2z" fill="#fff"/>';

const html = (t) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Libre Baskerville';font-weight:400 700;src:url('${fonts}/libre-baskerville-latin.woff2') format('woff2');unicode-range:U+0000-00FF}
@font-face{font-family:'Libre Baskerville';font-weight:400 700;src:url('${fonts}/libre-baskerville-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA}
@font-face{font-family:Figtree;font-weight:300 900;src:url('${fonts}/figtree-latin.woff2') format('woff2');unicode-range:U+0000-00FF}
@font-face{font-family:Figtree;font-weight:300 900;src:url('${fonts}/figtree-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA}
html,body{margin:0}
svg{display:block}
</style></head><body>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
<rect width="1200" height="630" fill="${brand.plum}"/>
<g transform="translate(120 150) scale(4.25)">${MARK}</g>
<text x="290" y="262" font-family="'Libre Baskerville',Georgia,serif" font-size="128" letter-spacing="-3" fill="#fff">otvori</text>
<text x="120" y="400" font-family="Figtree,sans-serif" font-size="${t.tagline.length > 30 ? 40 : 52}" font-weight="500" letter-spacing="-0.5" fill="#fff">${t.tagline}</text>
<text x="120" y="530" font-family="Figtree,sans-serif" font-size="26" font-weight="500" letter-spacing="1" fill="#fff" opacity=".78">${brand.domain}</text>
</svg></body></html>`;

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'otvori-og-'));
for (const [locale, t] of [['sr', sr], ['en', en], ['blog', { tagline: `${sr.blog.eyebrow} · ${sr.blog.h.toLowerCase()}` }]]) {
  const file = path.join(tmp, `${locale}.html`);
  await fs.writeFile(file, html(t));
  const out = path.join(root, 'public', `og-${locale}.png`);
  execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    '--window-size=1200,630', '--virtual-time-budget=3000', `--screenshot=${out}`, pathToFileURL(file).href,
  ], { stdio: 'ignore' });
  // Flat colours: a 256-colour palette keeps the text crisp at a fraction of the true-colour size.
  const quantised = await sharp(out).png({ palette: true, quality: 90, compressionLevel: 9 }).toBuffer();
  await fs.writeFile(out, quantised);
  console.log('wrote', out, `${Math.round(quantised.length / 1024)} KB`);
}
await fs.rm(tmp, { recursive: true, force: true });

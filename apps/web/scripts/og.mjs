// Renders the 1200×630 Open Graph images (design frame "OG image") with headless Chrome. Run: npm run og -w @qr-menu/web
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { en } from '../src/i18n/en.ts';
import { sr } from '../src/i18n/sr.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fonts = pathToFileURL(path.join(root, 'public', 'fonts')).href;
const chrome =
  process.env.CHROME_PATH ??
  (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');

const html = (t) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Libre Baskerville';font-weight:400 700;src:url('${fonts}/libre-baskerville-latin.woff2') format('woff2');unicode-range:U+0000-00FF}
@font-face{font-family:'Libre Baskerville';font-weight:400 700;src:url('${fonts}/libre-baskerville-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA}
@font-face{font-family:Figtree;font-weight:300 900;src:url('${fonts}/figtree-latin.woff2') format('woff2');unicode-range:U+0000-00FF}
@font-face{font-family:Figtree;font-weight:300 900;src:url('${fonts}/figtree-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA}
html,body{margin:0}
.og{width:1200px;height:630px;box-sizing:border-box;background:#7A3E48;color:#fff;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:72px 80px;font-family:Figtree,sans-serif}
.tex{position:absolute;inset:0;width:100%;height:100%;opacity:.14}
.corner{position:absolute;top:0;right:0;width:120px;height:120px;background:linear-gradient(225deg,#E9E2D8 0 50%,#5E2E37 50% 100%)}
.mark{display:flex;align-items:center;gap:18px;position:relative}
.mark span{font:700 64px/1 'Libre Baskerville',serif;letter-spacing:-.025em}
.body{display:flex;flex-direction:column;gap:22px;max-width:780px;position:relative}
.h{font:700 60px/1.1 'Libre Baskerville',serif;letter-spacing:-.015em;text-wrap:balance}
.sub{font:400 26px/1.4 Figtree,sans-serif;color:#F1DDE1;text-wrap:pretty}
.domain{position:absolute;right:140px;top:88px;font:500 22px Figtree,sans-serif;color:#F1DDE1}
</style></head><body><div class="og">
<svg class="tex"><filter id="t"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0"/></filter><rect width="100%" height="100%" filter="url(#t)"/></svg>
<span class="corner"></span>
<div class="mark"><svg width="64" height="64" viewBox="0 0 24 24"><path d="M3 3h12.5L21 8.5V21H3z" fill="#fff"/><path d="M15.5 3v5.5H21z" fill="#F1DDE1"/></svg><span>salveta</span></div>
<div class="body"><div class="h">${t.hero.h}</div><div class="sub">${t.og.sub}</div></div>
<div class="domain">salveta.menu</div>
</div></body></html>`;

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'salveta-og-'));
for (const [locale, t] of [['sr', sr], ['en', en]]) {
  const file = path.join(tmp, `${locale}.html`);
  await fs.writeFile(file, html(t));
  const out = path.join(root, 'public', `og-${locale}.png`);
  execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    '--window-size=1200,630', '--virtual-time-budget=3000', `--screenshot=${out}`, pathToFileURL(file).href,
  ], { stdio: 'ignore' });
  // The grain texture makes a true-colour PNG ~750 KB; a 256-colour palette keeps the text crisp at ~1/4 of that.
  const quantised = await sharp(out).png({ palette: true, quality: 90, compressionLevel: 9 }).toBuffer();
  await fs.writeFile(out, quantised);
  console.log('wrote', out, `${Math.round(quantised.length / 1024)} KB`);
}
await fs.rm(tmp, { recursive: true, force: true });

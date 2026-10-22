// Generates public/favicon.svg and public/icons/* from the otvori mark (design/otvori-brand.html, "App icon / favicon
// tile": the mark at 75 % on a plum square with a 7/32 corner radius). The maskable icon keeps the mark inside the
// 80 % safe zone on a full-bleed plum square. Run with: npm run icons -w @qr-menu/cms   (sharp comes from apps/web)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const pub = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const PLUM = '#7A3E48';
const MARK =
  '<path d="M23 6H9a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/>' +
  '<rect x="11.3" y="12" width="8" height="8" rx="1.5" fill="#fff"/><path d="M24.5 6.4 30 2.2v27.6l-5.5-4.2z" fill="#fff"/>';

/** Plum tile with the mark scaled to `scale` of the tile and centred; `radius` in 32-unit viewBox units. */
const tile = (scale, radius) => {
  const pad = (32 - 32 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="${radius}" fill="${PLUM}"/><g transform="translate(${pad} ${pad}) scale(${scale})">${MARK}</g></svg>`;
};
const png = (svg, size) => sharp(Buffer.from(svg), { density: 72 * (size / 32) }).resize(size, size).png().toBuffer();

mkdirSync(resolve(pub, 'icons'), { recursive: true });
writeFileSync(resolve(pub, 'favicon.svg'), tile(0.75, 7) + '\n');
writeFileSync(resolve(pub, 'icons', 'icon-192.png'), await png(tile(0.75, 7), 192));
writeFileSync(resolve(pub, 'icons', 'icon-512.png'), await png(tile(0.75, 7), 512));
writeFileSync(resolve(pub, 'icons', 'icon-maskable-512.png'), await png(tile(0.56, 0), 512));
console.log('icons written to', pub);

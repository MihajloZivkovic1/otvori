// Generates the favicon set from the otvori mark (design/otvori-brand.html "App icon / favicon tile": the mark at 75 %
// on a plum square, corner radius 7/32). Same artwork as the CMS and menu favicons. Run: npm run icons -w @qr-menu/web
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
await fs.mkdir(path.join(pub, 'icons'), { recursive: true });

const MARK =
  '<path d="M23 6H9a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/>' +
  '<rect x="11.3" y="12" width="8" height="8" rx="1.5" fill="#fff"/><path d="M24.5 6.4 30 2.2v27.6l-5.5-4.2z" fill="#fff"/>';
/** Plum tile with the mark at `scale` of the tile, centred; `radius` in the 32-unit viewBox (7 = the brand tile, 0 = square). */
const tile = (scale = 0.75, radius = 7) => {
  const pad = (32 - 32 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="${radius}" fill="#7A3E48"/><g transform="translate(${pad} ${pad}) scale(${scale})">${MARK}</g></svg>`;
};
const png = (size, scale, radius) =>
  sharp(Buffer.from(tile(scale, radius)), { density: 72 * (size / 32) }).resize(size, size).png().toBuffer();

await fs.writeFile(path.join(pub, 'favicon.svg'), tile() + '\n');
// iOS applies its own rounded mask, so the touch icon is a full-bleed square.
await fs.writeFile(path.join(pub, 'apple-touch-icon.png'), await png(180, 0.7, 0));
await fs.writeFile(path.join(pub, 'icons', 'icon-192.png'), await png(192));
await fs.writeFile(path.join(pub, 'icons', 'icon-512.png'), await png(512));

// favicon.ico with PNG-encoded 16 and 32 px entries (supported since Windows Vista and by every browser).
const entries = await Promise.all([16, 32].map(async (s) => ({ s, data: await png(s, 0.8, 6) })));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);
let offset = 6 + 16 * entries.length;
const dir = entries.map(({ s, data }) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0);
  e.writeUInt8(s, 1);
  e.writeUInt8(0, 2);
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(data.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += data.length;
  return e;
});
await fs.writeFile(path.join(pub, 'favicon.ico'), Buffer.concat([header, ...dir, ...entries.map((e) => e.data)]));
console.log('icons written to', pub);

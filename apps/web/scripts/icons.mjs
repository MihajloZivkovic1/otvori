// Generates the favicon set from the napkin glyph (same artwork as the CMS favicon). Run: npm run icons -w @qr-menu/web
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
await fs.mkdir(path.join(pub, 'icons'), { recursive: true });

const tile = (size, pad, radius) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><rect width="64" height="64" rx="${radius}" fill="#7A3E48"/><g transform="translate(${pad} ${pad}) scale(${(64 - 2 * pad) / 24})"><path d="M3 3h12.5L21 8.5V21H3z" fill="#fff"/><path d="M15.5 3v5.5H21z" fill="#F1DDE1"/></g></svg>`;
const png = (size, pad = 11, radius = 14) => sharp(Buffer.from(tile(size, pad, radius))).png().toBuffer();

await fs.writeFile(path.join(pub, 'favicon.svg'), tile(64, 11, 14));
await fs.writeFile(path.join(pub, 'apple-touch-icon.png'), await png(180, 11, 0));
await fs.writeFile(path.join(pub, 'icons', 'icon-192.png'), await png(192));
await fs.writeFile(path.join(pub, 'icons', 'icon-512.png'), await png(512));

// favicon.ico with PNG-encoded 16 and 32 px entries (supported since Windows Vista and by every browser).
const entries = await Promise.all([16, 32].map(async (s) => ({ s, data: await png(s, 10, 12) })));
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

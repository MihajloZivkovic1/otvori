import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/**
 * Draws the Bebićino "sticker" for the Fabrika Kafeterija menu — čiča Gliša (the stick figure every child here draws)
 * proudly holding a little cup of milk foam — and writes it as the 800×800 JPEG the photo pipeline expects:
 *
 *   node apps/api/scripts/bebicino.mjs        → apps/api/assets/fabrika-photos/bebicino.jpg
 *
 * Our own drawing, so nothing to credit in assets/fabrika-photos/SOURCES.md.
 */
const sharp = createRequire(import.meta.url)('sharp');

const PAPER = '#F7F2EB';
const INK = '#1F1A17';
const TEAL = '#3FA6A1';
const COCOA = '#8B5A3C';
const FOAM = '#FFFBF4';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <rect width="800" height="800" fill="${PAPER}"/>
  <circle cx="400" cy="400" r="330" fill="#FFFFFF" opacity="0.55"/>
  <g fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">
    <!-- head -->
    <circle cx="330" cy="230" r="78" fill="${FOAM}"/>
    <!-- hair tufts -->
    <path d="M300 160 l-12 -34 M330 150 l0 -36 M360 160 l12 -34"/>
    <!-- body -->
    <path d="M330 308 v180"/>
    <!-- legs -->
    <path d="M330 488 l-70 150 M330 488 l70 150"/>
    <!-- left arm waving -->
    <path d="M330 350 l-110 -70"/>
    <!-- right arm holding the cup -->
    <path d="M330 350 l120 60"/>
  </g>
  <!-- face -->
  <g fill="${INK}">
    <circle cx="305" cy="222" r="9"/>
    <circle cx="355" cy="222" r="9"/>
  </g>
  <path d="M298 254 q32 30 64 0" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
  <g fill="#F2B8B0" opacity="0.8">
    <circle cx="285" cy="250" r="12"/>
    <circle cx="375" cy="250" r="12"/>
  </g>
  <!-- the cup -->
  <g transform="translate(450 395)">
    <path d="M0 0 h150 l-16 120 h-118 z" fill="${TEAL}"/>
    <path d="M150 20 q60 10 36 70 q-14 30 -46 30" fill="none" stroke="${TEAL}" stroke-width="22" stroke-linecap="round"/>
    <path d="M-10 -8 h170" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
    <!-- foam -->
    <path d="M-6 -6 c0 -40 30 -60 60 -50 c10 -40 70 -40 80 0 c30 -10 50 20 30 50 z" fill="${FOAM}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>
    <!-- cocoa dust -->
    <g fill="${COCOA}">
      <circle cx="40" cy="-40" r="6"/><circle cx="75" cy="-58" r="5"/><circle cx="110" cy="-42" r="6"/><circle cx="90" cy="-25" r="4"/>
    </g>
    <!-- steam -->
    <g fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round" opacity="0.5">
      <path d="M40 -90 q-15 -25 0 -50"/><path d="M90 -100 q-15 -25 0 -50"/>
    </g>
  </g>
  <!-- a few hearts -->
  <g fill="${TEAL}" opacity="0.85">
    <path transform="translate(560 200) scale(1.4)" d="M0 10 C-12 -4 -30 10 0 30 C30 10 12 -4 0 10z"/>
    <path transform="translate(640 280) scale(0.9)" d="M0 10 C-12 -4 -30 10 0 30 C30 10 12 -4 0 10z"/>
    <path transform="translate(190 420) scale(1.1)" d="M0 10 C-12 -4 -30 10 0 30 C30 10 12 -4 0 10z"/>
  </g>
</svg>`;

const out = fileURLToPath(new URL('../assets/fabrika-photos/bebicino.jpg', import.meta.url));
await sharp(Buffer.from(svg)).jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toFile(out);
process.stdout.write(`${out}\n`);

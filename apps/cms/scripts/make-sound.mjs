// Generates public/sounds/order.wav: a short two-note chime (E5 → A5) played by the waiter screen on a new order
// or call. 22.05 kHz, 16-bit mono PCM, ~0.4 s, so it stays small enough to live in the app-shell cache.
// Run with: node scripts/make-sound.mjs
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rate = 22050;
const notes = [
  { freq: 659.25, start: 0, length: 0.16 },
  { freq: 880, start: 0.14, length: 0.26 },
];
const total = Math.round(rate * 0.42);
const samples = new Float64Array(total);
for (const note of notes) {
  const from = Math.round(note.start * rate);
  const count = Math.round(note.length * rate);
  for (let i = 0; i < count && from + i < total; i++) {
    const t = i / rate;
    const attack = Math.min(1, i / (0.008 * rate));
    const decay = Math.exp(-4.5 * (i / count));
    const tone = Math.sin(2 * Math.PI * note.freq * t) + 0.25 * Math.sin(2 * Math.PI * note.freq * 2 * t);
    samples[from + i] += 0.45 * attack * decay * tone;
  }
}

const data = Buffer.alloc(total * 2);
for (let i = 0; i < total; i++) {
  const clamped = Math.max(-1, Math.min(1, samples[i]));
  data.writeInt16LE(Math.round(clamped * 32767), i * 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16); // PCM chunk size
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * 2, 28); // byte rate
header.writeUInt16LE(2, 32); // block align
header.writeUInt16LE(16, 34); // bits per sample
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/sounds/order.wav');
writeFileSync(out, Buffer.concat([header, data]));
console.log(`wrote ${out} (${header.length + data.length} bytes)`);

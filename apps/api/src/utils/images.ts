import sharp, { type Sharp } from 'sharp';
import { unsupportedMediaType } from './errors.js';

/** Decompression-bomb guard: 40 MP is far above anything that ends up as 800×800 / 512×512. */
const MAX_INPUT_PIXELS = 40_000_000;

async function decode(input: Buffer): Promise<Sharp> {
  const image = sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS }).rotate();
  try {
    await image.metadata();
  } catch {
    throw unsupportedMediaType('The uploaded file is not a readable image');
  }
  return image;
}

/**
 * Restaurant logo: 256×256 palette PNG, letterboxed on a transparent background. PNG because the QR sheet (pdfkit)
 * cannot embed WebP; palette quantisation keeps photographic logos at tens of KB instead of hundreds (the logo is
 * on the critical path of every menu load; the largest on-screen use is a 44 px tile, the PDF prints it at 40 pt).
 */
export async function processLogo(input: Buffer): Promise<Buffer> {
  const image = await decode(input);
  return image
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toBuffer();
}

/** Menu item row thumbnail: 160×160 WebP (2× the 76 px row image), center-cropped like the photo. */
export async function processItemThumbnail(input: Buffer): Promise<Buffer> {
  const image = await decode(input);
  return image.resize(160, 160, { fit: 'cover', position: 'centre' }).webp({ quality: 78 }).toBuffer();
}

/** Menu item photo: 800×800 WebP, center-cropped. */
export async function processItemImage(input: Buffer): Promise<Buffer> {
  const image = await decode(input);
  return image.resize(800, 800, { fit: 'cover', position: 'centre' }).webp({ quality: 82 }).toBuffer();
}

import sharp, { type Sharp } from 'sharp';
import { unsupportedMediaType } from './errors.js';

async function decode(input: Buffer): Promise<Sharp> {
  const image = sharp(input, { failOn: 'error' }).rotate();
  try {
    await image.metadata();
  } catch {
    throw unsupportedMediaType('The uploaded file is not a readable image');
  }
  return image;
}

/** Restaurant logo: 512×512 PNG, letterboxed on a transparent background. */
export async function processLogo(input: Buffer): Promise<Buffer> {
  const image = await decode(input);
  return image
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Menu item photo: 800×800 WebP, center-cropped. */
export async function processItemImage(input: Buffer): Promise<Buffer> {
  const image = await decode(input);
  return image.resize(800, 800, { fit: 'cover', position: 'centre' }).webp({ quality: 82 }).toBuffer();
}

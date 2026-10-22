import type { Request } from 'express';
import multer from 'multer';
import { badRequest, unsupportedMediaType } from '../utils/errors.js';

const ALLOWED = /^image\/(jpeg|pjpeg|png|webp|gif|avif|heic|heif|tiff)$/i;

/** Single image in memory (max 8 MB); any multipart field name is accepted. */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 4, parts: 5 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.test(file.mimetype)) {
      cb(unsupportedMediaType(`Unsupported image type ${file.mimetype}; use JPEG, PNG, WebP, GIF or AVIF`));
      return;
    }
    cb(null, true);
  },
}).any();

export function uploadedFile(req: Request): Express.Multer.File {
  const files = req.files;
  const file = Array.isArray(files) ? files[0] : files ? Object.values(files).flat()[0] : undefined;
  if (!file) throw badRequest('Expected a multipart/form-data request with one image file');
  return file;
}

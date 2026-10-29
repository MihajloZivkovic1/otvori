import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { MENU_IMPORT_LIMITS, menuImportSchema } from '@qr-menu/shared';
import { requireOwner, restaurantIdOf } from '../../middleware/membership.js';
import { badRequest } from '../../utils/errors.js';
import { noStore } from '../../utils/http.js';
import * as service from './service.js';

/** The spreadsheet (CSV / XLSX) is read into memory and sniffed; the file name is irrelevant. */
const sheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MENU_IMPORT_LIMITS.maxFileBytes, files: 1, fields: 2, parts: 3 },
}).single('file');

/** /api/admin/restaurants/:restaurantId/menu/import/* — owner only (the superadmin passes as implicit owner). */
export const menuImportRouter = Router({ mergeParams: true });

menuImportRouter.get('/template.csv', requireOwner, (_req: Request, res: Response) => {
  res.setHeader('Content-Disposition', 'attachment; filename="otvori-meni-sablon.csv"');
  res.type('text/csv; charset=utf-8').send(service.templateCsv());
});

menuImportRouter.get('/template.xlsx', requireOwner, (_req: Request, res: Response) => {
  res.setHeader('Content-Disposition', 'attachment; filename="otvori-meni-sablon.xlsx"');
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(service.templateXlsx());
});

menuImportRouter.post('/preview', requireOwner, sheetUpload, async (req: Request, res: Response) => {
  if (!req.file) throw badRequest('Attach the spreadsheet as the "file" field');
  noStore(res);
  res.json(await service.previewImport(restaurantIdOf(req), req.file.buffer));
});

menuImportRouter.post('/', requireOwner, async (req: Request, res: Response) => {
  const input = menuImportSchema.parse(req.body);
  noStore(res);
  res.status(201).json(await service.importMenu(restaurantIdOf(req), input));
});

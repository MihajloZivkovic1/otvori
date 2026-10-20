import { Router } from 'express';
import { requireOwner } from '../../middleware/membership.js';
import * as controller from './controller.js';

export const tablesRouter = Router({ mergeParams: true });

tablesRouter.get('/', controller.listTables);
tablesRouter.post('/', controller.createTable);
tablesRouter.put('/reorder', controller.reorderTables);
tablesRouter.get('/qr-sheet.pdf', controller.qrSheet);
tablesRouter.get('/:id/qr.png', controller.qrPng);
tablesRouter.get('/:id/qr.svg', controller.qrSvg);
tablesRouter.patch('/:id', controller.updateTable);
tablesRouter.delete('/:id', requireOwner, controller.deleteTable);

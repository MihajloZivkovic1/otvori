import { Router } from 'express';
import { requireOwner } from '../../middleware/membership.js';
import { requireModule } from '../../middleware/modules.js';
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
// "Block 30 min" (both roles): guests at the table get 423 on orders and calls until the block ends.
tablesRouter.post('/:id/block', requireModule('ordering'), controller.blockTable);
tablesRouter.delete('/:id/block', requireModule('ordering'), controller.unblockTable);

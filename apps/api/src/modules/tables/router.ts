import { Router } from 'express';
import { requireOwner } from '../../middleware/membership.js';
import { requireModule } from '../../middleware/modules.js';
import * as controller from './controller.js';

/** Listing and the 30-minute block are service-level; creating, editing, deleting and the QR files are owner-level. */
export const tablesRouter = Router({ mergeParams: true });

tablesRouter.get('/', controller.listTables);
tablesRouter.post('/', requireOwner, controller.createTable);
tablesRouter.put('/reorder', requireOwner, controller.reorderTables);
tablesRouter.get('/qr-sheet.pdf', requireOwner, controller.qrSheet);
tablesRouter.get('/:id/qr.png', requireOwner, controller.qrPng);
tablesRouter.get('/:id/qr.svg', requireOwner, controller.qrSvg);
tablesRouter.patch('/:id', requireOwner, controller.updateTable);
tablesRouter.delete('/:id', requireOwner, controller.deleteTable);
// "Block 30 min" (both roles): guests at the table get 423 on orders and calls until the block ends.
tablesRouter.post('/:id/block', requireModule('ordering'), controller.blockTable);
tablesRouter.delete('/:id/block', requireModule('ordering'), controller.unblockTable);

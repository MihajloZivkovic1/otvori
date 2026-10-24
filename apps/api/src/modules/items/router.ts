import { Router } from 'express';
import { requireOwner } from '../../middleware/membership.js';
import { imageUpload } from '../../middleware/upload.js';
import * as controller from './controller.js';

/**
 * Reading and the availability switch ("unavailable today" / "back at 06:00") are service-level; prices, content,
 * images, order and deletion are owner-level (docs/PERMISSIONS.md).
 */
export const itemsRouter = Router({ mergeParams: true });

itemsRouter.get('/', controller.listItems);
itemsRouter.post('/', requireOwner, controller.createItem);
itemsRouter.put('/reorder', requireOwner, controller.reorderItems);
itemsRouter.get('/:id', controller.getItem);
itemsRouter.patch('/:id', requireOwner, controller.updateItem);
itemsRouter.delete('/:id', requireOwner, controller.deleteItem);
itemsRouter.patch('/:id/availability', controller.setAvailability);
itemsRouter.post('/:id/image', requireOwner, imageUpload, controller.uploadImage);

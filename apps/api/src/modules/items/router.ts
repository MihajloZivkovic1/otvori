import { Router } from 'express';
import { requireOwner } from '../../middleware/membership.js';
import { imageUpload } from '../../middleware/upload.js';
import * as controller from './controller.js';

export const itemsRouter = Router({ mergeParams: true });

itemsRouter.get('/', controller.listItems);
itemsRouter.post('/', controller.createItem);
itemsRouter.put('/reorder', controller.reorderItems);
itemsRouter.get('/:id', controller.getItem);
itemsRouter.patch('/:id', controller.updateItem);
itemsRouter.delete('/:id', requireOwner, controller.deleteItem);
itemsRouter.patch('/:id/availability', controller.setAvailability);
itemsRouter.post('/:id/image', imageUpload, controller.uploadImage);

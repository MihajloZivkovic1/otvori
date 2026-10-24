import { Router } from 'express';
import { requireOwner } from '../../middleware/membership.js';
import * as controller from './controller.js';

/** Reading is service-level; every change to menu structure is owner-level (docs/PERMISSIONS.md). */
export const categoriesRouter = Router({ mergeParams: true });

categoriesRouter.get('/', controller.listCategories);
categoriesRouter.post('/', requireOwner, controller.createCategory);
categoriesRouter.put('/reorder', requireOwner, controller.reorderCategories);
categoriesRouter.patch('/:id', requireOwner, controller.updateCategory);
categoriesRouter.delete('/:id', requireOwner, controller.deleteCategory);

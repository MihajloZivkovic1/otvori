import { Router } from 'express';
import { requireOwner } from '../../middleware/membership.js';
import * as controller from './controller.js';

export const categoriesRouter = Router({ mergeParams: true });

categoriesRouter.get('/', controller.listCategories);
categoriesRouter.post('/', controller.createCategory);
categoriesRouter.put('/reorder', controller.reorderCategories);
categoriesRouter.patch('/:id', controller.updateCategory);
categoriesRouter.delete('/:id', requireOwner, controller.deleteCategory);

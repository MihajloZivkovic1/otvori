import type { Request, Response } from 'express';
import { restaurantIdOf } from '../../middleware/membership.js';
import { noStore, uuidParam } from '../../utils/http.js';
import { createCategorySchema, reorderSchema, updateCategorySchema } from './schemas.js';
import * as service from './service.js';

export async function listCategories(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.listCategories(restaurantIdOf(req)));
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  const input = createCategorySchema.parse(req.body);
  res.status(201).json(await service.createCategory(restaurantIdOf(req), input));
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  const input = updateCategorySchema.parse(req.body);
  res.json(await service.updateCategory(restaurantIdOf(req), uuidParam(req.params.id), input));
}

export async function deleteCategory(req: Request, res: Response): Promise<void> {
  await service.deleteCategory(restaurantIdOf(req), uuidParam(req.params.id));
  res.status(204).end();
}

export async function reorderCategories(req: Request, res: Response): Promise<void> {
  const { ids } = reorderSchema.parse(req.body);
  res.json(await service.reorderCategories(restaurantIdOf(req), ids));
}

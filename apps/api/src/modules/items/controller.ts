import type { Request, Response } from 'express';
import { restaurantIdOf } from '../../middleware/membership.js';
import { uploadedFile } from '../../middleware/upload.js';
import { noStore, uuidParam } from '../../utils/http.js';
import { availabilitySchema, createItemSchema, listItemsQuerySchema, reorderSchema, updateItemSchema } from './schemas.js';
import * as service from './service.js';

export async function listItems(req: Request, res: Response): Promise<void> {
  const query = listItemsQuerySchema.parse(req.query);
  noStore(res);
  res.json(await service.listItems(restaurantIdOf(req), query));
}

export async function getItem(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.getItem(restaurantIdOf(req), uuidParam(req.params.id)));
}

export async function createItem(req: Request, res: Response): Promise<void> {
  const input = createItemSchema.parse(req.body);
  res.status(201).json(await service.createItem(restaurantIdOf(req), input));
}

export async function updateItem(req: Request, res: Response): Promise<void> {
  const input = updateItemSchema.parse(req.body);
  res.json(await service.updateItem(restaurantIdOf(req), uuidParam(req.params.id), input));
}

export async function deleteItem(req: Request, res: Response): Promise<void> {
  await service.deleteItem(restaurantIdOf(req), uuidParam(req.params.id));
  res.status(204).end();
}

export async function reorderItems(req: Request, res: Response): Promise<void> {
  const { ids } = reorderSchema.parse(req.body);
  res.json(await service.reorderItems(restaurantIdOf(req), ids));
}

export async function setAvailability(req: Request, res: Response): Promise<void> {
  const input = availabilitySchema.parse(req.body);
  res.json(await service.setAvailability(restaurantIdOf(req), uuidParam(req.params.id), input));
}

export async function uploadImage(req: Request, res: Response): Promise<void> {
  const file = uploadedFile(req);
  res.json(await service.uploadItemImage(restaurantIdOf(req), uuidParam(req.params.id), file.buffer));
}

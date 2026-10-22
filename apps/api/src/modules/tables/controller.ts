import type { Request, Response } from 'express';
import { restaurantIdOf } from '../../middleware/membership.js';
import { noStore, uuidParam } from '../../utils/http.js';
import { createTableSchema, reorderSchema, updateTableSchema } from './schemas.js';
import * as service from './service.js';

export async function listTables(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.listTables(restaurantIdOf(req)));
}

export async function createTable(req: Request, res: Response): Promise<void> {
  const input = createTableSchema.parse(req.body);
  res.status(201).json(await service.createTable(restaurantIdOf(req), input));
}

export async function updateTable(req: Request, res: Response): Promise<void> {
  const input = updateTableSchema.parse(req.body);
  res.json(await service.updateTable(restaurantIdOf(req), uuidParam(req.params.id), input));
}

export async function deleteTable(req: Request, res: Response): Promise<void> {
  await service.deleteTable(restaurantIdOf(req), uuidParam(req.params.id));
  res.status(204).end();
}

export async function blockTable(req: Request, res: Response): Promise<void> {
  res.json(await service.blockTable(restaurantIdOf(req), uuidParam(req.params.id)));
}

export async function unblockTable(req: Request, res: Response): Promise<void> {
  res.json(await service.unblockTable(restaurantIdOf(req), uuidParam(req.params.id)));
}

export async function reorderTables(req: Request, res: Response): Promise<void> {
  const { ids } = reorderSchema.parse(req.body);
  res.json(await service.reorderTables(restaurantIdOf(req), ids));
}

export async function qrPng(req: Request, res: Response): Promise<void> {
  const png = await service.tableQrPng(restaurantIdOf(req), uuidParam(req.params.id));
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.type('image/png').send(png);
}

export async function qrSvg(req: Request, res: Response): Promise<void> {
  const svg = await service.tableQrSvg(restaurantIdOf(req), uuidParam(req.params.id));
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.type('image/svg+xml').send(svg);
}

export async function qrSheet(req: Request, res: Response): Promise<void> {
  const { pdf, filename } = await service.qrSheetPdf(restaurantIdOf(req));
  noStore(res);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.type('application/pdf').send(pdf);
}

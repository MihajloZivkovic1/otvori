import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

/**
 * Resolves the restaurant slug from the Host header subdomain
 * (e.g. kafeterija.salveta.menu → "kafeterija") and stores it on req.restaurantSlug.
 * Public routes may then be called without the /:slug segment.
 */
export function hostSlug(req: Request, _res: Response, next: NextFunction): void {
  const suffix = env.publicMenu.hostSuffix;
  if (suffix) {
    const host = (req.hostname ?? '').toLowerCase();
    if (host.endsWith(`.${suffix}`)) {
      const slug = host.slice(0, -(suffix.length + 1));
      if (slug && !slug.includes('.')) req.restaurantSlug = slug;
    }
  }
  next();
}

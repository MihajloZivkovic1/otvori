import { Router } from 'express';
import { hostSlug } from '../../middleware/host-slug.js';
import { publicEventsLimiter } from '../../middleware/rate-limit.js';
import * as controller from './controller.js';

export const publicRouter = Router();

publicRouter.use(hostSlug);
// Host-based (kafeterija.salveta.menu/api/public/menu) and explicit (/api/public/kafeterija/menu) forms.
publicRouter.get('/menu', controller.getMenu);
publicRouter.post('/events', publicEventsLimiter, controller.postEvent);
publicRouter.get('/:slug/menu', controller.getMenu);
publicRouter.post('/:slug/events', publicEventsLimiter, controller.postEvent);

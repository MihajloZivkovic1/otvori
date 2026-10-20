import { Router } from 'express';
import * as controller from './controller.js';

export const analyticsRouter = Router({ mergeParams: true });

analyticsRouter.get('/', controller.getAnalytics);

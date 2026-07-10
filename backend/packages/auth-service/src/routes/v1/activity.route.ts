import express from 'express';
import { getActivities } from '../../controllers/activity.controller.js';
import { authenticateToken } from '../../middleware/authenticate-token.js';

const router = express.Router();

router.use(authenticateToken as any);

router.get('/:organizationId', getActivities as any);

export default router;

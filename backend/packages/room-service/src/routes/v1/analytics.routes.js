import express from 'express';
import { verifyToken } from '../../middleware/auth.js';
import analyticsRouter from '../analytics.js';

const router = express.Router();

// Apply authentication
router.use(verifyToken);

// Mount the existing analytics router
router.use('/', analyticsRouter);

export default router;




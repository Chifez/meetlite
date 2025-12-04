import express from 'express';
import { verifyToken } from '../../middleware/auth.js';
import aiRouter from '../ai.js';

const router = express.Router();

// Mount the existing AI router
// Note: AI router may handle its own authentication or rely on global verifyToken in index.js
router.use('/', aiRouter);

export default router;

import express from 'express';
import calendarRouter from '../calendar.js';

const router = express.Router();

// Calendar routes handle their own authentication (some are public for OAuth callbacks)
// Mount the existing calendar router
router.use('/', calendarRouter);

export default router;




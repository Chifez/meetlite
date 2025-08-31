import express from 'express';
import { WorkspaceController } from '../../controllers/workspace.controller.js';
import { authenticateToken } from '../../middleware/authenticate-token.js';
import { validateWorkspaceSwitch } from '../../middleware/validation.js';
import { asyncHandler } from '../../middleware/error-handler.js';

const router = express.Router();
const workspaceController = new WorkspaceController();

// Apply authentication to all routes
router.use(authenticateToken);

// POST /workspace/switch - Unified workspace switching endpoint
router.post(
  '/switch',
  validateWorkspaceSwitch,
  asyncHandler(workspaceController.switchWorkspace.bind(workspaceController))
);

// GET /workspace/current - Get current workspace information
router.get(
  '/current',
  asyncHandler(
    workspaceController.getCurrentWorkspace.bind(workspaceController)
  )
);

export default router;

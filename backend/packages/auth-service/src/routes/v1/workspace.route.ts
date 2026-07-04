import express from 'express';
import { WorkspaceController } from '../../controllers/workspace.controller.js';
// @ts-ignore
import { authenticateToken } from '../../middleware/authenticate-token.js';
// @ts-ignore
import { validateWorkspaceSwitch } from '../../middleware/validation.js';
// @ts-ignore
import { asyncHandler } from '../../middleware/error-handler.js';

const router = express.Router();
const workspaceController = new WorkspaceController();

router.use(authenticateToken);

router.post(
  '/switch',
  validateWorkspaceSwitch,
  asyncHandler(workspaceController.switchWorkspace.bind(workspaceController))
);

router.get(
  '/current',
  asyncHandler(
    workspaceController.getCurrentWorkspace.bind(workspaceController)
  )
);

export default router;

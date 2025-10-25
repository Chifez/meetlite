import express from 'express';
import { InvitationController } from '../../controllers/invitation.controller.js';
import { validateObjectId } from '../../middleware/validation.js';
import { asyncHandler } from '../../middleware/error-handler.js';

const router = express.Router();
const invitationController = new InvitationController();

// GET /invitations/:token - Get invitation details (public route)
router.get(
  '/:token',

  asyncHandler(
    invitationController.getInvitationDetails.bind(invitationController)
  )
);

// POST /invitations/:token/accept - Accept invitation (requires auth)
router.post(
  '/:token/accept',

  asyncHandler(invitationController.acceptInvitation.bind(invitationController))
);

// POST /invitations/:token/decline - Decline invitation (public route)
router.post(
  '/:token/decline',

  asyncHandler(
    invitationController.declineInvitation.bind(invitationController)
  )
);

export default router;

import express from 'express';
import { InvitationController } from '../../controllers/invitation.controller.js';
// @ts-ignore
import { asyncHandler } from '../../middleware/error-handler.js';

const router = express.Router();
const invitationController = new InvitationController();

router.get(
  '/:token',
  asyncHandler(
    invitationController.getInvitationDetails.bind(invitationController)
  )
);

router.post(
  '/:token/accept',
  asyncHandler(invitationController.acceptInvitation.bind(invitationController))
);

router.post(
  '/:token/decline',
  asyncHandler(
    invitationController.declineInvitation.bind(invitationController)
  )
);

export default router;

import express from 'express';
import { RoomController } from '../../controllers/room.controller.js';
import { verifyToken } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/error-handler.js';

const router = express.Router();
const roomController = new RoomController();

// Apply authentication to all routes
router.use(verifyToken as any);

// POST /rooms - Create a new room
router.post('/', asyncHandler(roomController.createRoom.bind(roomController)) as any);

// GET /rooms/:roomId - Get room details
router.get(
  '/:roomId',
  asyncHandler(roomController.getRoom.bind(roomController)) as any
);

// GET /rooms/:roomId/ice-config - Generate ephemeral TURN server credentials
router.get(
  '/:roomId/ice-config',
  asyncHandler(roomController.getIceConfig.bind(roomController)) as any
);

// POST /rooms/:roomId/join - Join a room
router.post(
  '/:roomId/join',
  asyncHandler(roomController.joinRoom.bind(roomController)) as any
);

// PATCH /rooms/:roomId/collaboration - Update collaboration mode
router.patch(
  '/:roomId/collaboration',
  asyncHandler(roomController.updateCollaborationMode.bind(roomController)) as any
);

// PATCH /rooms/:roomId/participants/:userId/role - Update participant role
router.patch(
  '/:roomId/participants/:userId/role',
  asyncHandler(roomController.updateParticipantRole.bind(roomController)) as any
);

// PATCH /rooms/:roomId/settings - Update room settings
router.patch(
  '/:roomId/settings',
  asyncHandler(roomController.updateRoomSettings.bind(roomController)) as any
);

export default router;

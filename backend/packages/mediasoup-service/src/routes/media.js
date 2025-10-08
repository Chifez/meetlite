import { Router } from 'express';
import { MediaController } from '../controllers/MediaController.js';
import { httpAuthMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Media routes for REST API endpoints
 */
export const createMediaRoutes = (mediaController) => {
  const router = Router();

  // Apply authentication to all routes
  router.use(httpAuthMiddleware);

  // Room creation endpoint
  router.post(
    '/rooms/:roomId',
    asyncHandler(async (req, res) => {
      const { roomId } = req.params;
      const { userId } = req.user;

      // Validate room access
      const validation =
        await mediaController.mediaSoupService.validateRoomAccess(
          roomId,
          userId,
          req.headers.authorization.split(' ')[1]
        );

      if (!validation.valid) {
        return res.status(403).json({
          success: false,
          message: validation.error,
        });
      }

      // Create room
      const roomData = await mediaController.mediaSoupService.createRoom(
        roomId,
        userId
      );

      res.json({
        success: true,
        roomId,
        rtpCapabilities:
          await mediaController.mediaSoupService.getRtpCapabilities(roomId),
        iceServers: mediaController.mediaSoupService.iceServers || [],
      });
    })
  );

  // Get room data endpoint
  router.get(
    '/rooms/:roomId',
    asyncHandler(async (req, res) => {
      const { roomId } = req.params;
      const { userId } = req.user;

      // Validate room access
      const validation =
        await mediaController.mediaSoupService.validateRoomAccess(
          roomId,
          userId,
          req.headers.authorization.split(' ')[1]
        );

      if (!validation.valid) {
        return res.status(403).json({
          success: false,
          message: validation.error,
        });
      }

      // Get room data
      const roomData = mediaController.mediaSoupService.getRoom(roomId);

      if (!roomData) {
        return res.status(404).json({
          success: false,
          message: 'Room not found',
        });
      }

      res.json({
        success: true,
        roomId,
        participants: mediaController.mediaSoupService.getParticipants(roomId),
        rtpCapabilities:
          await mediaController.mediaSoupService.getRtpCapabilities(roomId),
        iceServers: mediaController.mediaSoupService.iceServers || [],
      });
    })
  );

  return router;
};

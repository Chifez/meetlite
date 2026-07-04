import { Router } from 'express';
import { MediaController } from '../controllers/media-controller.js';
import { httpAuthMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error-handler.js';

/**
 * Media routes for REST API endpoints
 */
export const createMediaRoutes = (mediaController: MediaController) => {
  const router = Router();

  router.use(httpAuthMiddleware as any);

  // Room creation endpoint
  router.post(
    '/rooms/:roomId',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { roomId } = req.params;
      const { userId } = req.user;

      const token = req.headers.authorization!.split(' ')[1]!;

      // Validate room access
      const validation =
        await (mediaController.mediaSoupService as any).validateRoomAccess(
          roomId,
          userId,
          token
        );

      if (!validation.valid) {
        return res.status(403).json({
          success: false,
          message: validation.error,
        });
      }

      // Create room
      await (mediaController.mediaSoupService as any).createRoom(
        roomId!,
        userId
      );

      res.json({
        success: true,
        roomId,
        rtpCapabilities:
          await (mediaController.mediaSoupService as any).getRtpCapabilities(roomId!),
        iceServers: (mediaController.mediaSoupService as any).iceServers || [],
      });
    }) as any
  );

  // Get room data endpoint
  router.get(
    '/rooms/:roomId',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { roomId } = req.params;
      const { userId } = req.user;

      const token = req.headers.authorization!.split(' ')[1]!;

      // Validate room access
      const validation =
        await (mediaController.mediaSoupService as any).validateRoomAccess(
          roomId,
          userId,
          token
        );

      if (!validation.valid) {
        return res.status(403).json({
          success: false,
          message: validation.error,
        });
      }

      // Get room data
      const roomData = (mediaController.mediaSoupService as any).getRoom(roomId);

      if (!roomData) {
        return res.status(404).json({
          success: false,
          message: 'Room not found',
        });
      }

      res.json({
        success: true,
        roomId,
        participants: (mediaController.mediaSoupService as any).getParticipants(roomId),
        rtpCapabilities:
          await (mediaController.mediaSoupService as any).getRtpCapabilities(roomId!),
        iceServers: (mediaController.mediaSoupService as any).iceServers || [],
      });
    }) as any
  );

  return router;
};
export default createMediaRoutes;

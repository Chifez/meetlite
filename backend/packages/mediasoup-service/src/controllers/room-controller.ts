import { Request, Response } from 'express';
import { logger } from '../utils/logger.js';

/**
 * RoomController - Handles room management and participant-related Socket.IO events
 */
export class RoomController {
  private mediaSoupService: any;
  private io: any;

  constructor(mediaSoupService: any, io: any) {
    this.mediaSoupService = mediaSoupService;
    this.io = io;
  }

  /**
   * Handle user leaving room
   */
  async handleUserLeft(socket: any, data: any) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      await this.mediaSoupService.removeParticipant(roomId, userId);
      socket.leave(roomId);

      // Notify other participants
      socket.to(roomId).emit('user-left', userId);

      logger.info('User left room', { roomId, userId });
    } catch (error) {
      logger.error('Failed to handle user leaving', error);
    }
  }

  /**
   * Handle leave room
   */
  async handleLeaveRoom(socket: any, data: any) {
    try {
      const { roomId } = data;
      const userId = socket.user.userId;

      await this.mediaSoupService.removeParticipant(roomId, userId);
      socket.leave(roomId);

      // Notify other participants
      socket.to(roomId).emit('participant-left', { userId });

      logger.info('User left room', { roomId, userId });
    } catch (error) {
      logger.error('Failed to leave room', error);
    }
  }

  /**
   * Handle disconnect - clean up all rooms for the user
   */
  async handleDisconnect(socket: any) {
    try {
      const userId = socket.user.userId;
      logger.info('User disconnected from MediaSoup service', { userId });

      // Clean up all rooms this user was in
      const rooms = Array.from(socket.rooms);
      for (const roomId of rooms) {
        if (roomId !== socket.id) {
          try {
            await this.mediaSoupService.removeParticipant(roomId, userId);
            socket.to(roomId).emit('participant-left', { userId });
          } catch (error) {
            logger.error('Error cleaning up user on disconnect', {
              roomId,
              userId,
              error,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error handling disconnect', error);
    }
  }

  /**
   * Get room health status
   */
  getRoomHealth(req: Request, res: Response) {
    try {
      const stats = this.mediaSoupService.getStats();

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        mediasoup: stats,
      });
    } catch (error) {
      logger.error('Failed to get room health', error);
      res.status(500).json({
        status: 'unhealthy',
        error: 'Failed to get health status',
      });
    }
  }

  /**
   * Get room statistics
   */
  getRoomStats(req: Request, res: Response) {
    try {
      const { roomId } = req.params;
      const roomData = this.mediaSoupService.getRoom(roomId);

      if (!roomData) {
        return res.status(404).json({
          success: false,
          message: 'Room not found',
        });
      }

      const participants = this.mediaSoupService.getParticipants(roomId);

      res.json({
        success: true,
        roomId,
        participantCount: participants.length,
        participants: participants.map((p: any) => ({
          userId: p.userId,
          joinedAt: p.joinedAt,
          lastActivity: p.lastActivity,
        })),
        createdAt: roomData.createdAt,
        createdBy: roomData.createdBy,
      });
    } catch (error) {
      logger.error('Failed to get room stats', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get room statistics',
      });
    }
  }

  /**
   * Cleanup room
   */
  async cleanupRoom(req: Request, res: Response) {
    try {
      const { roomId } = req.params;
      await this.mediaSoupService.cleanupRoom(roomId);

      res.json({
        success: true,
        message: 'Room cleaned up successfully',
      });
    } catch (error) {
      logger.error('Failed to cleanup room', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup room',
      });
    }
  }

  /**
   * Get active rooms
   */
  getActiveRooms(req: Request, res: Response) {
    try {
      const stats = this.mediaSoupService.getStats();

      res.json({
        success: true,
        totalRooms: stats.rooms,
        totalParticipants: stats.participants,
        uptime: stats.uptime,
        memory: stats.memory,
      });
    } catch (error) {
      logger.error('Failed to get active rooms', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get active rooms',
      });
    }
  }
}

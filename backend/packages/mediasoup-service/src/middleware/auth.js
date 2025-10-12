import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

/**
 * JWT Authentication middleware for Socket.IO connections
 */
export const authMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    logger.debug('Auth middleware - received token:', {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      socketId: socket.id,
      auth: socket.handshake.auth,
    });

    if (!token) {
      logger.warn('Authentication failed: No token provided', {
        socketId: socket.id,
        ip: socket.handshake.address,
        auth: socket.handshake.auth,
      });
      return next(new Error('Authentication error: No token provided'));
    }

    // Verify JWT token
    logger.debug('Verifying JWT token:', {
      jwtSecret: process.env.JWT_SECRET ? 'Set' : 'Not set',
      tokenPrefix: token.substring(0, 20) + '...',
    });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // CLEAN ARCHITECTURE: Client sends fresh profile data in socket.handshake.auth.profile
    // MediaSoup service stays lightweight - no database/API fetching
    const profileFromClient = socket.handshake.auth.profile || {};

    // Attach user info to socket
    socket.user = {
      userId: decoded.userId,
      email: decoded.email,
      organizationId: decoded.organizationId,
      // Use profile data from client (fresher than JWT)
      name: profileFromClient.name || decoded.name || null,
      useNameInMeetings:
        profileFromClient.useNameInMeetings ??
        decoded.useNameInMeetings ??
        false,
      ...decoded,
    };

    logger.info('✅ [AUTH] User authenticated successfully:', {
      userId: socket.user.userId,
      email: socket.user.email,
      name: socket.user.name,
      useNameInMeetings: socket.user.useNameInMeetings,
      profileFromClient: !!profileFromClient.name,
      socketId: socket.id,
    });

    next();
  } catch (error) {
    logger.error('Authentication failed: Invalid token', {
      error: error.message,
      socketId: socket.id,
      ip: socket.handshake.address,
    });

    if (error.name === 'TokenExpiredError') {
      return next(new Error('Authentication error: Token expired'));
    } else if (error.name === 'JsonWebTokenError') {
      return next(new Error('Authentication error: Invalid token'));
    } else {
      return next(new Error('Authentication error: Token verification failed'));
    }
  }
};

/**
 * HTTP Authentication middleware for REST endpoints
 */
export const httpAuthMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
        code: 'AUTH_001',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      organizationId: decoded.organizationId,
      ...decoded,
    };

    next();
  } catch (error) {
    logger.error('HTTP Authentication failed', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        code: 'AUTH_002',
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'AUTH_003',
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed',
        code: 'AUTH_004',
      });
    }
  }
};

import jwt from 'jsonwebtoken';

export const authMiddleware = (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.userId || !decoded.email) {
      return next(new Error('Authentication error: Invalid token'));
    }

    socket.user = decoded;
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    next(
      new Error('Authentication error: ' + (err.message || 'Invalid token'))
    );
  }
};

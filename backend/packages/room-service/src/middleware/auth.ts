import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const verifyToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  let token: string | null = null;
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    token = authHeader.split(' ')[1] || null;
  }
  
  if (!token && req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

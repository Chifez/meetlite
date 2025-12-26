import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  // Check Authorization header first (standard)
  let token = null;
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    token = authHeader.split(' ')[1];
  }
  
  // Fallback to query parameter for SSE (EventSource doesn't support custom headers)
  if (!token && req.query.token) {
    token = req.query.token;
  }
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
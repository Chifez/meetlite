import cors from 'cors';

// Simple CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5174',
  credentials: true,
  optionsSuccessStatus: 200,
};

export default cors(corsOptions);

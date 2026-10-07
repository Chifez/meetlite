import cors from 'cors';

const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  'http://localhost:5175,http://localhost:5174,http://localhost:3000'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    if (/^http:\/\/localhost:[0-9]+$/.test(origin) || /^http:\/\/127\.0\.0\.1:[0-9]+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

export default cors(corsOptions);

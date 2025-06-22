import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import roomRoutes from './routes/rooms.js';
import { verifyToken } from './middleware/auth.js';
import meetingsRoutes from './routes/meetings.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(verifyToken);

// Routes
app.use('/api/rooms', roomRoutes);
app.use('/api/meetings', meetingsRoutes);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.listen(PORT, () => {
  console.log(`Room service running on port ${PORT}`);
});

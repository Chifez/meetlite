import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { OpenAI } from 'openai';
import { SpeechClient } from '@google-cloud/speech';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5003;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const speechClient = new SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// JWT verification middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database:
      mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  };
  res.json(health);
});

// Routes
app.post(
  '/api/ai/summarize',
  verifyToken,
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { meetingId } = req.body;
      const audioFile = req.files?.audio?.[0];
      const videoFile = req.files?.video?.[0];

      const summary = {
        id: `summary_${Date.now()}`,
        meetingId,
        summary:
          'This is an AI-generated summary of the meeting. Key topics discussed included project planning, team coordination, and upcoming deadlines.',
        actionItems: [
          'Schedule follow-up meeting for next week',
          'Assign tasks to team members',
          'Review project timeline',
        ],
        keyPoints: [
          'Project deadline moved to end of month',
          'New team member joining next week',
          'Budget approval received',
        ],
        participants: ['user1@example.com', 'user2@example.com'],
        duration: 60,
        createdAt: new Date().toISOString(),
      };

      res.json(summary);
    } catch (error) {
      console.error('Summarization error:', error);
      res.status(500).json({ error: 'Failed to generate summary' });
    }
  }
);

app.post(
  '/api/ai/transcribe',
  verifyToken,
  upload.single('audio'),
  async (req, res) => {
    try {
      const audioFile = req.file;

      if (!audioFile) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      const audio = {
        content: audioFile.buffer.toString('base64'),
      };

      const config = {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
      };

      const request = {
        audio: audio,
        config: config,
      };

      const [response] = await speechClient.recognize(request);

      const transcription = response.results
        .map((result) => result.alternatives[0].transcript)
        .join('\n');

      res.json({
        id: `transcript_${Date.now()}`,
        text: transcription,
        confidence: response.results[0]?.alternatives[0]?.confidence || 0.8,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Transcription error:', error);
      res.status(500).json({ error: 'Failed to transcribe audio' });
    }
  }
);

app.post('/api/ai/suggest', verifyToken, async (req, res) => {
  try {
    const { participants, duration, topic } = req.body;

    const suggestions = [
      {
        type: 'time',
        suggestion: 'Schedule for 2:00 PM tomorrow',
        confidence: 0.85,
        reasoning: 'Based on participant availability patterns',
      },
      {
        type: 'duration',
        suggestion: '45 minutes instead of 30',
        confidence: 0.72,
        reasoning: 'Topic complexity suggests longer meeting needed',
      },
      {
        type: 'participant',
        suggestion: 'Add john@example.com to the meeting',
        confidence: 0.68,
        reasoning: 'Frequently attends similar meetings',
      },
    ];

    res.json(suggestions);
  } catch (error) {
    console.error('Suggestion error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

app.get('/api/ai/insights/:meetingId', verifyToken, async (req, res) => {
  try {
    const { meetingId } = req.params;

    const insights = {
      engagement: 85,
      participation: {
        'user1@example.com': 75,
        'user2@example.com': 90,
      },
      topics: ['Project Planning', 'Team Coordination', 'Deadlines'],
      sentiment: 'positive',
      recommendations: [
        'Schedule shorter meetings for better engagement',
        'Include more interactive elements',
        'Follow up on action items promptly',
      ],
    };

    res.json(insights);
  } catch (error) {
    console.error('Insights error:', error);
    res.status(500).json({ error: 'Failed to get insights' });
  }
});

// MongoDB connection options
const mongoOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  useUnifiedTopology: true,
};

// Connect to MongoDB
const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB...');
    const startTime = Date.now();

    await mongoose.connect(process.env.MONGODB_URI, mongoOptions);

    const connectionTime = Date.now() - startTime;
    console.log(`✅ Connected to MongoDB in ${connectionTime}ms`);

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
};

// Process error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Start server
const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`🚀 AI service running on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        mongoose.connection.close(() => {
          console.log('✅ Database connection closed');
          process.exit(0);
        });
      });
    });

    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        mongoose.connection.close(() => {
          console.log('✅ Database connection closed');
          process.exit(0);
        });
      });
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

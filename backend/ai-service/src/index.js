import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { SpeechClient } from '@google-cloud/speech';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { request as undiciRequest } from 'undici';

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
      const { meetingId, transcript, notes } = req.body;
      // You can use transcript or notes as context for the summary
      const context = transcript || notes || '';
      const prompt = `Summarize the following meeting transcript or notes in a concise way. Include key topics, action items, and participants if possible.\n\n${context}`;
      const openRouterRes = await undiciRequest(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'deepseek/deepseek-r1:free',
            messages: [
              {
                role: 'system',
                content:
                  'You are a helpful assistant that summarizes meetings.',
              },
              { role: 'user', content: prompt },
            ],
            max_tokens: 256,
            temperature: 0.5,
          }),
        }
      );
      const data = await openRouterRes.body.json();
      const summary = data.choices?.[0]?.message?.content?.trim() || '';
      res.json({ summary });
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
    const prompt = `Given the following meeting context, suggest improvements for time, duration, and participants.\nParticipants: ${participants}\nDuration: ${duration}\nTopic: ${topic}`;
    const openRouterRes = await undiciRequest(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-r1:free',
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant that suggests meeting improvements.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 128,
          temperature: 0.7,
        }),
      }
    );
    const data = await openRouterRes.body.json();
    const suggestions = data.choices?.[0]?.message?.content?.trim() || '';
    res.json({ suggestions });
  } catch (error) {
    console.error('Suggestion error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

app.get('/api/ai/insights/:meetingId', verifyToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    // In a real app, fetch meeting transcript/notes by meetingId
    const prompt = `Given the transcript or notes for meeting ID ${meetingId}, provide insights such as engagement, participation, topics, sentiment, and recommendations.`;
    const openRouterRes = await undiciRequest(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-r1:free',
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant that analyzes meetings and provides insights.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 256,
          temperature: 0.6,
        }),
      }
    );
    const data = await openRouterRes.body.json();
    const insights = data.choices?.[0]?.message?.content?.trim() || '';
    res.json({ insights });
  } catch (error) {
    console.error('Insights error:', error);
    res.status(500).json({ error: 'Failed to get insights' });
  }
});

// AI-generated meeting description endpoint (streaming)
app.post('/api/ai/description', verifyToken, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Meeting title is required.' });
    }

    const prompt = `Generate a short meeting description for: "${title}".`;

    // Prepare OpenRouter streaming request
    const openRouterRes = await undiciRequest(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-r1:free',
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant. Provide direct, concise responses without internal reasoning. Output only the requested content.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 200,
          temperature: 0.7,
          // stream: true,
        }),
      }
    );

    const data = await openRouterRes.body.json();
    const description = data.choices?.[0]?.message?.content?.trim() || '';
    if (!description) {
      return res.status(500).json({ error: 'Failed to generate description.' });
    }
    res.json({ description });
  } catch (error) {
    console.error('Description generation (stream) error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate description.' });
    } else {
      res.end();
    }
  }
});

// Natural language meeting parsing endpoint
app.post('/api/ai/parse-meeting', verifyToken, async (req, res) => {
  try {
    const { input, timezone = 'UTC' } = req.body;
    console.log('Parse meeting request:', { input, timezone });

    if (!input || typeof input !== 'string' || !input.trim()) {
      return res
        .status(400)
        .json({ error: 'Meeting description is required.' });
    }

    // Check if OPENROUTER_API_KEY is available
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY not found in environment variables');
      return res
        .status(500)
        .json({ error: 'AI service not configured properly.' });
    }

    const prompt = `Parse this meeting description into JSON: "${input}" (timezone: ${timezone})

Fill in this exact JSON structure:
{
  "title": "meeting title/purpose",
  "date": "YYYY-MM-DD (convert relative dates like 'tomorrow' to actual date)",
  "time": "HH:MM (24-hour format, e.g., '18:00' for 6pm, '09:00' for 9am)",
  "timezone": "${timezone}",
  "privacy": "public",
  "description": "brief description",
  "participants": ["email1@example.com", "email2@example.com"],
  "duration": 30,
  "confidence": 0.8
}

Rules:
- Convert "tomorrow" to actual date (YYYY-MM-DD)
- Convert "6pm" to "18:00", "9am" to "09:00" (24-hour format)
- Extract any email addresses into participants array
- Set privacy to "private" if input contains "private", "confidential", "internal"
- Default duration is 30 minutes

Return ONLY the JSON object, no other text.`;

    console.log('Calling OpenRouter API...');
    const openRouterRes = await undiciRequest(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-r1:free',
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant. Provide direct, concise responses without internal reasoning. Output only the requested content.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1500,
          reasoning: {
            enable: false,
            max_tokens: 300,
            exclude: true,
          },
          temperature: 0,
        }),
      }
    );

    const data = await openRouterRes.body.json();
    console.log('OpenRouter response:', JSON.stringify(data, null, 2));

    if (!data.choices || !data.choices[0]) {
      console.error('No choices in OpenRouter response');
      return res
        .status(500)
        .json({ error: 'Invalid response from AI service.' });
    }

    const choice = data.choices[0];
    console.log('Choice:', JSON.stringify(choice, null, 2));

    if (choice.finish_reason === 'length') {
      console.error('Response was cut off due to token limit');
      return res.status(500).json({
        error: 'AI response was too long. Please try a shorter description.',
      });
    }

    const responseText = choice.message?.content?.trim() || '';
    console.log('Response text:', responseText);

    if (!responseText) {
      console.error('No response text from OpenRouter');
      return res
        .status(500)
        .json({ error: 'Failed to parse meeting description.' });
    }

    // Extract JSON from response
    let parsedData;
    try {
      // Try to find JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        parsedData = JSON.parse(responseText);
      }
      console.log('Parsed data:', parsedData);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Raw response:', responseText);
      return res.status(500).json({
        error: 'Failed to parse AI response.',
        rawResponse: responseText,
      });
    }

    // Validate required fields
    if (!parsedData.title || !parsedData.date || !parsedData.time) {
      console.error('Missing required fields:', parsedData);
      return res.status(400).json({
        error: 'Could not extract required meeting information.',
        parsedData,
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(parsedData.date)) {
      console.error('Invalid date format:', parsedData.date);
      return res.status(400).json({
        error: 'Invalid date format.',
        parsedData,
      });
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(parsedData.time)) {
      console.error('Invalid time format:', parsedData.time);
      return res.status(400).json({
        error: 'Invalid time format.',
        parsedData,
      });
    }

    console.log('Successfully parsed meeting data');
    res.json({
      success: true,
      data: parsedData,
      confidence: parsedData.confidence || 0.8,
    });
  } catch (error) {
    console.error('Meeting parsing error:', error);
    res.status(500).json({ error: 'Failed to parse meeting description.' });
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
    console.error(
      '⚠️ Failed to connect to MongoDB (continuing without DB):',
      error.message
    );
    // Don't exit the process, continue without MongoDB
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

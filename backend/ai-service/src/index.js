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
      const openAIRes = await undiciRequest(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
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
      const data = await openAIRes.body.json();
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
    const openAIRes = await undiciRequest(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
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
    const data = await openAIRes.body.json();
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
    const openAIRes = await undiciRequest(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
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
    const data = await openAIRes.body.json();
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

    const prompt = `Generate a short meeting description for: "${title}".

Rules:
- Write a brief, professional description
- Do not use hyphens or bullet points
- Keep it to 1-2 sentences maximum
- Focus on the meeting purpose and key topics`;

    // Check if client accepts streaming
    const acceptHeader = req.headers.accept || '';
    const wantsStreaming =
      acceptHeader.includes('text/event-stream') || req.query.stream === 'true';

    if (wantsStreaming) {
      // Set up streaming response
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });

      // Send initial connection message
      res.write('data: {"type": "connected"}\n\n');

      try {
        const openAIRes = await undiciRequest(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo',
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
              stream: true,
            }),
          }
        );

        if (!openAIRes.body) {
          res.write(
            'data: {"type": "error", "message": "No response body"}\n\n'
          );
          res.end();
          return;
        }

        // Stream the response
        for await (const chunk of openAIRes.body) {
          const lines = chunk.toString().split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                res.write('data: {"type": "done"}\n\n');
                res.end();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.choices && parsed.choices[0]?.delta?.content) {
                  const content = parsed.choices[0].delta.content;
                  res.write(
                    `data: {"type": "content", "content": ${JSON.stringify(
                      content
                    )}}\n\n`
                  );
                }
              } catch (parseError) {
                // Skip invalid JSON
              }
            }
          }
        }

        res.write('data: {"type": "done"}\n\n');
        res.end();
      } catch (streamError) {
        console.error('Streaming error:', streamError);
        res.write(`data: {"type": "error", "message": "Streaming failed"}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming response (fallback)
      const openAIRes = await undiciRequest(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
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
          }),
        }
      );

      const data = await openAIRes.body.json();
      const description = data.choices?.[0]?.message?.content?.trim() || '';
      if (!description) {
        return res
          .status(500)
          .json({ error: 'Failed to generate description.' });
      }
      res.json({ description });
    }
  } catch (error) {
    console.error('Description generation error:', error);
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

    // Check if OPENAI_API_KEY is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not found in environment variables');
      return res
        .status(500)
        .json({ error: 'AI service not configured properly.' });
    }

    // Get current date in user's timezone
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    const prompt = `Parse this meeting description into JSON: "${input}" (timezone: ${timezone})

Current date: ${currentDate}

Fill in this exact JSON structure:
{
  "title": "concise meeting title (e.g., 'Team Standup', 'Project Review', 'Client Meeting')",
  "date": "actual date in YYYY-MM-DD format",
  "time": "HH:MM (24-hour format, e.g., '18:00' for 6pm, '09:00' for 9am)",
  "timezone": "${timezone}",
  "privacy": "public",
  "description": "brief meeting description explaining purpose and key topics",
  "participants": ["email1@example.com", "email2@example.com"],
  "duration": 30,
  "confidence": 0.8
}

Rules:
- Use the current date (${currentDate}) as reference for calculating relative dates
- Convert "Monday" to the next Monday from current date
- Convert "next Monday" to the Monday after the next Monday
- Convert "tomorrow" to ${
      new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
- Convert "today" to ${currentDate}
- If no specific date is mentioned, use today's date (${currentDate})
- Convert "6pm" to "18:00", "9am" to "09:00" (24-hour format)
- Extract any email addresses into participants array
- Set privacy to "private" if input contains "private", "confidential", "internal" etc.
- Default duration is 30 minutes
- NEVER return "YYYY-MM-DD" as literal text - always provide an actual date

Title vs Description:
- Title: Short, clear meeting name (e.g., "Team Standup", "Project Review")
- Description: Brief explanation of meeting purpose and key topics (keep it concise)
- DO NOT put "invite [email]" in description - that goes in participants array
- DO NOT put "invite [email]" in title - create a proper meeting title

Examples:
- Input: "Standup for developers and designers and also project managers"
- Title: "Team Standup"
- Description: "Daily standup for dev team to discuss progress and blockers"

Return ONLY the JSON object, no other text.`;

    console.log('Calling OpenAI API...');
    const openAIRes = await undiciRequest(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant. Provide direct, concise responses without internal reasoning. Output only the requested content.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1500,
          temperature: 0,
        }),
      }
    );

    const data = await openAIRes.body.json();
    console.log('OpenAI response:', JSON.stringify(data, null, 2));

    if (!data.choices || !data.choices[0]) {
      console.error('No choices in OpenAI response');
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
      console.error('No response text from OpenAI');
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

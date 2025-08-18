import {
  generateSummary,
  transcribeAudio,
  generateSuggestions,
  generateInsights,
  generateDescription,
  parseMeetingDescription,
  callOpenAI,
} from '../services/aiService.js';
import { request as undiciRequest } from 'undici';

// Summarize meeting
export const summarizeMeeting = async (req, res) => {
  try {
    const { meetingId, transcript, notes } = req.body;
    const summary = await generateSummary(transcript, notes);
    res.json({ summary });
  } catch (error) {
    console.error('Summarization error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
};

// Transcribe audio
export const transcribeMeeting = async (req, res) => {
  try {
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const result = await transcribeAudio(audioFile.buffer);
    res.json(result);
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
};

// Suggest meeting improvements
export const suggestMeetingImprovements = async (req, res) => {
  try {
    const { participants, duration, topic } = req.body;
    const suggestions = await generateSuggestions(
      participants,
      duration,
      topic
    );
    res.json({ suggestions });
  } catch (error) {
    console.error('Suggestion error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
};

// Get meeting insights
export const getMeetingInsights = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const insights = await generateInsights(meetingId);
    res.json({ insights });
  } catch (error) {
    console.error('Insights error:', error);
    res.status(500).json({ error: 'Failed to get insights' });
  }
};

// Generate meeting description (with streaming support)
export const generateMeetingDescription = async (req, res) => {
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
      const description = await generateDescription(title);
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
};

// Parse meeting description
export const parseMeeting = async (req, res) => {
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

    console.log('Calling OpenAI API...');
    const parsedData = await parseMeetingDescription(input, timezone);

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
};

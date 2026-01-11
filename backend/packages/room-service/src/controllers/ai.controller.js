import {
  generateSummary,
  transcribeAudio,
  generateSuggestions,
  generateInsights,
  generateDescription,
  parseMeetingDescription,
  callOpenAI,
} from '../services/ai.service.js';
import { request as undiciRequest } from 'undici';
import { AppError } from '@minimeet/shared';

// Summarize meeting
export const summarizeMeeting = async (req, res) => {
  const { meetingId, transcript, notes } = req.body;
  const summary = await generateSummary(transcript, notes);
  res.json({ summary });
};

// Transcribe audio
export const transcribeMeeting = async (req, res) => {
  const audioFile = req.file;

  if (!audioFile) {
    throw AppError.validation('No audio file provided');
  }

  const result = await transcribeAudio(audioFile.buffer);
  res.json(result);
};

// Suggest meeting improvements
export const suggestMeetingImprovements = async (req, res) => {
  const { participants, duration, topic } = req.body;
  const suggestions = await generateSuggestions(
    participants,
    duration,
    topic
  );
  res.json({ suggestions });
};

// Get meeting insights
export const getMeetingInsights = async (req, res) => {
  const { meetingId } = req.params;
  const insights = await generateInsights(meetingId);
  res.json({ insights });
};

// Generate meeting description (with streaming support)
export const generateMeetingDescription = async (req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    throw AppError.validation('Meeting title is required');
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
      // Handle streaming errors - headers already sent, so just end the stream
      if (!res.headersSent) {
        throw streamError;
      }
      res.write(`data: {"type": "error", "message": "Streaming failed"}\n\n`);
      res.end();
    }
  } else {
    // Non-streaming response (fallback)
    const description = await generateDescription(title);
    if (!description) {
      throw AppError.internal('Failed to generate description');
    }
    res.json({ description });
  }
};

// Parse meeting description
export const parseMeeting = async (req, res) => {
  const { input, timezone = 'UTC', organizationId, teamId } = req.body;

  if (!input || typeof input !== 'string' || !input.trim()) {
    throw AppError.validation('Meeting description is required');
  }

  // Check if OPENAI_API_KEY is available
  if (!process.env.OPENAI_API_KEY) {
    throw AppError.internal('AI service not configured properly');
  }

  // Fetch teams and members for context if organizationId is provided
  let teamsContext = [];
  if (organizationId) {
    try {
      const { models } = await import('../index.js');
      const teams = await models.Team.find({
        organizationId,
        status: { $ne: 'deleted' },
      })
        .select('_id name')
        .lean();

      if (teams.length > 0) {
        // Get team members for each team
        for (const team of teams) {
          const teamDoc = await models.Team.findById(team._id)
            .populate('members.userId', 'email name')
            .lean();

          if (teamDoc && teamDoc.members) {
            const members = teamDoc.members
              .filter((m) => m.status === 'active' && m.userId)
              .map((m) => ({
                email: m.userId.email,
                name: m.userId.name,
              }));

            teamsContext.push({
              id: team._id.toString(),
              name: team.name,
              members,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching teams context:', error);
      // Continue without team context if fetch fails
    }
  }

  const parsedData = await parseMeetingDescription(
    input,
    timezone,
    teamsContext
  );

  res.json({
    success: true,
    data: parsedData,
    confidence: parsedData.confidence || 0.8,
  });
};

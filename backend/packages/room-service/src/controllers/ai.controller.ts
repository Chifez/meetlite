import { Request, Response } from 'express';
import {
  generateSummary,
  transcribeAudio,
  generateSuggestions,
  generateInsights,
  generateDescription,
  parseMeetingDescription,
} from '../services/ai.service.js';
import { request as undiciRequest } from 'undici';
import { AppError } from '@minimeet/shared';
import { prisma } from '@minimeet/shared';
import { MeetingAuthorizationService } from '../services/meeting-authorization.service.js';

// Summarize meeting
export const summarizeMeeting = async (req: Request, res: Response) => {
  const { transcript, notes } = req.body;
  const summary = await generateSummary(transcript, notes);
  res.json({ summary });
};

// Transcribe audio
export const transcribeMeeting = async (req: any, res: Response) => {
  const audioFile = req.file;

  if (!audioFile) {
    throw AppError.validation('No audio file provided');
  }

  const result = await transcribeAudio(audioFile.buffer);
  res.json(result);
};

// Suggest meeting improvements
export const suggestMeetingImprovements = async (req: Request, res: Response) => {
  const { participants, duration, topic } = req.body;
  const suggestions = await generateSuggestions(
    participants,
    duration,
    topic
  );
  res.json({ suggestions });
};

// Get meeting insights
export const getMeetingInsights = async (req: Request, res: Response) => {
  const { meetingId } = req.params;
  const user = (req as any).user;
  const idStr = meetingId as string;

  const meeting = await prisma.meeting.findUnique({
    where: { id: idStr },
    include: { participants: true, invites: true },
  }) as any;
  
  if (!meeting) {
    throw AppError.notFound('Meeting');
  }

  const canAccess = await MeetingAuthorizationService.canAccess(
    meeting,
    user.userId,
    user.email,
    user.organizationId || meeting.organizationId || ''
  );
  if (!canAccess) {
    throw AppError.forbidden('Access denied to this meeting');
  }

  const recording = await prisma.meetingRecording.findFirst({
    where: { meetingId: idStr },
    select: { transcriptText: true }
  });
  
  const transcript = recording?.transcriptText || 'No transcript available.';

  const insights = await generateInsights({
    title: meeting.title,
    duration: meeting.duration,
    transcript
  });

  res.json({ insights });
};

// Generate meeting description (with streaming support)
export const generateMeetingDescription = async (req: Request, res: Response) => {
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
      for await (const chunk of openAIRes.body as any) {
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
export const parseMeeting = async (req: Request, res: Response) => {
  const { input, timezone = 'UTC', organizationId } = req.body;

  if (!input || typeof input !== 'string' || !input.trim()) {
    throw AppError.validation('Meeting description is required');
  }

  // Check if OPENAI_API_KEY is available
  if (!process.env.OPENAI_API_KEY) {
    throw AppError.internal('AI service not configured properly');
  }

  // Fetch teams and members for context if organizationId is provided
  let teamsContext: any[] = [];
  if (organizationId) {
    try {
      const teams = await prisma.team.findMany({
        where: {
          organizationId,
          status: { not: 'deleted' }
        },
        include: {
          members: {
            include: { user: { select: { email: true, name: true } } }
          }
        }
      });

      if (teams.length > 0) {
        for (const team of teams) {
          if (team.members && team.members.length > 0) {
            const members = team.members
              .filter((m: any) => m.status === 'active' && m.user)
              .map((m: any) => ({
                email: m.user.email,
                name: m.user.name,
              }));

            teamsContext.push({
              id: team.id,
              name: team.name,
              members,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching teams context:', error);
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

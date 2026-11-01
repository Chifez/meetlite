import { SpeechClient } from '@google-cloud/speech';
import { request as undiciRequest } from 'undici';
import { Redis } from 'ioredis';
import { SmartSchedulingPipeline } from './smart-scheduling/smart-scheduling.pipeline.js';
export { SmartSchedulingPipeline } from './smart-scheduling/smart-scheduling.pipeline.js';

// Google Speech client
const speechClient = new SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// Fail-fast environment key validation check
if (!process.env.OPENAI_API_KEY) {
  console.warn('WARN: OPENAI_API_KEY environment variable is not defined. AI features will fail if invoked.');
}

// Add per-user Redis rate limiting for AI endpoints
const AI_CALLS_PER_HOUR = parseInt(process.env.AI_CALLS_PER_USER_PER_HOUR ?? '10');

export const checkAIRateLimit = async (userId: string, redis: Redis): Promise<boolean> => {
  const key = `ai:ratelimit:${userId}:${Math.floor(Date.now() / 3_600_000)}`;
  const count = await redis.incr(key);
  await redis.expire(key, 3600);
  return count <= AI_CALLS_PER_HOUR;
};

// OpenAI API call helper with retry and exponential backoff
export const callOpenAI = async (messages: any[], options = {}, retries = 3): Promise<any> => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not defined.');
  }
  const defaultOptions = {
    model: 'gpt-3.5-turbo',
    max_tokens: 256,
    temperature: 0.5,
    ...options,
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await undiciRequest(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...defaultOptions,
            messages,
          }),
        }
      );

      const responseBody: any = await response.body.json();
      if (responseBody.error) {
        throw new Error(responseBody.error.message || 'OpenAI API Error');
      }
      return responseBody;
    } catch (err: any) {
      console.warn(`OpenAI call attempt ${attempt + 1} failed:`, err.message);
      if (attempt === retries - 1) throw err;
      await sleep(Math.pow(2, attempt) * 1000); // 1s, 2s, 4s backoff
    }
  }
};

// Generate meeting summary
export const generateSummary = async (transcript: string, notes: string): Promise<string> => {
  const context = transcript || notes || '';
  const prompt = `Summarize the following meeting transcript or notes in a concise way. Include key topics, action items, and participants if possible.\n\n${context}`;

  const data = await callOpenAI([
    {
      role: 'system',
      content: 'You are a helpful assistant that summarizes meetings.',
    },
    { role: 'user', content: prompt },
  ]);

  return data.choices?.[0]?.message?.content?.trim() || '';
};

// Transcribe audio using Google Speech-to-Text
export const transcribeAudio = async (audioBuffer: Buffer): Promise<any> => {
  const audio = {
    content: audioBuffer.toString('base64'),
  };

  const config = {
    encoding: 'WEBM_OPUS' as const,
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

  const transcription = response.results!
    .map((result) => result.alternatives![0].transcript)
    .join('\n');

  return {
    id: `transcript_${Date.now()}`,
    text: transcription,
    confidence: response.results![0]?.alternatives![0]?.confidence || 0.8,
    timestamp: new Date().toISOString(),
  };
};

// Generate meeting suggestions
export const generateSuggestions = async (participants: string, duration: string | number, topic: string): Promise<string> => {
  const prompt = `Given the following meeting context, suggest improvements for time, duration, and participants.\nParticipants: ${participants}\nDuration: ${duration}\nTopic: ${topic}`;

  const data = await callOpenAI(
    [
      {
        role: 'system',
        content:
          'You are a helpful assistant that suggests meeting improvements.',
      },
      { role: 'user', content: prompt },
    ],
    {
      max_tokens: 128,
      temperature: 0.7,
    }
  );

  return data.choices?.[0]?.message?.content?.trim() || '';
};

// Generate meeting insights (pure function, no DB dependencies)
export const generateInsights = async (params: {
  title: string;
  duration: number;
  transcript: string;
}): Promise<string> => {
  const { title, duration, transcript } = params;

  const prompt = `Given the transcript or notes for meeting "${title}", provide insights such as engagement, participation, topics, sentiment, and recommendations.\n\nTranscript:\n${transcript}`;

  const data = await callOpenAI(
    [
      {
        role: 'system',
        content:
          'You are a helpful assistant that analyzes meetings and provides insights.',
      },
      { role: 'user', content: prompt },
    ],
    {
      max_tokens: 256,
      temperature: 0.6,
    }
  );

  return data.choices?.[0]?.message?.content?.trim() || '';
};

// Generate meeting description (non-streaming)
export const generateDescription = async (title: string): Promise<string> => {
  const prompt = `Generate a short meeting description for: "${title}".

Rules:
- Write a brief, professional description
- Do not use hyphens or bullet points
- Keep it to 1-2 sentences maximum
- Focus on the meeting purpose and key topics`;

  const data = await callOpenAI(
    [
      {
        role: 'system',
        content:
          'You are a helpful assistant. Provide direct, concise responses without internal reasoning. Output only the requested content.',
      },
      { role: 'user', content: prompt },
    ],
    {
      max_tokens: 200,
      temperature: 0.7,
    }
  );

  return data.choices?.[0]?.message?.content?.trim() || '';
};

// Parse meeting description using Gated AI + Deterministic Pipeline
export const parseMeetingDescription = async (
  input: string,
  timezone = 'UTC',
  teamsContext: any[] = []
): Promise<any> => {
  const result = await SmartSchedulingPipeline.process(
    input,
    timezone,
    teamsContext
  );

  return result.data;
};

/**
 * Transcribe video/audio recording using OpenAI Whisper
 */
export const transcribeRecording = async (audioUrl: string): Promise<any> => {
  try {
    const audioResponse = await undiciRequest(audioUrl);
    const audioBuffer = Buffer.from(await audioResponse.body.arrayBuffer());

    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mp3' });
    formData.append('file', audioBlob, 'recording.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    const response = await undiciRequest(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData as any,
      }
    );

    const transcriptData: any = await response.body.json();

    if (!transcriptData.text) {
      throw new Error('No transcript text received from OpenAI');
    }

    const segments =
      transcriptData.segments?.map((segment: any) => ({
        startTime: segment.start,
        endTime: segment.end,
        speaker: 'Unknown',
        text: segment.text.trim(),
        confidence: segment.avg_logprob ? Math.exp(segment.avg_logprob) : 0.8,
      })) || [];

    return {
      success: true,
      text: transcriptData.text,
      segments,
      language: transcriptData.language || 'en',
      duration: transcriptData.duration,
    };
  } catch (error) {
    console.error('Error transcribing recording:', error);
    throw error;
  }
};

/**
 * Generate AI summary from transcript
 */
export const generateRecordingSummary = async (transcript: string, options: any = {}): Promise<any> => {
  try {
    const { meetingContext = '', participantCount = 1, duration = 0 } = options;

    const systemPrompt = `You are an AI assistant that analyzes meeting recordings and creates comprehensive summaries. 

Your task is to analyze the transcript and provide:
1. A concise overall summary (2-3 sentences)
2. Key points discussed (bullet format)
3. Action items with assignments and due dates where possible
4. Topics covered
5. Overall sentiment analysis

You MUST respond in pure JSON. Do not include markdown blocks or other text. Ensure the JSON strictly follows this exact schema:
{
  "summary": "Brief 2-3 sentence overview of the meeting",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "actionItems": [
    {
      "task": "Description of task",
      "assignee": "Person assigned (if mentioned)",
      "dueDate": "YYYY-MM-DD (if mentioned, otherwise null)",
      "priority": "high|medium|low"
    }
  ],
  "topics": ["Topic 1", "Topic 2", "Topic 3"],
  "sentiment": {
    "overall": "positive|neutral|negative",
    "score": 0.5
  }
}`;

    const userPrompt = `Meeting Context: ${meetingContext}
Participants: ${participantCount}
Duration: ${Math.round(duration / 60)} minutes

Transcript:
${transcript}`;

    const data = await callOpenAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        model: 'gpt-4-turbo-preview', // Stronger model for JSON
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.3,
      }
    );

    const responseText = data.choices?.[0]?.message?.content?.trim();

    if (!responseText) {
      throw new Error('No response from AI service');
    }

    const summaryData = JSON.parse(responseText); // Safe to parse due to json_object flag

    if (!summaryData.summary || !Array.isArray(summaryData.keyPoints)) {
      throw new Error('Invalid summary format received');
    }

    return {
      success: true,
      ...summaryData,
    };
  } catch (error) {
    console.error('Error generating recording summary:', error);
    throw error;
  }
};

/**
 * Extract speaker insights from transcript segments
 */
export const analyzeRecordingSpeakers = async (segments: any[]): Promise<any> => {
  try {
    const speakerStats: Record<string, any> = {};
    let totalDuration = 0;

    segments.forEach((segment) => {
      const speaker = segment.speaker || 'Unknown';
      const duration = segment.endTime - segment.startTime;

      if (!speakerStats[speaker]) {
        speakerStats[speaker] = {
          totalTime: 0,
          segmentCount: 0,
          avgConfidence: 0,
        };
      }

      speakerStats[speaker].totalTime += duration;
      speakerStats[speaker].segmentCount += 1;
      speakerStats[speaker].avgConfidence += segment.confidence || 0;
      totalDuration += duration;
    });

    Object.keys(speakerStats).forEach((speaker) => {
      const stats = speakerStats[speaker];
      stats.percentage =
        totalDuration > 0 ? (stats.totalTime / totalDuration) * 100 : 0;
      stats.avgConfidence =
        stats.segmentCount > 0 ? stats.avgConfidence / stats.segmentCount : 0;
    });

    return {
      success: true,
      totalDuration,
      speakerCount: Object.keys(speakerStats).length,
      speakers: speakerStats,
    };
  } catch (error) {
    console.error('Error analyzing speakers:', error);
    throw error;
  }
};

/**
 * Generate meeting insights and recommendations
 */
export const generateRecordingInsights = async (recordingData: any): Promise<any> => {
  try {
    const { transcript, duration, participantCount, title } = recordingData;

    const prompt = `Analyze this meeting recording and provide insights:

Meeting: ${title}
Duration: ${Math.round(duration / 60)} minutes
Participants: ${participantCount}

Transcript: ${transcript}

Provide insights on:
1. Meeting effectiveness (was time used well?)
2. Participation balance (did everyone contribute?)
3. Key decisions made
4. Follow-up recommendations
5. Meeting quality score (1-10)

Format as JSON with these fields:
{
  "effectiveness": "High|Medium|Low",
  "participationBalance": "Balanced|Unbalanced",
  "keyDecisions": ["Decision 1", "Decision 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "qualityScore": 8,
  "insights": "Overall assessment paragraph"
}`;

    const data = await callOpenAI(
      [
        {
          role: 'system',
          content:
            'You are a meeting effectiveness analyst. Provide objective insights about meeting quality and outcomes.',
        },
        { role: 'user', content: prompt },
      ],
      {
        model: 'gpt-4',
        max_tokens: 1000,
        temperature: 0.4,
      }
    );

    const responseText = data.choices?.[0]?.message?.content?.trim();

    if (!responseText) {
      throw new Error('No insights response from AI service');
    }

    let insightsData;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insightsData = JSON.parse(jsonMatch[0]);
      } else {
        insightsData = JSON.parse(responseText);
      }
    } catch (parseError) {
      throw new Error(`Failed to parse insights response: ${responseText}`);
    }

    return {
      success: true,
      ...insightsData,
    };
  } catch (error) {
    console.error('Error generating insights:', error);
    throw error;
  }
};

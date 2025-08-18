import { SpeechClient } from '@google-cloud/speech';
import { request as undiciRequest } from 'undici';

// Google Speech client
const speechClient = new SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// OpenAI API call helper
export const callOpenAI = async (messages, options = {}) => {
  const defaultOptions = {
    model: 'gpt-3.5-turbo',
    max_tokens: 256,
    temperature: 0.5,
    ...options,
  };

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

  return await response.body.json();
};

// Generate meeting summary
export const generateSummary = async (transcript, notes) => {
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
export const transcribeAudio = async (audioBuffer) => {
  const audio = {
    content: audioBuffer.toString('base64'),
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

  return {
    id: `transcript_${Date.now()}`,
    text: transcription,
    confidence: response.results[0]?.alternatives[0]?.confidence || 0.8,
    timestamp: new Date().toISOString(),
  };
};

// Generate meeting suggestions
export const generateSuggestions = async (participants, duration, topic) => {
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

// Generate meeting insights
export const generateInsights = async (meetingId) => {
  const prompt = `Given the transcript or notes for meeting ID ${meetingId}, provide insights such as engagement, participation, topics, sentiment, and recommendations.`;

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
export const generateDescription = async (title) => {
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

// Parse meeting description using AI
export const parseMeetingDescription = async (input, timezone = 'UTC') => {
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];

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
      max_tokens: 1500,
      temperature: 0,
    }
  );

  const responseText = data.choices?.[0]?.message?.content?.trim() || '';

  if (!responseText) {
    throw new Error('No response from AI service');
  }

  // Extract JSON from response
  let parsedData;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedData = JSON.parse(jsonMatch[0]);
    } else {
      parsedData = JSON.parse(responseText);
    }
  } catch (parseError) {
    throw new Error(`Failed to parse AI response: ${responseText}`);
  }

  // Validate required fields
  if (!parsedData.title || !parsedData.date || !parsedData.time) {
    throw new Error('Missing required fields in parsed data');
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(parsedData.date)) {
    throw new Error('Invalid date format');
  }

  // Validate time format
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(parsedData.time)) {
    throw new Error('Invalid time format');
  }

  return parsedData;
};

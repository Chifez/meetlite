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
export const parseMeetingDescription = async (
  input,
  timezone = 'UTC',
  teamsContext = []
) => {
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];

  // Add teams context to prompt if available
  let teamsInfo = '';
  if (teamsContext && teamsContext.length > 0) {
    teamsInfo = '\n\nAvailable Teams:\n';
    teamsContext.forEach((team) => {
      const memberEmails = team.members.map((m) => m.email).join(', ');
      teamsInfo += `- "${team.name}" (members: ${memberEmails})\n`;
    });
    teamsInfo +=
      '\nWhen user mentions a team name (e.g., "dev team", "design team", "the dev team"), extract the team name and include ALL team member emails in the participants array.\n';
  }

  const prompt = `Parse this meeting description into JSON: "${input}" (timezone: ${timezone})${teamsInfo}

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
  "confidence": 0.8,
  "recurrence": {
    "enabled": false,
    "pattern": "weekly",
    "interval": 1,
    "daysOfWeek": [],
    "dayOfMonth": null,
    "endType": "never",
    "endDate": null,
    "occurrences": null
  }
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

Recurrence Rules:
- Set recurrence.enabled to true if input contains words like "every", "recurring", "repeat", "weekly", "daily", "monthly", "regularly"
- Pattern mapping:
  * "every day" / "daily" → pattern: "daily"
  * "weekdays" / "week days" / "Mon-Fri" / "Monday to Friday" → pattern: "weekdays"
  * "every [day]" / "every Wednesday" / "weekly" → pattern: "weekly", daysOfWeek: [day number]
  * "every month" / "monthly" → pattern: "monthly"
  * "every year" / "yearly" / "annually" → pattern: "yearly"
- Day numbers: Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6
- Interval: Extract number from "every 2 weeks" → interval: 2, or default to 1
- Days of week: For weekly pattern, extract day names and convert to numbers (e.g., "every Wednesday" → daysOfWeek: [3])
- End conditions:
  * "until [date]" / "ending [date]" → endType: "on", endDate: "YYYY-MM-DD"
  * "for [N] times" / "for [N] occurrences" → endType: "after", occurrences: N
  * If no end mentioned → endType: "never"
- If recurrence.enabled is false, set all other recurrence fields to null or default values

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

// ========== NEW RECORDING AI FUNCTIONS ==========

/**
 * Transcribe video/audio recording using OpenAI Whisper
 * @param {string} audioUrl - URL to the audio file
 * @returns {Promise<Object>} Transcript with segments
 */
export const transcribeRecording = async (audioUrl) => {
  try {
    // Download audio file
    const audioResponse = await undiciRequest(audioUrl);
    const audioBuffer = Buffer.from(await audioResponse.body.arrayBuffer());

    // Create form data for OpenAI Whisper
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
        body: formData,
      }
    );

    const transcriptData = await response.body.json();

    if (!transcriptData.text) {
      throw new Error('No transcript text received from OpenAI');
    }

    // Format segments for our schema
    const segments =
      transcriptData.segments?.map((segment) => ({
        startTime: segment.start,
        endTime: segment.end,
        speaker: 'Unknown', // Whisper doesn't provide speaker identification
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
 * @param {string} transcript - The full transcript text
 * @param {Object} options - Summary options
 * @returns {Promise<Object>} Comprehensive summary with action items
 */
export const generateRecordingSummary = async (transcript, options = {}) => {
  try {
    const { meetingContext = '', participantCount = 1, duration = 0 } = options;

    const systemPrompt = `You are an AI assistant that analyzes meeting recordings and creates comprehensive summaries. 

Your task is to analyze the transcript and provide:
1. A concise overall summary (2-3 sentences)
2. Key points discussed (bullet format)
3. Action items with assignments and due dates where possible
4. Topics covered
5. Overall sentiment analysis

Format your response as valid JSON with this exact structure:
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
${transcript}

Please analyze this meeting transcript and provide a comprehensive summary in the requested JSON format.`;

    const data = await callOpenAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        model: 'gpt-4',
        max_tokens: 2000,
        temperature: 0.3,
      }
    );

    const responseText = data.choices?.[0]?.message?.content?.trim();

    if (!responseText) {
      throw new Error('No response from AI service');
    }

    // Parse JSON response
    let summaryData;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summaryData = JSON.parse(jsonMatch[0]);
      } else {
        summaryData = JSON.parse(responseText);
      }
    } catch (parseError) {
      throw new Error(`Failed to parse AI summary response: ${responseText}`);
    }

    // Validate required fields
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
 * @param {Array} segments - Transcript segments with timing
 * @returns {Promise<Object>} Speaker analysis
 */
export const analyzeRecordingSpeakers = async (segments) => {
  try {
    // Calculate speaking time and patterns
    const speakerStats = {};
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

    // Calculate percentages and averages
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
 * @param {Object} recordingData - Full recording data with transcript and metadata
 * @returns {Promise<Object>} Insights and recommendations
 */
export const generateRecordingInsights = async (recordingData) => {
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

    // Parse JSON response
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

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { env } from '@/config/env';

interface AISummary {
  id: string;
  meetingId: string;
  summary: string;
  actionItems: string[];
  keyPoints: string[];
  participants: string[];
  duration: number;
  createdAt: string;
}

interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  timestamp: number;
  confidence: number;
}

interface SmartSuggestion {
  type: 'time' | 'participant' | 'duration' | 'topic';
  suggestion: string;
  confidence: number;
  reasoning: string;
}

export const useAIFeatures = () => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  // Generate meeting summary from audio/video recording
  const generateMeetingSummary = useCallback(
    async (
      meetingId: string,
      audioBlob?: Blob,
      videoBlob?: Blob
    ): Promise<AISummary> => {
      setIsProcessing(true);
      try {
        const formData = new FormData();
        formData.append('meetingId', meetingId);

        if (audioBlob) {
          formData.append('audio', audioBlob, 'meeting-audio.webm');
        }
        if (videoBlob) {
          formData.append('video', videoBlob, 'meeting-video.webm');
        }

        const response = await api.post('/api/ai/summarize', formData);

        return response.data;
      } catch (error) {
        console.error('Summary generation error:', error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  // Real-time transcription during meetings
  const startTranscription = useCallback(
    async (
      meetingId: string,
      audioStream: MediaStream
    ): Promise<{
      stop: () => void;
      onTranscription: (
        callback: (segment: TranscriptionSegment) => void
      ) => void;
    }> => {
      const mediaRecorder = new MediaRecorder(audioStream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);

          // Send chunk for real-time transcription
          const formData = new FormData();
          formData.append('audio', event.data);
          formData.append('meetingId', meetingId);

          try {
            const response = await api.post(
              `${env.AI_SERVICE_URL}/transcribe`,
              formData
            );

            if (response.data) {
              // Emit transcription event
              window.dispatchEvent(
                new CustomEvent('transcription', {
                  detail: response.data,
                })
              );
            }
          } catch (error) {
            console.error('Transcription error:', error);
          }
        }
      };

      mediaRecorder.start(5000); // Process every 5 seconds

      return {
        stop: () => {
          mediaRecorder.stop();
        },
        onTranscription: (callback) => {
          window.addEventListener('transcription', (event: any) => {
            callback(event.detail);
          });
        },
      };
    },
    []
  );

  // Smart scheduling suggestions
  const getSmartSuggestions = useCallback(
    async (
      participants: string[],
      duration: number,
      topic?: string
    ): Promise<SmartSuggestion[]> => {
      try {
        const response = await api.post('/api/ai/suggest', {
          participants,
          duration,
          topic,
        });

        return response.data;
      } catch (error) {
        console.error('Smart suggestions error:', error);
        return [];
      }
    },
    []
  );

  // AI-powered meeting insights
  const getMeetingInsights = useCallback(
    async (
      meetingId: string
    ): Promise<{
      engagement: number;
      participation: Record<string, number>;
      topics: string[];
      sentiment: 'positive' | 'neutral' | 'negative';
      recommendations: string[];
    }> => {
      try {
        const response = await api.get(
          `${env.AI_SERVICE_URL}/insights/${meetingId}`
        );

        return response.data;
      } catch (error) {
        console.error('Meeting insights error:', error);
        return {
          engagement: 0,
          participation: {},
          topics: [],
          sentiment: 'neutral',
          recommendations: [],
        };
      }
    },
    []
  );

  // AI-powered noise suppression
  const enableAINoiseSuppression = useCallback(
    async (audioStream: MediaStream): Promise<MediaStream> => {
      try {
        // Use Web Audio API for real-time noise suppression
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(audioStream);
        const destination = audioContext.createMediaStreamDestination();

        // Create noise suppression node (using AI model)
        const noiseSuppressionNode = audioContext.createScriptProcessor(
          4096,
          1,
          1
        );

        noiseSuppressionNode.onaudioprocess = async (event) => {
          const inputBuffer = event.inputBuffer;
          const outputBuffer = event.outputBuffer;

          // Process audio through AI noise suppression
          const processedAudio = await processAudioWithAI(inputBuffer);

          // Copy processed audio to output
          for (
            let channel = 0;
            channel < outputBuffer.numberOfChannels;
            channel++
          ) {
            const outputData = outputBuffer.getChannelData(channel);
            outputData.set(processedAudio[channel]);
          }
        };

        source.connect(noiseSuppressionNode);
        noiseSuppressionNode.connect(destination);

        return destination.stream;
      } catch (error) {
        console.error('AI noise suppression error:', error);
        return audioStream; // Fallback to original stream
      }
    },
    []
  );

  // Helper function for AI audio processing
  const processAudioWithAI = async (
    audioBuffer: AudioBuffer
  ): Promise<Float32Array[]> => {
    // This would integrate with an AI service for noise suppression
    // For now, return the original audio
    const channels: Float32Array[] = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }
    return channels;
  };

  return {
    isProcessing,
    generateMeetingSummary,
    startTranscription,
    getSmartSuggestions,
    getMeetingInsights,
    enableAINoiseSuppression,
  };
};

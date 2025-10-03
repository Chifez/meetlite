import { useState, useCallback } from 'react';
import { env } from '@/config/env';
import api from '@/lib/axios';
import Cookies from 'js-cookie';

interface StreamingAIResponse {
  type: 'connected' | 'content' | 'done' | 'error';
  content?: string;
  message?: string;
}

export const useStreamingAI = () => {
  const [isStreaming, setIsStreaming] = useState(false);

  const streamDescription = useCallback(
    async (
      title: string,
      onContent: (content: string) => void,
      onComplete: (fullContent: string) => void,
      onError: (error: string) => void
    ) => {
      if (!title || !title.trim()) {
        onError('Meeting title is required');
        return;
      }

      setIsStreaming(true);
      let fullContent = '';

      try {
        // Get token from cookies (same as axios interceptor)
        const token = Cookies.get('token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        };

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(
          `${env.AI_SERVICE_URL}/description?stream=true`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ title }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body reader available');
        }

        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data: StreamingAIResponse = JSON.parse(line.slice(6));

                switch (data.type) {
                  case 'connected':
                    // Connection established
                    break;
                  case 'content':
                    if (data.content) {
                      fullContent += data.content;
                      onContent(data.content);
                    }
                    break;
                  case 'done':
                    onComplete(fullContent);
                    return;
                  case 'error':
                    onError(data.message || 'Streaming error occurred');
                    return;
                }
              } catch (parseError) {
                // Skip invalid JSON lines
              }
            }
          }
        }
      } catch (error) {
        console.error('Streaming error:', error);
        onError(
          error instanceof Error
            ? error.message
            : 'Failed to stream description'
        );
      } finally {
        setIsStreaming(false);
      }
    },
    []
  );

  const generateDescriptionNonStreaming = useCallback(
    async (title: string): Promise<string> => {
      if (!title || !title.trim()) {
        throw new Error('Meeting title is required');
      }

      setIsStreaming(true);
      try {
        const response = await api.post(`${env.AI_SERVICE_URL}/description`, {
          title,
        });
        return response.data.description || '';
      } catch (error) {
        console.error('Description generation error:', error);
        throw error;
      } finally {
        setIsStreaming(false);
      }
    },
    []
  );

  return {
    isStreaming,
    streamDescription,
    generateDescriptionNonStreaming,
  };
};

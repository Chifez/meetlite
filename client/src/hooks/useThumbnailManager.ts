import { useState, useCallback, useEffect } from 'react';
import { meetingAssetsService } from '@/services/meetingAssetsService';

interface ThumbnailState {
  error: boolean;
  freshUrl: string | null;
  isLoading: boolean;
}

export const useThumbnailManager = (recordingId: string) => {
  const [state, setState] = useState<ThumbnailState>({
    error: false,
    freshUrl: null,
    isLoading: true, // Start with loading true
  });

  const fetchThumbnailUrl = useCallback(async () => {
    if (!recordingId) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const urls = await meetingAssetsService.getStreamingUrl(recordingId);
      if (urls.thumbnailUrl) {
        setState((prev) => ({
          ...prev,
          freshUrl: urls.thumbnailUrl!,
          error: false,
          isLoading: false,
        }));
      } else {
        setState((prev) => ({ ...prev, error: true, isLoading: false }));
      }
    } catch (error) {
      console.error('Failed to get fresh thumbnail URL:', error);
      setState((prev) => ({ ...prev, error: true, isLoading: false }));
    }
  }, [recordingId]);

  // Fetch thumbnail URL on mount
  useEffect(() => {
    fetchThumbnailUrl();
  }, [fetchThumbnailUrl]);

  const handleError = useCallback(async () => {
    if (state.error || state.isLoading) return;
    await fetchThumbnailUrl();
  }, [fetchThumbnailUrl, state.error, state.isLoading]);

  return {
    thumbnailError: state.error,
    freshThumbnailUrl: state.freshUrl,
    isLoadingThumbnail: state.isLoading,
    handleThumbnailError: handleError,
  };
};

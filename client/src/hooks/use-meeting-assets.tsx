import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { meetingAssetsService } from '@/services/meeting-assets-service';
import { AnalyticsService } from '@/services/analytics-service';
import type {
  MeetingRecording,
  MeetingAssetsQuery,
} from '@/types/meetingAssets';

export const useMeetingAssets = (organizationId?: string) => {
  const [recordings, setRecordings] = useState<MeetingRecording[]>([]);
  const [stats, setStats] = useState({
    totalRecordings: 0,
    totalSize: 0,
    totalDuration: 0,
    completedTranscripts: 0,
    completedSummaries: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<
    Record<string, { progress: number; status: string }>
  >({});
  const [selectedRecording, setSelectedRecording] =
    useState<MeetingRecording | null>(null);

  const analyticsService = useMemo(() => new AnalyticsService(), []);

  const fetchRecordings = useCallback(
    async (query: MeetingAssetsQuery = {}) => {
      if (!organizationId) {
        setRecordings([]);
        setStats({
          totalRecordings: 0,
          totalSize: 0,
          totalDuration: 0,
          completedTranscripts: 0,
          completedSummaries: 0,
        });
        setPagination({
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        });
        return;
      }

      setLoading(true);
      try {
        // Fetch recordings first (critical)
        const response = await meetingAssetsService.getOrganizationRecordings(
          query
        );

        // Ensure response has the expected structure
        if (!response || typeof response !== 'object') {
          throw new Error('Invalid response format from recordings API');
        }

        const recordings = response.recordings || [];
        const pagination = response.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        };

        setRecordings(recordings);
        setPagination(pagination);

        try {
          const analyticsData = await analyticsService.getOrganizationAnalytics(
            organizationId
          );
          setStats({
            totalRecordings: analyticsData.totalRecordings,
            totalSize: analyticsData.totalSize,
            totalDuration: analyticsData.totalDuration,
            completedTranscripts: analyticsData.completedTranscripts,
            completedSummaries: analyticsData.completedSummaries,
          });
        } catch (analyticsError: any) {
          console.warn(
            'Failed to fetch analytics (non-critical):',
            analyticsError
          );
          // Set default stats if analytics fails
          setStats({
            totalRecordings: recordings.length,
            totalSize: 0,
            totalDuration: 0,
            completedTranscripts: 0,
            completedSummaries: 0,
          });
        }
      } catch (error: any) {
        console.error('Failed to fetch recordings:', error);
        toast.error(error.message || 'Failed to load recordings');
        setRecordings([]);
        setPagination({
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        });
      } finally {
        setLoading(false);
      }
    },
    [organizationId]
  );

  const loadRecording = useCallback(async (id: string) => {
    try {
      const recording = await meetingAssetsService.getRecordingById(id);
      setSelectedRecording(recording);
      return recording;
    } catch (error: any) {
      toast.error(error.message || 'Failed to load recording');
      return null;
    }
  }, []);

  const deleteRecording = useCallback(
    async (id: string) => {
      try {
        await meetingAssetsService.deleteRecording(id);

        setRecordings((prev) => prev.filter((r) => r.id !== id));
        if (selectedRecording?.id === id) setSelectedRecording(null);

        toast.success('Recording deleted successfully');
        return true;
      } catch (error: any) {
        toast.error(error.message || 'Failed to delete recording');
        return false;
      }
    },
    [selectedRecording]
  );

  const archiveRecording = useCallback(
    async (id: string) => {
      try {
        await meetingAssetsService.archiveRecording(id);

        setRecordings((prev) => prev.filter((r) => r.id !== id));
        if (selectedRecording?.id === id) setSelectedRecording(null);

        toast.success('Recording archived successfully');
        return true;
      } catch (error: any) {
        toast.error(error.message || 'Failed to archive recording');
        return false;
      }
    },
    [selectedRecording]
  );

  const unarchiveRecording = useCallback(
    async (id: string) => {
      try {
        await meetingAssetsService.unarchiveRecording(id);

        setRecordings((prev) => prev.filter((r) => r.id !== id));
        if (selectedRecording?.id === id) setSelectedRecording(null);

        toast.success('Recording unarchived successfully');
        return true;
      } catch (error: any) {
        toast.error(error.message || 'Failed to unarchive recording');
        return false;
      }
    },
    [selectedRecording]
  );

  const startProcessing = useCallback(
    async (id: string, type: 'transcript' | 'summary' | 'both') => {
      try {
        await meetingAssetsService.startProcessing(id, type);

        setProcessing((prev) => ({
          ...prev,
          [id]: { progress: 0, status: 'processing' },
        }));
        toast.success(`${type} processing started`);

        // Check processing status periodically
        const checkStatus = async () => {
          try {
            const status = await meetingAssetsService.getProcessingStatus(id);
            setProcessing((prev) => ({
              ...prev,
              [id]: { progress: 0, status: status.status },
            }));

            if (status.status === 'completed' || status.status === 'failed') {
              // Refresh recordings to get updated status
              fetchRecordings();
              return;
            }

            // Continue checking if still processing
            if (status.status === 'processing') {
              setTimeout(checkStatus, 5000);
            }
          } catch (error) {
            console.error('Failed to check processing status:', error);
          }
        };

        // Start status checking after a short delay
        setTimeout(checkStatus, 2000);
      } catch (error: any) {
        toast.error(error.message || 'Failed to start processing');
      }
    },
    [fetchRecordings]
  );

  const downloadTranscript = useCallback(async (_id: string) => {
    try {
      // TODO: Implement transcript download functionality
      toast.info('Transcript download coming soon');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download transcript');
    }
  }, []);

  const exportRecordings = useCallback(
    async (_format: 'csv' | 'json' | 'pdf') => {
      try {
        // TODO: Implement export functionality
        toast.info('Export functionality coming soon');
      } catch (error: any) {
        toast.error('Failed to export recordings');
      }
    },
    [organizationId]
  );

  // Add upload function for new recordings
  const uploadRecording = useCallback(
    async (
      file: File,
      metadata: {
        title: string;
        description?: string;
        meetingId?: string;
        tags?: string[];
        visibility?: 'organization' | 'participants' | 'private';
      },
      onProgress?: (progress: any) => void
    ) => {
      try {
        const recording = await meetingAssetsService.uploadRecording(
          file,
          metadata,
          onProgress
        );

        // Add to recordings list
        setRecordings((prev) => [recording, ...prev]);

        toast.success('Recording uploaded successfully');
        return recording;
      } catch (error: any) {
        toast.error(error.message || 'Failed to upload recording');
        return null;
      }
    },
    []
  );

  return {
    recordings,
    stats,
    pagination,
    loading,
    processing,
    selectedRecording,
    fetchRecordings,
    loadRecording,
    deleteRecording,
    archiveRecording,
    unarchiveRecording,
    startProcessing,
    downloadTranscript,
    exportRecordings,
    uploadRecording,
    setSelectedRecording,
  };
};

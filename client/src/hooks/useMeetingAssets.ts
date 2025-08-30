import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { meetingAssetsService } from '../services/meetingAssetsService';
import type {
  MeetingRecording,
  MeetingAssetsQuery,
  MeetingAssetsResponse,
} from '../services/meetingAssetsService';

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
        const response = await meetingAssetsService.getOrganizationRecordings(
          organizationId,
          query
        );

        setRecordings(response.recordings);
        setPagination(response.pagination);
        setStats(response.stats);
      } catch (error: any) {
        toast.error(error.message || 'Failed to load recordings');
        setRecordings([]);
      } finally {
        setLoading(false);
      }
    },
    [organizationId]
  );

  const loadRecording = useCallback(async (id: string) => {
    try {
      const recording = await meetingAssetsService.getRecording(id);
      setSelectedRecording(recording);
      return recording;
    } catch (error: any) {
      toast.error(error.message || 'Failed to load recording');
      return null;
    }
  }, []);

  const updateRecording = useCallback(
    async (id: string, updates: any) => {
      try {
        const updated = await meetingAssetsService.updateRecording(id, updates);

        setRecordings((prev) => prev.map((r) => (r.id === id ? updated : r)));
        if (selectedRecording?.id === id) setSelectedRecording(updated);

        toast.success('Recording updated successfully');
        return updated;
      } catch (error: any) {
        toast.error(error.message || 'Failed to update recording');
        return null;
      }
    },
    [selectedRecording]
  );

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
              [id]: { progress: status.progress, status: status.status },
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

  const downloadTranscript = useCallback(async (id: string) => {
    try {
      const blob = await meetingAssetsService.downloadTranscript(id);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transcript-${id}.txt`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success('Transcript downloaded');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download transcript');
    }
  }, []);

  const exportRecordings = useCallback(
    async (format: 'csv' | 'json' | 'pdf') => {
      try {
        const blob = await meetingAssetsService.exportRecordings(
          organizationId || '',
          format
        );

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `recordings.${format}`;
        link.click();
        window.URL.revokeObjectURL(url);

        toast.success(`Exported as ${format.toUpperCase()}`);
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
        visibility?: 'organization' | 'participants' | 'private';
        tags?: string[];
      }
    ) => {
      try {
        const recording = await meetingAssetsService.uploadRecording(
          file,
          metadata
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
    updateRecording,
    deleteRecording,
    startProcessing,
    downloadTranscript,
    exportRecordings,
    uploadRecording,
    setSelectedRecording,
  };
};

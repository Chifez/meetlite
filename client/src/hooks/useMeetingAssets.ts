import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { mockRecordings } from '../data/mockRecordings';
import type {
  MeetingRecording,
  MeetingAssetsQuery,
} from '../services/meetingAssetsService';

export const useMeetingAssets = (organizationId?: string) => {
  const [recordings, setRecordings] = useState<MeetingRecording[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<
    Record<string, { progress: number; status: string }>
  >({});
  const [selectedRecording, setSelectedRecording] =
    useState<MeetingRecording | null>(null);

  // Derived state - no need for separate state variables
  const stats = useMemo(
    () => ({
      totalRecordings: recordings.length,
      totalSize: recordings.reduce((sum, r) => sum + r.recording.fileSize, 0),
      totalDuration: recordings.reduce(
        (sum, r) => sum + r.recording.duration,
        0
      ),
      completedTranscripts: recordings.filter(
        (r) => r.transcript.status === 'completed'
      ).length,
      completedSummaries: recordings.filter(
        (r) => r.aiSummary.status === 'completed'
      ).length,
    }),
    [recordings]
  );

  const pagination = useMemo(
    () => ({
      page: 1,
      limit: 20,
      total: recordings.length,
      totalPages: Math.ceil(recordings.length / 20),
    }),
    [recordings]
  );

  const fetchRecordings = useCallback(
    async (query: MeetingAssetsQuery = {}) => {
      if (!organizationId) return;

      setLoading(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));

        let filtered = [...mockRecordings];

        if (query.search) {
          const search = query.search.toLowerCase();
          filtered = filtered.filter(
            (r) =>
              r.title.toLowerCase().includes(search) ||
              r.description?.toLowerCase().includes(search) ||
              r.tags.some((tag) => tag.toLowerCase().includes(search))
          );
        }

        if (query.status) {
          filtered = filtered.filter(
            (r) => r.processingStatus === query.status
          );
        }

        if (query.hasTranscript !== undefined) {
          const hasTranscript = query.hasTranscript;
          filtered = filtered.filter(
            (r) => (r.transcript.status === 'completed') === hasTranscript
          );
        }

        if (query.hasSummary !== undefined) {
          const hasSummary = query.hasSummary;
          filtered = filtered.filter(
            (r) => (r.aiSummary.status === 'completed') === hasSummary
          );
        }

        if (query.tags?.length) {
          filtered = filtered.filter((r) =>
            query.tags!.some((tag) => r.tags.includes(tag))
          );
        }

        // Sort
        const sortBy = query.sortBy || 'createdAt';
        const sortOrder = query.sortOrder || 'desc';
        filtered.sort((a, b) => {
          let aVal: any, bVal: any;
          switch (sortBy) {
            case 'title':
              aVal = a.title;
              bVal = b.title;
              break;
            case 'duration':
              aVal = a.recording.duration;
              bVal = b.recording.duration;
              break;
            case 'viewCount':
              aVal = a.analytics.viewCount;
              bVal = b.analytics.viewCount;
              break;
            default:
              aVal = new Date(a.createdAt);
              bVal = new Date(b.createdAt);
          }
          return sortOrder === 'asc'
            ? aVal > bVal
              ? 1
              : -1
            : aVal < bVal
            ? 1
            : -1;
        });

        setRecordings(filtered);
      } catch (error: any) {
        toast.error(error.message || 'Failed to load recordings');
      } finally {
        setLoading(false);
      }
    },
    [organizationId]
  );

  const loadRecording = useCallback(async (id: string) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const recording = mockRecordings.find((r) => r.id === id);
      if (!recording) throw new Error('Recording not found');
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
        await new Promise((resolve) => setTimeout(resolve, 500));
        const index = mockRecordings.findIndex((r) => r.id === id);
        if (index === -1) throw new Error('Recording not found');

        const updated = {
          ...mockRecordings[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        mockRecordings[index] = updated;

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
        await new Promise((resolve) => setTimeout(resolve, 500));
        const index = mockRecordings.findIndex((r) => r.id === id);
        if (index === -1) throw new Error('Recording not found');

        mockRecordings.splice(index, 1);
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
        await new Promise((resolve) => setTimeout(resolve, 300));

        setProcessing((prev) => ({
          ...prev,
          [id]: { progress: 0, status: 'processing' },
        }));
        toast.success(`${type} processing started`);

        // Simulate progress
        const interval = setInterval(() => {
          setProcessing((prev) => {
            const current = prev[id];
            if (!current || current.status !== 'processing') {
              clearInterval(interval);
              return prev;
            }

            const newProgress = Math.min(current.progress + 10, 100);
            if (newProgress >= 100) {
              clearInterval(interval);
              // Update recording status
              setTimeout(() => {
                const index = mockRecordings.findIndex((r) => r.id === id);
                if (index !== -1) {
                  if (type === 'transcript' || type === 'both') {
                    mockRecordings[index].transcript.status = 'completed';
                  }
                  if (type === 'summary' || type === 'both') {
                    mockRecordings[index].aiSummary.status = 'completed';
                  }
                  setRecordings([...mockRecordings]);
                }
              }, 1000);
              return { ...prev, [id]: { progress: 100, status: 'completed' } };
            }

            return {
              ...prev,
              [id]: { progress: newProgress, status: 'processing' },
            };
          });
        }, 2000);
      } catch (error: any) {
        toast.error(error.message || 'Failed to start processing');
      }
    },
    []
  );

  const downloadTranscript = useCallback(async (id: string) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const recording = mockRecordings.find((r) => r.id === id);
      if (!recording || recording.transcript.status !== 'completed') {
        throw new Error('Transcript not available');
      }

      const content = `Transcript: ${recording.title}\n\n${
        recording.transcript.text || 'Content...'
      }`;
      const blob = new Blob([content], { type: 'text/plain' });
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
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const data = recordings.map((r) => ({
          title: r.title,
          duration: r.recording.duration,
          createdAt: r.createdAt,
          participants: r.participants.length,
          hasTranscript: r.transcript.status === 'completed',
          hasSummary: r.aiSummary.status === 'completed',
        }));

        let content = '';
        if (format === 'csv') {
          const headers = [
            'Title',
            'Duration',
            'Created',
            'Participants',
            'Transcript',
            'Summary',
          ];
          content =
            headers.join(',') +
            '\n' +
            data.map((row) => Object.values(row).join(',')).join('\n');
        } else if (format === 'json') {
          content = JSON.stringify(data, null, 2);
        } else {
          content = `Recordings Export\n\n${data
            .map((row) => `${row.title} (${row.duration}s)`)
            .join('\n')}`;
        }

        const blob = new Blob([content], {
          type: format === 'json' ? 'application/json' : 'text/plain',
        });
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
    [recordings]
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
    setSelectedRecording,
  };
};

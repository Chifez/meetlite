import { useEffect, useState } from 'react';
import { useWorkspace } from '@/contexts/workspace-context';
import { useMeetingAssets } from '@/hooks/use-meeting-assets';
import { useQueryManager } from '@/hooks/use-query-manager';
import { RecordingCard } from '@/components/recordings/recording-card';
import { RecordingsSearch } from '@/components/recordings/recordings-search';
import { RecordingsFilterModal } from '@/components/recordings/recordings-filter-modal';
import { RecordingsExport } from '@/components/recordings/recordings-export';
import { VideoPlayerModal } from '@/components/recordings/video-player/video-player-modal';
import { UploadRecordingModal } from '@/components/recordings/upload-recording-modal';
import { Button } from '@/components/ui/button';
import { Download, FileText, Upload, Video } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import type { MeetingRecording } from '@/types/meetingAssets';
import { meetingAssetsService } from '@/services/meeting-assets-service';
import { toast } from 'sonner';
import { useCanUploadRecordings } from '@/hooks/use-permissions';

export default function Recordings() {
  const { activeOrganization } = useWorkspace();
  const canUploadRecordings = useCanUploadRecordings();

  const {
    recordings,
    stats,
    loading,
    fetchRecordings,
    selectedRecording,
    setSelectedRecording,
    exportRecordings,
    deleteRecording,
    archiveRecording,
    unarchiveRecording,
  } = useMeetingAssets(activeOrganization?.id);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const {
    showArchived,
    setShowArchived,
    handleSearchChange,
    handleFiltersChange,
    refreshQuery,
  } = useQueryManager({ onQueryChange: fetchRecordings });

  useEffect(() => {
    if (activeOrganization?.id) {
      refreshQuery();
    }
  }, [activeOrganization?.id, refreshQuery]);

  const handleDeleteRecording = async (recording: MeetingRecording) => {
    try {
      // Use _id if id is not available
      const recordingId = recording.id || recording._id;
      if (!recordingId) {
        throw new Error('Recording ID not found');
      }

      await deleteRecording(recordingId);
      // Refresh recordings list after deletion
      refreshQuery();
    } catch (error: any) {
      console.error('Failed to delete recording:', error);
      toast.error(error.message || 'Failed to delete recording');
    }
  };

  const handleArchiveRecording = async (recording: MeetingRecording) => {
    try {
      const recordingId = recording.id || recording._id;
      if (!recordingId) {
        throw new Error('Recording ID not found');
      }

      await archiveRecording(recordingId);
      // Refresh recordings list after archiving
      refreshQuery();
    } catch (error: any) {
      console.error('Failed to archive recording:', error);
      toast.error(error.message || 'Failed to archive recording');
    }
  };

  const handleUnarchiveRecording = async (recording: MeetingRecording) => {
    try {
      const recordingId = recording.id || recording._id;
      if (!recordingId) {
        throw new Error('Recording ID not found');
      }

      await unarchiveRecording(recordingId);
      // Refresh recordings list after unarchiving
      refreshQuery();
    } catch (error: any) {
      console.error('Failed to unarchive recording:', error);
      toast.error(error.message || 'Failed to unarchive recording');
    }
  };

  const handleUploadSuccess = () => {
    // Refresh recordings list after upload
    refreshQuery();
    setShowUploadModal(false);
  };

  const handleEditRecording = async (recording: MeetingRecording) => {
    // TODO: Implement edit recording modal
    console.log('Edit recording:', recording);
    toast.info('Edit functionality coming soon');
  };

  const handleShareRecording = async (recording: MeetingRecording) => {
    try {
      const recordingId = recording.id || recording._id;
      if (!recordingId) {
        throw new Error('Recording ID not found');
      }

      const shareData = await meetingAssetsService.generateShareLink(
        recordingId
      );

      // Copy to clipboard
      await navigator.clipboard.writeText(shareData.shareableUrl);
      toast.success('Share link copied to clipboard!');
    } catch (error: any) {
      console.error('Failed to generate share link:', error);
      toast.error(error.message || 'Failed to generate share link');
    }
  };

  const handleDownloadTranscript = async (recording: MeetingRecording) => {
    try {
      if (recording.transcript.status !== 'completed') {
        toast.error('Transcript not available');
        return;
      }

      // Create and download transcript file
      const transcriptText =
        recording.transcript.text || 'No transcript available';
      const blob = new Blob([transcriptText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${recording.title}_transcript.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Transcript downloaded successfully');
    } catch (error: any) {
      console.error('Failed to download transcript:', error);
      toast.error('Failed to download transcript');
    }
  };

  const handleStartProcessing = async (
    recording: MeetingRecording,
    type: 'transcript' | 'summary' | 'both'
  ) => {
    try {
      const recordingId = recording.id || recording._id;
      if (!recordingId) {
        throw new Error('Recording ID not found');
      }

      await meetingAssetsService.startProcessing(recordingId, type);
      toast.success(`${type} processing started`);

      // Refresh recordings to show updated status
      refreshQuery();
    } catch (error: any) {
      console.error('Failed to start processing:', error);
      toast.error(error.message || 'Failed to start processing');
    }
  };

  if (!activeOrganization) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <p className="text-[0.875rem] text-muted-foreground">
            Select a workspace to view recordings.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[1.25rem] font-bold text-foreground tracking-[-0.025em]">
              {showArchived ? 'Archived recordings' : 'Meeting recordings'}
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground mt-0.5">
              {showArchived
                ? 'Browse and restore archived recordings.'
                : 'Access recordings, AI transcripts, and summaries from your workspace meetings.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={showArchived ? 'default' : 'outline'}
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? 'Show active' : 'Show archived'}
            </Button>
            {canUploadRecordings && (
              <Button size="sm" onClick={() => setShowUploadModal(true)} className="gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Upload
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 max-w-sm">
            <RecordingsSearch onSearchChange={handleSearchChange} />
          </div>
          <div className="flex gap-2">
            <RecordingsFilterModal
              onFiltersChange={handleFiltersChange}
              totalCount={stats.totalRecordings}
            />
            <RecordingsExport onExport={exportRecordings} />
          </div>
        </div>

        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Recordings', value: stats.totalRecordings, icon: Video },
              { label: 'Transcripts', value: stats.completedTranscripts, icon: FileText },
              { label: 'Storage', value: `${(stats.totalSize / (1024 * 1024 * 1024)).toFixed(1)} GB`, icon: Download },
              { label: 'AI summaries', value: stats.completedSummaries, icon: FileText },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="border border-border bg-card rounded-xl p-4">
                <p className="text-label mb-2">{label}</p>
                <p className="text-[1.25rem] font-bold text-foreground tabular-nums tracking-[-0.02em]">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Recordings Grid - Loading / Empty / Populated */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="skeleton w-8 h-8 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3.5 w-3/4" />
                    <div className="skeleton h-3 w-1/2" />
                  </div>
                </div>
                <div className="skeleton h-24 w-full rounded-xl" />
                <div className="skeleton h-3 w-full" />
              </div>
            ))}
          </div>
        ) : recordings?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recordings.map((recording) => (
              <RecordingCard
                key={recording.id || recording._id}
                recording={recording}
                onPlay={() => setSelectedRecording(recording)}
                onEdit={handleEditRecording}
                onDelete={handleDeleteRecording}
                onArchive={handleArchiveRecording}
                onUnarchive={handleUnarchiveRecording}
                onDownloadTranscript={handleDownloadTranscript}
                onStartProcessing={handleStartProcessing}
                onShare={handleShareRecording}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4 border border-border rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
              <Video className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[0.9375rem] font-semibold text-foreground tracking-[-0.01em]">
                No recordings yet
              </p>
              <p className="text-[0.8125rem] text-muted-foreground mt-1 max-w-xs">
                {canUploadRecordings
                  ? 'Upload your first recording to get started.'
                  : 'No recordings available. Contact a workspace admin to upload recordings.'}
              </p>
            </div>
            {canUploadRecordings && (
              <Button size="sm" onClick={() => setShowUploadModal(true)} className="gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Upload recording
              </Button>
            )}
          </div>
        )}
      </div>

      {selectedRecording && (
        <VideoPlayerModal
          recording={selectedRecording}
          open={!!selectedRecording}
          onOpenChange={(open) => !open && setSelectedRecording(null)}
          onDownloadTranscript={handleDownloadTranscript}
          onStartProcessing={handleStartProcessing}
        />
      )}

      <UploadRecordingModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onUploadSuccess={handleUploadSuccess}
      />
    </DashboardLayout>
  );
}

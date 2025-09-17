import { useEffect, useState } from 'react';
import { useWorkspace } from '../contexts/workspace-context';
import { useMeetingAssets } from '../hooks/useMeetingAssets';
import { RecordingCard } from '../components/recordings/recording-card';
import { RecordingsSearch } from '../components/recordings/recordings-search';
import { RecordingsFilterModal } from '../components/recordings/recordings-filter-modal';
import { RecordingsExport } from '../components/recordings/recordings-export';
import { VideoPlayerModal } from '../components/recordings/video-player/video-player-modal';
import { UploadRecordingModal } from '../components/recordings/upload-recording-modal';
import { Button } from '../components/ui/button';
import { Download, FileText, Upload, Video } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import type {
  MeetingAssetsQuery,
  MeetingRecording,
} from '../services/meetingAssetsService';
import { meetingAssetsService } from '../services/meetingAssetsService';
import { toast } from 'sonner';

export default function Recordings() {
  const { activeOrganization } = useWorkspace();
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
  const [showArchived, setShowArchived] = useState(false);
  const [currentQuery, setCurrentQuery] = useState<MeetingAssetsQuery>({});

  useEffect(() => {
    if (activeOrganization?.id) {
      const query = { ...currentQuery, isArchived: showArchived };
      fetchRecordings(query);
    }
  }, [activeOrganization?.id, fetchRecordings, currentQuery, showArchived]);

  const handleSearchChange = (searchTerm: string) => {
    const newQuery = { ...currentQuery, search: searchTerm || undefined };
    setCurrentQuery(newQuery);
  };

  const handleFiltersChange = (filters: MeetingAssetsQuery) => {
    const newQuery = { ...currentQuery, ...filters };
    setCurrentQuery(newQuery);
  };

  const handleDeleteRecording = async (recording: MeetingRecording) => {
    try {
      // Use _id if id is not available
      const recordingId = recording.id || recording._id;
      if (!recordingId) {
        throw new Error('Recording ID not found');
      }

      await deleteRecording(recordingId);
      // Refresh recordings list after deletion
      const query = { ...currentQuery, isArchived: showArchived };
      fetchRecordings(query);
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
      const query = { ...currentQuery, isArchived: showArchived };
      fetchRecordings(query);
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
      const query = { ...currentQuery, isArchived: showArchived };
      fetchRecordings(query);
    } catch (error: any) {
      console.error('Failed to unarchive recording:', error);
      toast.error(error.message || 'Failed to unarchive recording');
    }
  };

  const handleUploadSuccess = () => {
    // Refresh recordings list after upload
    const query = { ...currentQuery, isArchived: showArchived };
    fetchRecordings(query);
    setShowUploadModal(false);
  };

  if (!activeOrganization) {
    return (
      <div className="min-h-screen bg-background pt-20 md:pt-24">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <p className="text-sm text-muted-foreground">
              Please select an organization to view recordings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto px-4 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-foreground">
                {showArchived ? 'Archived Recordings' : 'Meeting Recordings'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {showArchived
                  ? 'View and manage archived meeting recordings.'
                  : "Manage and access your organization's meeting recordings, transcripts, and AI summaries."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={showArchived ? 'outline' : 'default'}
                onClick={() => setShowArchived(!showArchived)}
              >
                {showArchived ? 'Show Active' : 'Show Archived'}
              </Button>
              <Button size="sm" onClick={() => setShowUploadModal(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Recording
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col justify-between sm:flex-row gap-3">
            <div className="flex-1 max-w-md">
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
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Video className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground font-medium">
                  Total Recordings
                </span>
              </div>
              <p className="text-xl font-semibold">{stats.totalRecordings}</p>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground font-medium">
                  Transcripts
                </span>
              </div>
              <p className="text-xl font-semibold">
                {stats.completedTranscripts}
              </p>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Download className="w-4 h-4 text-purple-500" />
                <span className="text-xs text-muted-foreground font-medium">
                  Total Size
                </span>
              </div>
              <p className="text-xl font-semibold">
                {(stats.totalSize / (1024 * 1024 * 1024)).toFixed(1)} GB
              </p>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-muted-foreground font-medium">
                  AI Summaries
                </span>
              </div>
              <p className="text-xl font-semibold">
                {stats.completedSummaries}
              </p>
            </div>
          </div>
        )}

        {/* Recordings Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-lg border p-4 space-y-3">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
              </div>
            ))}
          </div>
        ) : recordings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recordings.map((recording) => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                onPlay={() => setSelectedRecording(recording)}
                onEdit={() => {}}
                onDelete={handleDeleteRecording}
                onArchive={handleArchiveRecording}
                onUnarchive={handleUnarchiveRecording}
                onDownloadTranscript={() => {}}
                onStartProcessing={() => {}}
                onShare={() => {}}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No recordings yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload your first meeting recording to get started.
            </p>
            <Button size="sm" onClick={() => setShowUploadModal(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Recording
            </Button>
          </div>
        )}
      </div>
      {/* Video Player Modal */}
      {selectedRecording && (
        <VideoPlayerModal
          recording={selectedRecording}
          open={!!selectedRecording}
          onOpenChange={(open) => !open && setSelectedRecording(null)}
          onDownloadTranscript={() => {}}
          onStartProcessing={() => {}}
        />
      )}

      {/* Upload Modal */}
      <UploadRecordingModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onUploadSuccess={handleUploadSuccess}
      />
    </DashboardLayout>
  );
}

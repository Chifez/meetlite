import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/workspace-context';
import { useTeams } from '@/hooks/use-teams';
import { useMeetingAssets } from '@/hooks/use-meeting-assets';
import { useQueryManager } from '@/hooks/use-query-manager';
import { RecordingCard } from '@/components/recordings/recording-card';
import { RecordingsSearch } from '@/components/recordings/recordings-search';
import { RecordingsFilterModal } from '@/components/recordings/recordings-filter-modal';
import { RecordingsExport } from '@/components/recordings/recordings-export';
import { VideoPlayerModal } from '@/components/recordings/video-player/video-player-modal';
import { UploadRecordingModal } from '@/components/recordings/upload-recording-modal';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, Upload, Video } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import SEO from '@/components/seo';
import type { MeetingRecording } from '@/types/meetingAssets';
import { meetingAssetsService } from '@/services/meeting-assets-service';

export default function TeamRecordings() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { activeOrganization } = useWorkspace();
  const { fetchTeam } = useTeams();
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const {
    recordings,
    loading: recordingsLoading,
    fetchRecordings,
    selectedRecording,
    setSelectedRecording,
    exportRecordings,
    deleteRecording,
    archiveRecording,
    unarchiveRecording,
  } = useMeetingAssets(activeOrganization?.id);

  const { handleSearchChange, handleFiltersChange, refreshQuery } =
    useQueryManager({
      onQueryChange: (query) => {
        fetchRecordings({ ...query, teamId });
      },
    });

  // Fetch team data and verify access
  useEffect(() => {
    const loadTeamData = async () => {
      if (!teamId || !activeOrganization?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setAccessDenied(false);

      try {
        const teamData = await fetchTeam(activeOrganization.id, teamId);
        if (teamData) {
          setTeam(teamData);
        } else {
          setAccessDenied(true);
        }
      } catch (error: any) {
        console.error('Error loading team:', error);
        if (error.response?.status === 403 || error.response?.status === 404) {
          setAccessDenied(true);
        } else {
          toast.error('Failed to load team data');
        }
      } finally {
        setLoading(false);
      }
    };

    loadTeamData();
  }, [teamId, activeOrganization?.id, fetchTeam]);

  // Fetch team recordings
  useEffect(() => {
    if (activeOrganization?.id && teamId && !accessDenied) {
      refreshQuery();
    }
  }, [activeOrganization?.id, teamId, accessDenied, refreshQuery]);

  const handleDeleteRecording = async (recording: MeetingRecording) => {
    try {
      const recordingId = recording.id || recording._id;
      if (!recordingId) {
        throw new Error('Recording ID not found');
      }

      await deleteRecording(recordingId);
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
      refreshQuery();
    } catch (error: any) {
      console.error('Failed to unarchive recording:', error);
      toast.error(error.message || 'Failed to unarchive recording');
    }
  };

  const handleUploadSuccess = () => {
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
      if (recording.transcript?.status !== 'completed') {
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (accessDenied) {
    return (
      <DashboardLayout>
        <SEO title="Access Denied" />
        <div className="container mx-auto py-8 px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You don't have permission to access this team's recordings. You
              must be a team member or organization owner to view team
              recordings.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button variant="outline" onClick={() => navigate('/recordings')}>
              Go to All Recordings
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEO title={`${team?.name || 'Team'} Recordings`} />
      <div className="container mx-auto py-6 px-4">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">
                @{team?.name || 'Team'} Recordings
              </h1>
              <p className="text-muted-foreground mt-1">
                View and manage recordings for this team
              </p>
            </div>
            <Button onClick={() => setShowUploadModal(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Recording
            </Button>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <RecordingsSearch onSearchChange={handleSearchChange} />
            <RecordingsFilterModal onFiltersChange={handleFiltersChange} />
            <RecordingsExport onExport={exportRecordings} />
          </div>
        </div>

        {recordingsLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-12">
            <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No recordings yet</h3>
            <p className="text-muted-foreground mb-4">
              Upload your first recording to get started
            </p>
            <Button onClick={() => setShowUploadModal(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Recording
            </Button>
          </div>
        ) : (
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
        )}

        {selectedRecording && (
          <VideoPlayerModal
            recording={selectedRecording}
            open={!!selectedRecording}
            onOpenChange={(open) => !open && setSelectedRecording(null)}
            onDownloadTranscript={handleDownloadTranscript}
            onStartProcessing={handleStartProcessing}
          />
        )}

        {showUploadModal && (
          <UploadRecordingModal
            open={showUploadModal}
            onOpenChange={setShowUploadModal}
            onUploadSuccess={handleUploadSuccess}
            teamId={teamId}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

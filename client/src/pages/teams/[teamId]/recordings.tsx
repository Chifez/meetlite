import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/workspace-context';
import { useTeamsStore } from '@/stores/teams-store';
import { useMeetingAssets } from '@/hooks/use-meeting-assets';
import { useQueryManager } from '@/hooks/use-query-manager';
import { RecordingCard } from '@/components/recordings/recording-card';
import { RecordingsSearch } from '@/components/recordings/recordings-search';
import { RecordingsFilterModal } from '@/components/recordings/recordings-filter-modal';
import { RecordingsExport } from '@/components/recordings/recordings-export';
import { VideoPlayerModal } from '@/components/recordings/video-player/video-player-modal';
import { UploadRecordingModal } from '@/components/recordings/upload-recording-modal';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Upload, Video } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import SEO from '@/components/seo';
import type {
  MeetingRecording,
  MeetingAssetsQuery,
} from '@/types/meetingAssets';
import { meetingAssetsService } from '@/services/meeting-assets-service';
import { useCanUploadRecordings } from '@/hooks/use-permissions';
import { TeamService } from '@/services/team-service';

export default function TeamRecordings() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { activeOrganization, isPersonalMode } = useWorkspace();
  const { teams, fetchTeams } = useTeamsStore();
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const canUploadRecordings = useCanUploadRecordings(teamId);

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

  const handleQueryChange = useCallback(
    (query: MeetingAssetsQuery) => {
      if (teamId) {
        fetchRecordings({ ...query, teamId });
      }
    },
    [teamId, fetchRecordings]
  );

  const { handleSearchChange, handleFiltersChange, refreshQuery } =
    useQueryManager({
      onQueryChange: handleQueryChange,
    });

  useEffect(() => {
    if (isPersonalMode || !activeOrganization) {
      navigate('/dashboard', { replace: true });
    }
  }, [isPersonalMode, activeOrganization, navigate]);

  useEffect(() => {
    const loadTeamData = async () => {
      if (!teamId || !activeOrganization?.id || isPersonalMode) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setAccessDenied(false);

      try {
        await fetchTeams(activeOrganization.id);
        const teamData = await TeamService.getTeamById(activeOrganization.id, teamId);
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
  }, [teamId, activeOrganization?.id, isPersonalMode, fetchTeams]);

  const handleUploadSuccess = () => {
    refreshQuery();
    setShowUploadModal(false);
  };

  const handleEditRecording = async (recording: MeetingRecording) => {
    console.log('Edit recording:', recording);
    toast.info('Editing option coming soon.');
  };

  const handleDeleteRecording = async (recording: MeetingRecording) => {
    try {
      const recordingId = recording.id || recording._id;
      if (!recordingId) throw new Error('Recording ID not found');
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
      if (!recordingId) throw new Error('Recording ID not found');
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
      if (!recordingId) throw new Error('Recording ID not found');
      await unarchiveRecording(recordingId);
      refreshQuery();
    } catch (error: any) {
      console.error('Failed to unarchive recording:', error);
      toast.error(error.message || 'Failed to unarchive recording');
    }
  };

  const handleShareRecording = async (recording: MeetingRecording) => {
    try {
      const recordingId = recording.id || recording._id;
      if (!recordingId) throw new Error('Recording ID not found');
      const shareData = await meetingAssetsService.generateShareLink(recordingId);
      await navigator.clipboard.writeText(shareData.shareableUrl);
      toast.success('Share link copied to clipboard.');
    } catch (error: any) {
      console.error('Failed to generate share link:', error);
      toast.error('Failed to copy share link');
    }
  };

  const handleDownloadTranscript = async (recording: MeetingRecording) => {
    try {
      if (recording.transcript?.status !== 'completed') {
        toast.error('Transcript not available');
        return;
      }
      const transcriptText = recording.transcript.text || 'No transcript available';
      const blob = new Blob([transcriptText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${recording.title}_transcript.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Transcript downloaded.');
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
      if (!recordingId) throw new Error('Recording ID not found');
      await meetingAssetsService.startProcessing(recordingId, type);
      toast.success(`${type} processing started.`);
      refreshQuery();
    } catch (error: any) {
      console.error('Failed to start processing:', error);
      toast.error('Failed to initiate processing');
    }
  };

  // ── LOADING STATE ──────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <SEO title="Loading Team Recordings · MeetLite" />
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-[0.875rem] text-muted-foreground">Loading team recordings…</p>
        </div>
      </DashboardLayout>
    );
  }

  // ── ACCESS DENIED STATE ────────────────────────────────────────
  if (accessDenied || !team) {
    return (
      <DashboardLayout>
        <SEO title="Access Denied · MeetLite" />
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 border border-border rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h2 className="text-[0.9375rem] font-semibold text-foreground tracking-[-0.01em] mb-1">
              Access denied
            </h2>
            <p className="text-[0.8125rem] text-muted-foreground max-w-xs">
              You don't have permission to access recordings for this team, or it does not exist.
            </p>
          </div>
          <Button onClick={() => navigate('/recordings')} variant="outline" size="sm">
            Go to all recordings
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEO title={`${team.name} Recordings · MeetLite`} />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[1.25rem] font-bold text-foreground tracking-[-0.025em]">
            Team Recordings
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground mt-0.5">
            Access meeting recordings, AI summaries, and transcripts for @{team.name}.
          </p>
        </div>
        {canUploadRecordings && (
          <Button
            id="team-recordings-upload-btn"
            size="sm"
            onClick={() => setShowUploadModal(true)}
            className="gap-1.5 rounded-xl font-semibold"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload recording
          </Button>
        )}
      </div>

      {/* Filter strip */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-sm">
          <RecordingsSearch onSearchChange={handleSearchChange} />
        </div>
        <div className="flex gap-2">
          <RecordingsFilterModal onFiltersChange={handleFiltersChange} />
          <RecordingsExport onExport={exportRecordings} />
        </div>
      </div>

      {/* Populated / Empty / Loading Grid */}
      {recordingsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
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
      ) : recordings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 border border-border rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <Video className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[0.9375rem] font-semibold text-foreground tracking-[-0.01em]">
              No team recordings
            </p>
            <p className="text-[0.8125rem] text-muted-foreground mt-1 max-w-xs">
              {canUploadRecordings
                ? 'Upload your first team recording to get started.'
                : 'No recordings available. Contact a team admin to upload recordings.'}
            </p>
          </div>
          {canUploadRecordings && (
            <Button size="sm" onClick={() => setShowUploadModal(true)} className="gap-1.5 rounded-xl">
              <Upload className="w-3.5 h-3.5" />
              Upload recording
            </Button>
          )}
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
    </DashboardLayout>
  );
}

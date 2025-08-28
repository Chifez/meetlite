import { useEffect, useState } from 'react';
import { useWorkspace } from '../contexts/workspace-context';
import { useMeetingAssets } from '../hooks/useMeetingAssets';
import { RecordingCard } from '../components/recordings/recording-card';
import { RecordingsFilters } from '../components/recordings/recordings-filters';
import { VideoPlayerModal } from '../components/recordings/video-player-modal';
import { Button } from '../components/ui/button';
import { Download, Upload, FileText, Video } from 'lucide-react';

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
  } = useMeetingAssets(activeOrganization?.id);

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (activeOrganization?.id) {
      fetchRecordings();
    }
  }, [activeOrganization?.id, fetchRecordings]);

  if (!activeOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">
          Please select an organization to view recordings.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Meeting Recordings</h1>
          <p className="text-muted-foreground">
            Manage and access your organization's meeting recordings,
            transcripts, and AI summaries.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </Button>
          <Button>
            <Upload className="w-4 h-4 mr-2" />
            Upload Recording
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">
                Total Recordings
              </span>
            </div>
            <p className="text-2xl font-bold">{stats.totalRecordings}</p>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Transcripts</span>
            </div>
            <p className="text-2xl font-bold">{stats.completedTranscripts}</p>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-muted-foreground">Total Size</span>
            </div>
            <p className="text-2xl font-bold">
              {(stats.totalSize / (1024 * 1024 * 1024)).toFixed(1)} GB
            </p>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-500" />
              <span className="text-sm text-muted-foreground">
                AI Summaries
              </span>
            </div>
            <p className="text-2xl font-bold">{stats.completedSummaries}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <RecordingsFilters
          onFiltersChange={fetchRecordings}
          onExport={exportRecordings}
          totalCount={recordings.length}
        />
      )}

      {/* Recordings Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg border p-4 space-y-3">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
            </div>
          ))}
        </div>
      ) : recordings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recordings.map((recording) => (
            <RecordingCard
              key={recording.id}
              recording={recording}
              onPlay={() => setSelectedRecording(recording)}
              onEdit={() => {}}
              onDelete={() => {}}
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
          <p className="text-muted-foreground mb-4">
            Upload your first meeting recording to get started.
          </p>
          <Button>
            <Upload className="w-4 h-4 mr-2" />
            Upload Recording
          </Button>
        </div>
      )}

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
    </div>
  );
}

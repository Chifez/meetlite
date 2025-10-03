import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Play,
  FileText,
  MoreVertical,
  Edit3,
  Trash2,
  Share2,
  Brain,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import type { MeetingRecording } from '@/services/meeting-assets-service';
import {
  DeleteConfirmationModal,
  ArchiveConfirmationModal,
} from '@/components/recordings/confirmation-modal';

interface RecordingActionsDropdownProps {
  recording: MeetingRecording;
  onPlay: (recording: MeetingRecording) => void;
  onEdit: (recording: MeetingRecording) => void;
  onDelete: (recording: MeetingRecording) => void;
  onShare: (recording: MeetingRecording) => void;
  onDownloadTranscript: (recording: MeetingRecording) => void;
  onStartProcessing: (
    recording: MeetingRecording,
    type: 'transcript' | 'summary'
  ) => void;
  onArchive?: (recording: MeetingRecording) => void;
  onUnarchive?: (recording: MeetingRecording) => void;
}

export const RecordingActionsDropdown: React.FC<
  RecordingActionsDropdownProps
> = ({
  recording,
  onPlay,
  onEdit,
  onDelete,
  onShare,
  onDownloadTranscript,
  onStartProcessing,
  onArchive,
  onUnarchive,
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await onDelete(recording);
    } catch (error) {
      console.error('Failed to delete recording:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchive = async () => {
    setIsLoading(true);
    try {
      if (recording.isArchived && onUnarchive) {
        await onUnarchive(recording);
      } else if (!recording.isArchived && onArchive) {
        await onArchive(recording);
      }
    } catch (error) {
      console.error('Failed to archive/unarchive recording:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onPlay(recording)}>
            <Play className="w-4 h-4 mr-2" />
            Play
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(recording)}>
            <Edit3 className="w-4 h-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onShare(recording)}>
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onDownloadTranscript(recording)}>
            <FileText className="w-4 h-4 mr-2" />
            Download Transcript
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onStartProcessing(recording, 'transcript')}
          >
            <Brain className="w-4 h-4 mr-2" />
            Generate Transcript
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onStartProcessing(recording, 'summary')}
          >
            <Brain className="w-4 h-4 mr-2" />
            Generate Summary
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {recording.isArchived
            ? onUnarchive && (
                <DropdownMenuItem onClick={() => setShowArchiveModal(true)}>
                  <ArchiveRestore className="w-4 h-4 mr-2" />
                  Unarchive
                </DropdownMenuItem>
              )
            : onArchive && (
                <DropdownMenuItem onClick={() => setShowArchiveModal(true)}>
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteModal(true)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation Modals */}
      <DeleteConfirmationModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onConfirm={handleDelete}
        itemName={recording.title}
        isLoading={isLoading}
      />

      <ArchiveConfirmationModal
        open={showArchiveModal}
        onOpenChange={setShowArchiveModal}
        onConfirm={handleArchive}
        itemName={recording.title}
        isArchiving={!recording.isArchived}
        isLoading={isLoading}
      />
    </>
  );
};

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { useMeetingsStore } from '@/stores';

export default function DeleteMeetingDialog() {
  const {
    deleteDialog,
    deleting,
    closeDeleteDialog,
    deleteMeeting,
    deleteGoogleCalendarMeeting,
  } = useMeetingsStore();

  const handleDelete = async () => {
    if (!deleteDialog.meetingId) return;

    try {
      if (deleteDialog.isGoogleCalendar && deleteDialog.externalId) {
        // Delete from Google Calendar
        await deleteGoogleCalendarMeeting(deleteDialog.externalId);

        // Also remove from internal meetings list
        await deleteMeeting(deleteDialog.meetingId);
      } else {
        // Delete internal meeting only
        await deleteMeeting(deleteDialog.meetingId);
      }

      closeDeleteDialog();
    } catch (error) {
      console.error('Delete failed:', error);
      // Error handling is done in the store functions
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !deleting) {
      closeDeleteDialog();
    }
  };

  const getDialogContent = () => {
    if (deleteDialog.isGoogleCalendar) {
      return {
        title: 'Delete Google Calendar Meeting',
        description:
          'This will delete the meeting from both Google Calendar and your internal meetings list. All attendees will receive cancellation emails. This action cannot be undone.',
      };
    }
    return {
      title: 'Delete Meeting',
      description:
        'Are you sure you want to delete this meeting? This action cannot be undone.',
    };
  };

  const dialogContent = getDialogContent();

  return (
    <AlertDialog open={deleteDialog.open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialogContent.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {dialogContent.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

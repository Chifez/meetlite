import { useEffect, useState, useRef, useMemo } from 'react';
import { useMeetings } from '@/hooks/useMeetings';
import { Button } from '@/components/ui/button';

import { toast } from 'sonner';
import { PlusCircle } from 'lucide-react';
import MeetingForm from '@/components/meeting/MeetingForm';
import { useMeetingForm } from '@/hooks/useMeetingForm';
import SEO from '@/components/SEO';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Meeting } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import MeetingList from '@/components/meeting/MeetingList';
import MeetingCalendar from '@/components/meeting/MeetingCalendar';
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

const Meetings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { fetchMeetings, deleteMeeting, startMeeting } = useMeetings();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    meetingId?: string;
  }>({ open: false });

  // Use the custom hook for form state management
  const {
    formData,
    loading: formLoading,
    handleInputChange,
    handleDateChange,
    handleTimeChange,
    handlePrivacyChange,
    handleParticipantInput,
    handleParticipantKeyDown,
    removeParticipant,
    submitForm,
  } = useMeetingForm(() => {
    setShowForm(false);
    loadMeetings();
  });

  const loadMeetings = async () => {
    setLoading(true);
    try {
      const data = await fetchMeetings();
      setMeetings(data);
    } catch (e) {
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
    // eslint-disable-next-line
  }, []);

  const handleDelete = async () => {
    if (!deleteDialog.meetingId) return;
    try {
      await deleteMeeting(deleteDialog.meetingId);
      toast.success('Meeting deleted');
      loadMeetings();
    } catch (e) {
      toast.error('Failed to delete meeting');
    } finally {
      setDeleteDialog({ open: false });
    }
  };

  const handleStartMeeting = async (meetingId: string) => {
    try {
      const roomId = await startMeeting(meetingId);
      toast.success('Meeting started');
      navigate(`/lobby/${roomId}`);
    } catch (e: any) {
      if (e?.response?.data?.roomId) {
        // Meeting already started, redirect
        navigate(`/lobby/${e.response.data.roomId}`);
      } else {
        toast.error('Failed to start meeting');
      }
    }
  };

  const handleFormSubmit = async () => {
    const success = await submitForm();
    if (success) {
      setShowForm(false);
    }
  };

  return (
    <>
      <SEO title="My Meetings" />
      {/* Schedule Meeting Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent showCloseButton className="max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Schedule Meeting</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <MeetingForm
              formData={formData}
              loading={formLoading}
              hideFooter
              onInputChange={handleInputChange}
              onDateChange={handleDateChange}
              onTimeChange={handleTimeChange}
              onPrivacyChange={handlePrivacyChange}
              onParticipantInput={handleParticipantInput}
              onParticipantKeyDown={handleParticipantKeyDown}
              onRemoveParticipant={removeParticipant}
              onSubmit={handleFormSubmit}
              onCancel={() => setShowForm(false)}
            />
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button
              type="button"
              onClick={handleFormSubmit}
              className="min-w-[120px]"
              disabled={formLoading}
            >
              {formLoading ? 'Scheduling...' : 'Schedule'}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="min-h-screen bg-page py-12 px-4">
        <div className="max-w-4xl mx-auto space-y-10">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-700 to-blue-400 text-transparent bg-clip-text mb-2">
              My Meetings
            </h1>
            <p className="text-lg text-gray-600 max-w-xl mx-auto">
              View, schedule, and manage all your meetings in one place. Start
              meetings, invite participants, and keep track of your schedule
              effortlessly.
            </p>
            <Button
              size="lg"
              className="mt-6"
              onClick={() => setShowForm(true)}
            >
              <PlusCircle className="h-5 w-5 mr-2" /> Schedule Meeting
            </Button>
          </div>

          {/* View Toggle */}
          <div className="flex justify-end mb-4 gap-2">
            <Button
              variant={view === 'list' ? 'default' : 'outline'}
              onClick={() => setView('list')}
            >
              List View
            </Button>
            <Button
              variant={view === 'calendar' ? 'default' : 'outline'}
              onClick={() => setView('calendar')}
            >
              Calendar View
            </Button>
          </div>

          {/* Meetings List or Calendar */}
          {view === 'list' ? (
            <MeetingList
              meetings={meetings}
              loading={loading}
              userId={user?.id}
              onStartMeeting={handleStartMeeting}
              onDelete={(meetingId) =>
                setDeleteDialog({ open: true, meetingId })
              }
            />
          ) : (
            <MeetingCalendar
              meetings={meetings}
              onEventClick={(event) => {
                toast.info(event.title, {
                  description: `${format(event.start, 'PPpp')} - ${
                    event.resource.duration
                  } min\n${event.resource.description || ''}`,
                });
              }}
            />
          )}

          {/* Delete Confirmation Dialog */}
          <AlertDialog
            open={deleteDialog.open}
            onOpenChange={(open) => setDeleteDialog((d) => ({ ...d, open }))}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this meeting? This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </>
  );
};

export default Meetings;

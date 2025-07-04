import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { Loader2, Sparkles, Calendar } from 'lucide-react';
import MeetingForm from '@/components/meeting/MeetingForm';
import { MeetingFormData } from '@/lib/types';
import { useSmartScheduling } from '@/hooks/useSmartScheduling';

interface SmartSchedulingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: MeetingFormData;
  formLoading: boolean;
  onInputChange: (e: any) => void;
  onDateChange: (date: any) => void;
  onTimeChange: (time: any) => void;
  onPrivacyChange: (privacy: any) => void;
  onParticipantInput: (e: any) => void;
  onRemoveParticipant: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
}

export default function SmartSchedulingModal({
  open,
  onOpenChange,
  formData,
  formLoading,
  onInputChange,
  onDateChange,
  onTimeChange,
  onPrivacyChange,
  onParticipantInput,
  onRemoveParticipant,
  onSubmit,
  onCancel,
}: SmartSchedulingModalProps) {
  const [activeTab, setActiveTab] = useState('smart');
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [parseConfidence, setParseConfidence] = useState<number | null>(null);
  const [timezone, setTimezone] = useState('Africa/Lagos');

  const {
    isProcessing,
    parsingError,
    setParsingError,
    parseNaturalLanguage,
    populateFormData,
  } = useSmartScheduling();

  const handleSmartProcessing = async () => {
    if (!naturalLanguageInput.trim()) {
      setParsingError('Please describe your meeting');
      return;
    }

    setParsingError(null);
    setParseConfidence(null);

    try {
      // Parse natural language
      const parsedData = await parseNaturalLanguage(naturalLanguageInput);
      if (!parsedData) return;
      setParseConfidence(parsedData.confidence);

      // Pre-populate form data
      const formDataUpdate = populateFormData(parsedData);

      // Update form fields
      Object.entries(formDataUpdate).forEach(([key, value]) => {
        if (key === 'date' && value) {
          onDateChange(value);
        } else if (key === 'time' && typeof value === 'string') {
          // Set the time in 24-hour format (what the form expects)
          onTimeChange({ target: { name: 'time', value } } as any);
        } else if (key === 'privacy' && value) {
          onPrivacyChange(value);
        } else if (key === 'participants' && Array.isArray(value)) {
          value.forEach((email) => {
            onParticipantInput({
              target: { name: 'participantInput', value: email },
            } as any);
          });
        } else if (key !== 'participants') {
          onInputChange({ target: { name: key, value } } as any);
        }
      });
      if (parsedData.timezone) {
        setTimezone(parsedData.timezone);
      }
      setActiveTab('manual');
    } catch (error) {
      console.error('Smart processing error:', error);
      setParsingError(
        'Failed to process your request. Please try again or use manual input.'
      );
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setParsingError(null);
  };

  const resetModal = () => {
    setActiveTab('smart');
    setNaturalLanguageInput('');
    setParseConfidence(null);
    setParsingError(null);
    setTimezone('Africa/Lagos');
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetModal();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[90vh] flex flex-col max-w-2xl"
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Schedule Meeting
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="flex-1 flex flex-col overflow-y-auto scrollbar-hide"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="smart" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Smart Scheduling
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Manual Input
            </TabsTrigger>
          </TabsList>

          <TabsContent value="smart" className="flex-1 flex flex-col mt-4">
            <div className="flex-1 flex flex-col space-y-4">
              <div>
                <label className="block mb-2 font-medium text-sm">
                  Describe your meeting
                </label>
                <Textarea
                  placeholder="e.g., 'Team standup tomorrow 9 AM' or 'Client call Friday 2 PM, invite john@company.com'"
                  value={naturalLanguageInput}
                  onChange={(e) => setNaturalLanguageInput(e.target.value)}
                  className="min-h-[120px] resize-none"
                  disabled={isProcessing}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use natural language to describe when, what, and who for your
                  meeting
                </p>
              </div>

              {parsingError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{parsingError}</p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSmartProcessing}
                  disabled={isProcessing || !naturalLanguageInput.trim()}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Process
                    </>
                  )}
                </Button>
                <DialogClose asChild>
                  <Button variant="secondary">Cancel</Button>
                </DialogClose>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="manual"
            className="flex-1 mt-4 flex flex-col min-h-0 scrollbar-hide"
          >
            {parseConfidence !== null && (
              <div className="flex-shrink-0 mb-3 text-xs text-muted-foreground">
                ✓ Form pre-populated with{' '}
                {parseConfidence
                  ? `${(parseConfidence * 100).toFixed(0)}%`
                  : 'high'}{' '}
                confidence
              </div>
            )}
            <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
              <MeetingForm
                formData={formData}
                loading={formLoading}
                hideFooter
                onInputChange={onInputChange}
                onDateChange={onDateChange}
                onTimeChange={onTimeChange}
                onPrivacyChange={onPrivacyChange}
                onParticipantInput={onParticipantInput}
                onRemoveParticipant={onRemoveParticipant}
                onSubmit={onSubmit}
                onCancel={onCancel}
                timezone={timezone}
                setTimezone={setTimezone}
              />
            </div>

            <div className="flex-shrink-0 flex gap-2 pt-4 border-t mt-4">
              <Button
                type="button"
                onClick={async () => await onSubmit()}
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
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

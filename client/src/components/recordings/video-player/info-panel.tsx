import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RecordingInfo } from '@/components/recordings/video-player/recording-info';
import { TranscriptTab } from '@/components/recordings/video-player/transcript-tab';
import { SummaryTab } from '@/components/recordings/video-player/summary-tab';
import type { MeetingRecording } from '@/services/meeting-assets-service';

interface InfoPanelProps {
  recording: MeetingRecording;
  onDownloadTranscript: (recording: MeetingRecording) => void;
  onStartProcessing: (
    recording: MeetingRecording,
    type: 'transcript' | 'summary' | 'both'
  ) => void;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({
  recording,
  onDownloadTranscript,
  onStartProcessing,
}) => {
  return (
    <Tabs defaultValue="info" className="h-full flex flex-col min-h-0">
      <TabsList className="grid w-full grid-cols-3 rounded-none border-b flex-shrink-0">
        <TabsTrigger
          value="info"
          className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary text-xs"
        >
          Info
        </TabsTrigger>
        <TabsTrigger
          value="transcript"
          className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary text-xs"
        >
          Transcript
        </TabsTrigger>
        <TabsTrigger
          value="summary"
          className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary text-xs"
        >
          Summary
        </TabsTrigger>
      </TabsList>

      {/* Info Tab */}
      <TabsContent
        value="info"
        className="flex-1 overflow-hidden m-0 p-0 data-[state=active]:flex data-[state=active]:flex-col"
      >
        <div className="flex-1 overflow-y-auto p-4">
          <RecordingInfo
            recording={recording}
            onDownloadTranscript={onDownloadTranscript}
            onStartProcessing={onStartProcessing}
          />
        </div>
      </TabsContent>

      {/* Transcript Tab */}
      <TabsContent
        value="transcript"
        className="flex-1 overflow-hidden m-0 p-0 data-[state=active]:flex data-[state=active]:flex-col"
      >
        <div className="flex-1 overflow-y-auto p-4">
          <TranscriptTab
            recording={recording}
            onDownloadTranscript={onDownloadTranscript}
            onStartProcessing={onStartProcessing}
          />
        </div>
      </TabsContent>

      {/* Summary Tab */}
      <TabsContent
        value="summary"
        className="flex-1 overflow-hidden m-0 p-0 data-[state=active]:flex data-[state=active]:flex-col"
      >
        <div className="flex-1 overflow-y-auto p-4">
          <SummaryTab
            recording={recording}
            onStartProcessing={onStartProcessing}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
};

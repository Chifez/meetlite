import React from 'react';
import { Button } from '@/components/ui/button';
// import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Brain } from 'lucide-react';
import { format } from 'date-fns';
import type { MeetingRecording } from '@/services/meeting-assets-service';

interface SummaryTabProps {
  recording: MeetingRecording;
  onStartProcessing: (
    recording: MeetingRecording,
    type: 'transcript' | 'summary' | 'both'
  ) => void;
}

export const SummaryTab: React.FC<SummaryTabProps> = ({
  recording,
  onStartProcessing,
}) => {
  const hasSummary = recording.aiSummary.status === 'completed';

  if (!hasSummary) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Brain className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="font-medium text-lg mb-2 text-gray-900">
          No AI Summary Available
        </h3>
        <p className="text-sm text-gray-600 mb-4 max-w-sm">
          Generate an AI summary to get key insights, action items, and topics
          discussed in this meeting
        </p>
        <Button
          onClick={() => onStartProcessing(recording, 'summary')}
          size="sm"
        >
          <Brain className="h-4 w-4 mr-2" />
          Generate Summary
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div>
        <h3 className="font-semibold text-lg mb-3 text-foreground">Summary</h3>
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-gray-700 leading-relaxed">
            {recording.aiSummary.summary}
          </p>
        </div>
      </div>

      {/* Key Points */}
      {recording.aiSummary.keyPoints.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mb-3 text-gray-900">
            Key Points
          </h3>
          <div className="space-y-2">
            {recording.aiSummary.keyPoints.map((point, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-sm text-foreground leading-relaxed">
                  {point}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Items */}
      {recording.aiSummary.actionItems.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mb-3 text-gray-900">
            Action Items
          </h3>
          <div className="space-y-3">
            {recording.aiSummary.actionItems.map((item, index) => (
              <div
                key={index}
                className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400"
              >
                <div className="text-sm font-medium text-gray-900 mb-2">
                  {item.task}
                </div>
                <div className="space-y-1 text-xs text-gray-600">
                  {item.assignee && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Assigned to:</span>
                      <span>{item.assignee}</span>
                    </div>
                  )}
                  {item.dueDate && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Due:</span>
                      <span>{format(new Date(item.dueDate), 'PPP')}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topics Discussed */}
      {recording.aiSummary.topics.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mb-3 text-gray-900">
            Topics Discussed
          </h3>
          <div className="flex flex-wrap gap-2">
            {recording.aiSummary.topics.map((topic, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {topic}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

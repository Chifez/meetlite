import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Share2, Copy, Check } from 'lucide-react';
import { useAIFeatures } from '@/hooks/useAIFeatures';
import { toast } from 'sonner';

interface MeetingSummaryProps {
  meetingId: string;
  onClose?: () => void;
}

interface SummaryData {
  id: string;
  meetingId: string;
  summary: string;
  actionItems: string[];
  keyPoints: string[];
  participants: string[];
  duration: number;
  createdAt: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export const MeetingSummary: React.FC<MeetingSummaryProps> = ({
  meetingId,
}) => {
  const { generateMeetingSummary, isProcessing } = useAIFeatures();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateSummary = async () => {
    try {
      const summaryData = await generateMeetingSummary(meetingId);
      setSummary({
        ...summaryData,
        sentiment: 'neutral', // Default sentiment
      });
      toast.success('Meeting summary generated successfully!');
    } catch (error) {
      toast.error('Failed to generate meeting summary');
    }
  };

  const copyToClipboard = async () => {
    if (!summary) return;

    const text = `
Meeting Summary

${summary.summary}

Key Points:
${summary.keyPoints.map((point) => `• ${point}`).join('\n')}

Action Items:
${summary.actionItems.map((item) => `• ${item}`).join('\n')}

Duration: ${summary.duration} minutes
Participants: ${summary.participants.join(', ')}
    `.trim();

    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Summary copied to clipboard');

    setTimeout(() => setCopied(false), 2000);
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'negative':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>🤖 AI Meeting Summary</span>
            {summary && (
              <Badge
                className={getSentimentColor(summary.sentiment || 'neutral')}
              >
                {summary.sentiment || 'neutral'}
              </Badge>
            )}
          </CardTitle>
          {!summary && (
            <Button
              onClick={handleGenerateSummary}
              disabled={isProcessing}
              className="flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Summary'
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      {summary && (
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Summary</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {summary.summary}
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Key Points</h3>
            <ul className="space-y-1">
              {summary.keyPoints.map((point, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Action Items</h3>
            <ul className="space-y-1">
              {summary.actionItems.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={copyToClipboard}
              className="flex items-center gap-2"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

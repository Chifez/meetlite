import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Clock, Users, Calendar, Lightbulb } from 'lucide-react';
import { useAIFeatures } from '@/hooks/useAIFeatures';
import { toast } from 'sonner';

interface SmartSchedulingProps {
  onSuggestionSelect?: (suggestion: any) => void;
}

interface Suggestion {
  type: 'time' | 'participant' | 'duration' | 'topic';
  suggestion: string;
  confidence: number;
  reasoning: string;
}

export const SmartScheduling: React.FC<SmartSchedulingProps> = ({
  onSuggestionSelect,
}) => {
  const { getSmartSuggestions } = useAIFeatures();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [duration, setDuration] = useState(30);
  const [topic, setTopic] = useState('');

  const handleGetSuggestions = async () => {
    if (participants.length === 0) {
      toast.error('Please add at least one participant');
      return;
    }

    setIsLoading(true);
    try {
      const smartSuggestions = await getSmartSuggestions(
        participants,
        duration,
        topic
      );
      setSuggestions(smartSuggestions);
    } catch (error) {
      toast.error('Failed to get smart suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleParticipantInput = (value: string) => {
    if (value.includes(',')) {
      const emails = value
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
      setParticipants(emails);
    } else if (value.includes(' ')) {
      const emails = value
        .split(' ')
        .map((email) => email.trim())
        .filter(Boolean);
      setParticipants(emails);
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'time':
        return <Clock className="h-4 w-4" />;
      case 'participant':
        return <Users className="h-4 w-4" />;
      case 'duration':
        return <Calendar className="h-4 w-4" />;
      case 'topic':
        return <Lightbulb className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8)
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    if (confidence >= 0.6)
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>🤖 Smart Scheduling</span>
          <Badge variant="secondary">AI Powered</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="participants">Participants</Label>
            <Input
              id="participants"
              placeholder="Enter email addresses (comma or space separated)"
              onChange={(e) => handleParticipantInput(e.target.value)}
            />
            {participants.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {participants.map((email, index) => (
                  <Badge key={index} variant="secondary">
                    {email}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min="15"
                max="480"
                step="15"
              />
            </div>
            <div>
              <Label htmlFor="topic">Meeting Topic (optional)</Label>
              <Input
                id="topic"
                placeholder="e.g., Project planning, Team sync"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={handleGetSuggestions}
            disabled={isLoading || participants.length === 0}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Getting Suggestions...
              </>
            ) : (
              'Get Smart Suggestions'
            )}
          </Button>
        </div>

        {suggestions.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">AI Suggestions</h3>
            <div className="space-y-3">
              {suggestions.map((suggestion, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        {getSuggestionIcon(suggestion.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium capitalize">
                            {suggestion.type} Suggestion
                          </span>
                          <Badge
                            className={getConfidenceColor(
                              suggestion.confidence
                            )}
                          >
                            {Math.round(suggestion.confidence * 100)}%
                            confidence
                          </Badge>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 mb-2">
                          {suggestion.suggestion}
                        </p>
                        <p className="text-sm text-gray-500">
                          {suggestion.reasoning}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSuggestionSelect?.(suggestion)}
                    >
                      Apply
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

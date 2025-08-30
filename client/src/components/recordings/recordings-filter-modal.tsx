import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, X } from 'lucide-react';
import type { MeetingAssetsQuery } from '../../services/meetingAssetsService';

interface RecordingsFilterModalProps {
  onFiltersChange: (filters: MeetingAssetsQuery) => void;
  totalCount?: number;
}

export const RecordingsFilterModal: React.FC<RecordingsFilterModalProps> = ({
  onFiltersChange,
  totalCount = 0,
}) => {
  const [open, setOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [status, setStatus] = useState<string>('all');
  const [hasTranscript, setHasTranscript] = useState<string>('any');
  const [hasSummary, setHasSummary] = useState<string>('any');

  const applyFilters = () => {
    const filters: MeetingAssetsQuery = {
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
      status: status !== 'all' ? (status as any) : undefined,
      hasTranscript:
        hasTranscript !== 'any' ? hasTranscript === 'true' : undefined,
      hasSummary: hasSummary !== 'any' ? hasSummary === 'true' : undefined,
    };

    // Remove undefined values
    Object.keys(filters).forEach((key) => {
      if (filters[key as keyof MeetingAssetsQuery] === undefined) {
        delete filters[key as keyof MeetingAssetsQuery];
      }
    });

    onFiltersChange(filters);
    setOpen(false);
  };

  const clearFilters = () => {
    setSortBy('createdAt');
    setSortOrder('desc');
    setStatus('all');
    setHasTranscript('any');
    setHasSummary('any');
    onFiltersChange({});
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filter Recordings
            </div>
            <div className="text-sm text-muted-foreground font-normal">
              {totalCount} recordings
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Sort By */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Sort By</label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Date Created</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="duration">Duration</SelectItem>
                <SelectItem value="viewCount">Views</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort Order */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Order</label>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Newest First</SelectItem>
                <SelectItem value="asc">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select
              value={status}
              onValueChange={(value: string) => setStatus(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="uploading">Uploading</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Has Transcript */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Transcript</label>
              <Select value={hasTranscript} onValueChange={setHasTranscript}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="true">Has Transcript</SelectItem>
                  <SelectItem value="false">No Transcript</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Has Summary */}
            <div className="space-y-2">
              <label className="text-sm font-medium">AI Summary</label>
              <Select value={hasSummary} onValueChange={setHasSummary}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="true">Has Summary</SelectItem>
                  <SelectItem value="false">No Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={clearFilters}>
            <X className="w-4 h-4 mr-2" />
            Clear All
          </Button>
          <Button onClick={applyFilters}>Apply Filters</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

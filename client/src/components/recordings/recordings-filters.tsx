import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, X, Download } from 'lucide-react';
import type { MeetingAssetsQuery } from '@/services/meeting-assets-service';

interface RecordingsFiltersProps {
  onFiltersChange: (filters: MeetingAssetsQuery) => void;
  onExport: (format: 'csv' | 'json' | 'pdf') => void;
  totalCount?: number;
  className?: string;
}

export const RecordingsFilters: React.FC<RecordingsFiltersProps> = ({
  onFiltersChange,
  onExport,
  totalCount = 0,
  className,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [status, setStatus] = useState<string>('all');
  const [hasTranscript, setHasTranscript] = useState<string>('any');
  const [hasSummary, setHasSummary] = useState<string>('any');

  const applyFilters = () => {
    const filters: MeetingAssetsQuery = {
      search: searchTerm || undefined,
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
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setStatus('all');
    setHasTranscript('any');
    setHasSummary('any');
    onFiltersChange({});
  };

  return (
    <div
      className={`bg-card border rounded-lg p-4 space-y-4 ${className || ''}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filters
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {totalCount} recordings
          </span>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search recordings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Sort By */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Sort By
          </label>
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
          <label className="text-xs font-medium text-muted-foreground">
            Order
          </label>
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
          <label className="text-xs font-medium text-muted-foreground">
            Status
          </label>
          <Select
            value={status}
            onValueChange={(value: string) => setStatus(value as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Has Transcript */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Transcript
          </label>
          <Select value={hasTranscript} onValueChange={setHasTranscript}>
            <SelectTrigger>
              <SelectValue placeholder="Any" />
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
          <label className="text-xs font-medium text-muted-foreground">
            AI Summary
          </label>
          <Select value={hasSummary} onValueChange={setHasSummary}>
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="true">Has Summary</SelectItem>
              <SelectItem value="false">No Summary</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <Button onClick={applyFilters} className="flex-1 mr-2">
          Apply Filters
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onExport('csv')}>
            <Download className="w-4 h-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport('json')}>
            <Download className="w-4 h-4 mr-1" />
            JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport('pdf')}>
            <Download className="w-4 h-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>
    </div>
  );
};

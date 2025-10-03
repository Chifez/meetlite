import { useState, useMemo, useCallback } from 'react';
import { MeetingAssetsQuery } from '@/types/meetingAssets';

interface UseQueryManagerProps {
  onQueryChange: (query: MeetingAssetsQuery) => void;
}

export const useQueryManager = ({ onQueryChange }: UseQueryManagerProps) => {
  const [showArchived, setShowArchived] = useState(false);
  const [baseQuery, setBaseQuery] = useState<MeetingAssetsQuery>({});

  const currentQuery = useMemo(
    () => ({
      ...baseQuery,
      isArchived: showArchived,
    }),
    [baseQuery, showArchived]
  );

  const handleSearchChange = useCallback((searchTerm: string) => {
    setBaseQuery((prev) => ({
      ...prev,
      search: searchTerm || undefined,
    }));
  }, []);

  const handleFiltersChange = useCallback((filters: MeetingAssetsQuery) => {
    setBaseQuery((prev) => ({ ...prev, ...filters }));
  }, []);

  const refreshQuery = useCallback(() => {
    onQueryChange(currentQuery);
  }, [currentQuery, onQueryChange]);

  return {
    showArchived,
    setShowArchived,
    currentQuery,
    handleSearchChange,
    handleFiltersChange,
    refreshQuery,
  };
};

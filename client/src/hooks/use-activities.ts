import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/axios';
import { extractData } from '@/lib/api-response';

export interface Activity {
  id: string;
  action: string;
  userId?: string;
  organizationId: string;
  metadata: any;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export function useActivities(organizationId?: string) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/activities/${organizationId}`);
      const result = extractData<{ activities: Activity[] }>(res);
      setActivities(result.activities || []);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return {
    activities,
    loading,
    fetchActivities,
  };
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/axios';
import { useCurrentPlan } from './use-current-plan';

interface PlanStatusData {
  type: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'expired' | 'cancelled' | 'past_due';
  startDate: string;
  endDate: string | null;
  isExpired: boolean;
  isCancelled: boolean;
  isActive: boolean;
  daysUntilExpiry?: number;
  isExpiringSoon?: boolean;
}

interface UsePlanStatusReturn {
  planStatus: PlanStatusData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isExpiringSoon: boolean;
  daysUntilExpiry: number | null;
}

/**
 * Hook to monitor plan status and expiry warnings
 */
export const usePlanStatus = (): UsePlanStatusReturn => {
  const { planEndDate } = useCurrentPlan();
  const [planStatus, setPlanStatus] = useState<PlanStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlanStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/plan-management/status');
      setPlanStatus(response.data.data);
    } catch (err: any) {
      console.error('Failed to fetch plan status:', err);
      setError(err.response?.data?.message || 'Failed to load plan status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlanStatus();
  }, [fetchPlanStatus]);

  // Calculate expiry info from current plan
  const daysUntilExpiry = useMemo(() => {
    if (!planEndDate) return null;
    const now = new Date();
    const endDate = new Date(planEndDate);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }, [planEndDate]);

  const isExpiringSoon = useMemo(() => {
    return (
      daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0
    );
  }, [daysUntilExpiry]);

  return {
    planStatus,
    loading,
    error,
    refetch: fetchPlanStatus,
    isExpiringSoon,
    daysUntilExpiry,
  };
};

export default usePlanStatus;

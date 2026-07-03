import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/contexts/workspace-context';

/**
 * Unified hook to get the current plan (organization plan if in org mode, user plan otherwise)
 * This ensures all components read from the same source of truth
 */
export const useCurrentPlan = () => {
  const { user } = useAuth();
  const { activeOrganization, isPersonalMode } = useWorkspace();

  const currentPlan = useMemo(() => {
    // In organization mode: use organization plan (should match owner's plan)
    // In personal mode: use user plan
    return ((!isPersonalMode && activeOrganization?.plan?.type) ||
      user?.plan?.type ||
      'free') as 'free' | 'pro' | 'enterprise';
  }, [activeOrganization?.plan?.type, user?.plan?.type, isPersonalMode]);

  const planStatus = useMemo(() => {
    return ((!isPersonalMode && activeOrganization?.plan?.status) ||
      user?.plan?.status ||
      'active') as 'active' | 'expired' | 'cancelled' | 'past_due';
  }, [activeOrganization?.plan?.status, user?.plan?.status, isPersonalMode]);

  const planEndDate = useMemo(() => {
    return (
      (!isPersonalMode && activeOrganization?.plan?.endDate) ||
      user?.plan?.endDate ||
      null
    );
  }, [activeOrganization?.plan?.endDate, user?.plan?.endDate, isPersonalMode]);

  const isOrganizationPlan = useMemo(() => {
    return !isPersonalMode && !!activeOrganization?.plan?.type;
  }, [isPersonalMode, activeOrganization]);

  return {
    currentPlan,
    planStatus,
    planEndDate,
    isOrganizationPlan,
    isPersonalMode,
  };
};

export default useCurrentPlan;

import { Badge } from '@/components/ui/badge';
import { Zap, Crown } from 'lucide-react';
import { Organization } from '@/types/organization';

interface PlanBadgeProps {
  activeOrganization?: Organization | null;
  userPlan?: {
    type: 'free' | 'pro' | 'enterprise';
  };
  className?: string;
  showIcon?: boolean;
}

export const PlanBadge: React.FC<PlanBadgeProps> = ({
  activeOrganization,
  userPlan,
  className = '',
  showIcon = true,
}) => {
  // Determine the current plan (organization plan takes priority)
  const currentPlan =
    activeOrganization?.plan?.type || userPlan?.type || 'free';

  const getPlanBadge = () => {
    switch (currentPlan) {
      case 'free':
        return (
          <Badge variant="outline" className={`text-xs ${className}`}>
            Free
          </Badge>
        );

      case 'pro':
        return (
          <Badge
            variant="default"
            className={`text-xs bg-blue-500 ${className}`}
          >
            {showIcon && <Zap className="w-3 h-3 mr-1" />}
            Pro
          </Badge>
        );

      case 'enterprise':
        return (
          <Badge
            variant="default"
            className={`text-xs bg-purple-500 ${className}`}
          >
            {showIcon && <Crown className="w-3 h-3 mr-1" />}
            Enterprise
          </Badge>
        );

      default:
        return (
          <Badge variant="outline" className={`text-xs ${className}`}>
            Free
          </Badge>
        );
    }
  };

  return getPlanBadge();
};

// Utility function to get plan type
export const getCurrentPlan = (
  activeOrganization?: Organization | null,
  userPlan?: { type: 'free' | 'pro' | 'enterprise' }
): 'free' | 'pro' | 'enterprise' => {
  return (activeOrganization?.plan?.type || userPlan?.type || 'free') as
    | 'free'
    | 'pro'
    | 'enterprise';
};

// Utility function to check if user needs upgrade
export const needsUpgrade = (
  activeOrganization?: Organization | null,
  userPlan?: { type: 'free' | 'pro' | 'enterprise' }
): boolean => {
  const currentPlan = getCurrentPlan(activeOrganization, userPlan);
  return currentPlan === 'free';
};

export default PlanBadge;

import { Badge } from '@/components/ui/badge';
import { Zap, Crown } from 'lucide-react';
import { useCurrentPlan } from '@/hooks/use-current-plan';

interface PlanBadgeProps {
  className?: string;
  showIcon?: boolean;
}

export const PlanBadge: React.FC<PlanBadgeProps> = ({
  className = '',
  showIcon = true,
}) => {
  // Use unified hook to get current plan
  const { currentPlan } = useCurrentPlan();

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

// Utility function to check if user needs upgrade
export const needsUpgrade = (
  planType: 'free' | 'pro' | 'enterprise'
): boolean => {
  return planType === 'free';
};

export default PlanBadge;

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PlanUsageCard from '@/components/plan/plan-usage-card';
import VerticalPlanComparison from '@/components/plan/vertical-plan-comparison';
import { useCurrentPlan } from '@/hooks/use-current-plan';
import { useState } from 'react';

interface PlanSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan?: string; // Deprecated: kept for backward compatibility, but uses hook internally
}

export default function PlanSettingsDialog({
  open,
  onOpenChange,
  currentPlan: propCurrentPlan, // Deprecated prop
}: PlanSettingsDialogProps) {
  const { currentPlan } = useCurrentPlan();
  const [activeTab, setActiveTab] = useState('overview');

  // Use hook value, fallback to prop for backward compatibility
  const effectivePlan = currentPlan || propCurrentPlan || 'free';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col w-[95vw] sm:w-full px-4">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Plan & Usage</DialogTitle>
          <DialogDescription>
            View your current plan details and usage
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full flex-1 flex flex-col min-h-0"
        >
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0 h-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              Usage Overview
            </TabsTrigger>
            <TabsTrigger value="plans" className="text-xs sm:text-sm">
              Available Plans
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="overview"
            className="flex-1 overflow-y-auto scrollbar-hide mt-4"
          >
            <PlanUsageCard compact={true} showUpgradeButton={true} />
          </TabsContent>

          <TabsContent
            value="plans"
            className="flex-1 overflow-y-auto scrollbar-hide mt-4"
          >
            <VerticalPlanComparison
              currentPlan={effectivePlan}
              showUpgradeButtons={true}
              className="pr-2"
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

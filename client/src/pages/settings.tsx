import { useState } from 'react';
import { User, Building, Crown, Bell } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import ProfileSettings from '@/components/settings/profile-settings';
import OrganizationSettings from '@/components/settings/organization-settings';
import { NotificationSettings } from '@/components/settings/notification-settings';
import PlanUsageCard from '@/components/plan/plan-usage-card';
import PlanComparison from '@/components/plan/plan-comparison';
import SubscriptionManagement from '@/components/settings/subscription-management';
import { useCurrentPlan } from '@/hooks/use-current-plan';
import { useWorkspace } from '@/contexts/workspace-context';
import SEO from '@/components/seo';

export default function Settings() {
  const { currentPlan } = useCurrentPlan();
  const { activeOrganization } = useWorkspace();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <DashboardLayout>
      <SEO title="Settings · MeetLite" />

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[1.25rem] font-bold text-foreground tracking-[-0.025em]">
          Settings
        </h1>
        <p className="text-[0.8125rem] text-muted-foreground mt-0.5">
          Manage your profile, workspace, plan, and notification preferences.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="w-3.5 h-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="organization"
            className="gap-1.5"
            disabled={!activeOrganization}
          >
            <Building className="w-3.5 h-3.5" />
            Workspace
          </TabsTrigger>
          <TabsTrigger value="plan" className="gap-1.5">
            <Crown className="w-3.5 h-3.5" />
            Plan & billing
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="organization">
          <OrganizationSettings />
        </TabsContent>

        <TabsContent value="plan" className="space-y-6">
          <SubscriptionManagement />
          <PlanUsageCard showUpgradeButton={false} />
          <div id="available-plans" className="space-y-4">
            <div>
              <h2 className="text-[1rem] font-bold text-foreground tracking-[-0.02em]">
                Available plans
              </h2>
              <p className="text-[0.8125rem] text-muted-foreground mt-0.5">
                Upgrade or change your subscription at any time.
              </p>
            </div>
            <PlanComparison currentPlan={currentPlan} showUpgradeButtons={true} />
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

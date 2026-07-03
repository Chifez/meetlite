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

export default function Settings() {
  const { currentPlan } = useCurrentPlan();
  const { activeOrganization } = useWorkspace();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2 mb-8">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="inline-flex h-auto items-center justify-start rounded-md bg-muted p-1 text-muted-foreground overflow-x-auto">
          <TabsTrigger
            value="profile"
            className="inline-flex w-fit items-center justify-center whitespace-nowrap rounded-sm px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Profile Settings</span>
            <span className="sm:hidden">Profile</span>
          </TabsTrigger>
          <TabsTrigger
            value="organization"
            className="inline-flex w-fit items-center justify-center whitespace-nowrap rounded-sm px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:disabled:cursor-not-allowed disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            disabled={!activeOrganization}
          >
            <Building className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Organization Settings</span>
            <span className="sm:hidden">Organization</span>
          </TabsTrigger>
          <TabsTrigger
            value="plan"
            className="inline-flex w-fit items-center justify-center whitespace-nowrap rounded-sm px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Crown className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Plan & Usage</span>
            <span className="sm:hidden">Plan</span>
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="inline-flex w-fit items-center justify-center whitespace-nowrap rounded-sm px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Bell className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Notifications</span>
            <span className="sm:hidden">Alerts</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="organization" className="mt-6">
          <OrganizationSettings />
        </TabsContent>

        <TabsContent value="plan" className="mt-6 space-y-6">
          {/* Subscription Management */}
          <SubscriptionManagement />

          {/* Plan Usage */}
          <PlanUsageCard showUpgradeButton={false} />

          {/* Available Plans */}
          <div id="available-plans" className="space-y-6">
            <h2 className="text-2xl font-bold">Available Plans</h2>
            <PlanComparison
              currentPlan={currentPlan}
              showUpgradeButtons={true}
            />
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <NotificationSettings />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

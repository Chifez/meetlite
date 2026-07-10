import { useEffect } from 'react';
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
import { useParams, useNavigate } from 'react-router-dom';

export default function Settings() {
  const { currentPlan } = useCurrentPlan();
  const { activeOrganization } = useWorkspace();
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const activeTab = tab || 'profile';

  const handleTabChange = (newTab: string) => {
    navigate(`/settings/${newTab}`);
  };

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

      <div className="flex flex-col md:flex-row gap-8">
        <Tabs value={activeTab} onValueChange={handleTabChange} orientation="vertical" className="flex flex-col md:flex-row w-full gap-8">


          <div className="flex-1 min-w-0">
            <TabsContent value="profile" className="mt-0">
              <ProfileSettings />
            </TabsContent>

            <TabsContent value="organization" className="mt-0">
              <OrganizationSettings />
            </TabsContent>

            <TabsContent value="plan" className="space-y-6 mt-0">
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

            <TabsContent value="notifications" className="mt-0">
              <NotificationSettings />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

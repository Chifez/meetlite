import { useState, useEffect } from 'react';
import { useWorkspace } from '@/contexts/workspace-context';
import { Settings as SettingsIcon, User, Building } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import ProfileSettings from '@/components/settings/profile-settings';
import OrganizationSettings from '@/components/settings/organization-settings';

export default function Settings() {
  const { activeOrganization } = useWorkspace();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2 mb-8">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground">
          <TabsTrigger
            value="profile"
            className="inline-flex w-fit items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <User className="h-4 w-4 mr-2" />
            Profile Settings
          </TabsTrigger>
          <TabsTrigger
            value="organization"
            className="inline-flex w-fit items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:disabled:cursor-not-allowed disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            // disabled={!activeOrganization}
          >
            <Building className="h-4 w-4 mr-2" />
            Organization Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="organization" className="mt-6">
          <OrganizationSettings />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

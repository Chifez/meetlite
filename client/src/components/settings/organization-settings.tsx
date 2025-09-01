import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/contexts/workspace-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Building, Users } from 'lucide-react';
import {
  OrganizationService,
  UpdateOrganizationData,
} from '@/services/organizationService';
import OrganizationDangerZone from './organization-danger-zone';

const INDUSTRY_OPTIONS = [
  { value: 'technology', label: 'Technology' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance' },
  { value: 'education', label: 'Education' },
  { value: 'retail', label: 'Retail' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'other', label: 'Other' },
];

const SIZE_OPTIONS = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1000+', label: '1000+ employees' },
];

export default function OrganizationSettings() {
  const { activeOrganization, refreshOrganizations, currentWorkspaceRole } =
    useWorkspace();

  // Organization settings state
  const [orgLoading, setOrgLoading] = useState(false);
  const [organization, setOrganization] = useState<any>(null);
  const [orgFormData, setOrgFormData] = useState<UpdateOrganizationData>({
    name: '',
    description: '',
    industry: '',
    size: '',
  });

  // Load organization details when active organization changes
  useEffect(() => {
    const loadOrganization = async () => {
      if (!activeOrganization?.id) {
        setOrganization(null);
        setOrgFormData({
          name: '',
          description: '',
          industry: '',
          size: '',
        });
        return;
      }

      try {
        const response = await OrganizationService.getOrganizationDetails(
          activeOrganization.id
        );
        const org = response.organization;
        setOrganization(org);
        setOrgFormData({
          name: org.name || '',
          description: org.description || '',
          industry: org.industry || '',
          size: org.size || '',
        });
      } catch (error) {
        console.error('Failed to load organization:', error);
        toast.error('Failed to load organization details');
      }
    };

    loadOrganization();
  }, [activeOrganization?.id]);

  // Handle organization settings submission
  const onOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganization?.id) return;

    setOrgLoading(true);
    try {
      await OrganizationService.updateOrganization(
        activeOrganization.id,
        orgFormData
      );

      // Refresh organizations to get updated data
      await refreshOrganizations();

      toast.success('Organization settings updated successfully');
    } catch (error: any) {
      toast.error('Failed to update organization settings', {
        description: error.response?.data?.message || 'Please try again later.',
      });
    } finally {
      setOrgLoading(false);
    }
  };

  // Check if user is owner using the workspace context
  const isOrganizationOwner = currentWorkspaceRole === 'owner';

  if (!activeOrganization) {
    return (
      <Card>
        <CardHeader className="mb-4">
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Organization Settings
          </CardTitle>
          <CardDescription>No organization selected</CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No organization selected</p>
            <p className="text-sm">
              Switch to an organization to manage its settings
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Organization Settings
          </CardTitle>
          <CardDescription>
            Manage settings for {activeOrganization.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onOrgSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={orgFormData.name}
                onChange={(e) =>
                  setOrgFormData({ ...orgFormData, name: e.target.value })
                }
                placeholder="Enter organization name"
                required
                className="max-w-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgDescription">Description</Label>
              <Textarea
                id="orgDescription"
                value={orgFormData.description}
                onChange={(e) =>
                  setOrgFormData({
                    ...orgFormData,
                    description: e.target.value,
                  })
                }
                placeholder="What does your organization do?"
                rows={3}
                className="max-w-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgIndustry">Industry</Label>
              <Select
                value={orgFormData.industry}
                onValueChange={(value) =>
                  setOrgFormData({ ...orgFormData, industry: value })
                }
              >
                <SelectTrigger className="max-w-xl">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgSize">Organization Size</Label>
              <Select
                value={orgFormData.size}
                onValueChange={(value) =>
                  setOrgFormData({ ...orgFormData, size: value })
                }
              >
                <SelectTrigger className="max-w-xl">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 w-fit">
              <Button type="submit" disabled={orgLoading} className="flex-1">
                {orgLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Organization Changes'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isOrganizationOwner && (
        <OrganizationDangerZone
          organization={organization || activeOrganization}
          activeOrganization={activeOrganization}
        />
      )}
    </div>
  );
}

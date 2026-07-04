import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/contexts/workspace-context';
import {
  OrganizationService,
  UpdateOrganizationData,
} from '@/services/organization-service';
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
import { Trash2, Building, Users, AlertCircle, Loader2 } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import SEO from '@/components/seo';
import OrganizationDangerZone from '@/components/settings/organization-danger-zone';

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

export default function OrganizationSettingsPage() {
  const navigate = useNavigate();
  const { orgId } = useParams<{ orgId: string }>();
  const { isPersonalMode, activeOrganization, refreshOrganizations } = useWorkspace();

  const [loading, setLoading] = useState(false);
  const [organization, setOrganization] = useState<any>(null);
  const [formData, setFormData] = useState<UpdateOrganizationData>({
    name: '',
    description: '',
    industry: '',
    size: '',
  });

  useEffect(() => {
    if (isPersonalMode) {
      navigate('/dashboard', { replace: true });
    }
  }, [isPersonalMode, navigate]);

  useEffect(() => {
    const loadOrganization = async () => {
      if (!orgId) return;

      try {
        const response = await OrganizationService.getOrganizationDetails(orgId);
        const org = response.organization;
        setOrganization(org);
        setFormData({
          name: org.name || '',
          description: org.description || '',
          industry: org.industry || '',
          size: org.size || '',
        });
      } catch (error) {
        console.error('Failed to load organization:', error);
        toast.error('Failed to load organization details');
        navigate('/dashboard');
      }
    };

    loadOrganization();
  }, [orgId, navigate]);

  const handleInputChange = (field: keyof UpdateOrganizationData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    setLoading(true);
    try {
      const response = await OrganizationService.updateOrganization(orgId, formData);
      setOrganization(response.organization);
      await refreshOrganizations();
      toast.success('Workspace updated successfully');
    } catch (error: any) {
      console.error('Failed to update workspace:', error);
      toast.error(
        error.response?.data?.message || 'Failed to update workspace'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!organization) {
    return (
      <DashboardLayout>
        <SEO title="Loading Workspace Settings · MeetLite" />
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-[0.875rem] text-muted-foreground">Loading workspace settings…</p>
        </div>
      </DashboardLayout>
    );
  }

  const isOwner = organization.role === 'owner';

  if (!isOwner) {
    return (
      <DashboardLayout>
        <SEO title="Access Denied · MeetLite" />
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 border border-border rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <p className="text-[0.9375rem] font-semibold text-foreground tracking-[-0.01em]">
              Access denied
            </p>
            <p className="text-[0.8125rem] text-muted-foreground mt-1 max-w-xs">
              Only workspace owners can access these settings.
            </p>
          </div>
          <Button onClick={() => navigate('/dashboard')} variant="outline" size="sm">
            Back to dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEO title={`Workspace Settings · ${organization.name} · MeetLite`} />

      {/* Page Header */}
      <div>
        <h1 className="text-[1.25rem] font-bold text-foreground tracking-[-0.025em]">
          Workspace Settings
        </h1>
        <p className="text-[0.8125rem] text-muted-foreground mt-0.5">
          Manage workspace settings, details, and defaults for {organization.name}.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[1.125rem] tracking-[-0.02em]">
              <Building className="h-4.5 w-4.5 text-primary" />
              Workspace Profile
            </CardTitle>
            <CardDescription>
              Update your workspace profile and industry categorization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Workspace Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter workspace name"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="industry">Industry</Label>
                  <Select
                    value={formData.industry}
                    onValueChange={(value) => handleInputChange('industry', value)}
                  >
                    <SelectTrigger id="industry">
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
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="size">Workspace Size</Label>
                  <Select
                    value={formData.size}
                    onValueChange={(value) => handleInputChange('size', value)}
                  >
                    <SelectTrigger id="size">
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

                <div className="space-y-1.5">
                  <Label>Members</Label>
                  <div className="flex items-center gap-2 h-10 px-3 py-2 border border-border bg-muted/40 rounded-xl">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[0.875rem] font-medium text-foreground">
                      {organization.memberCount} member{organization.memberCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="What does your team do?"
                  rows={3}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button id="org-settings-page-save" type="submit" disabled={loading} className="rounded-xl font-semibold px-6">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <OrganizationDangerZone
          organization={organization}
          activeOrganization={activeOrganization}
        />
      </div>
    </DashboardLayout>
  );
}

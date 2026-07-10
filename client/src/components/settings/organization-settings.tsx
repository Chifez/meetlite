import { useState, useEffect, useRef } from 'react';
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
import { Loader2, Building, Users, ImagePlus } from 'lucide-react';
import { uploadService } from '@/services/upload-service';
import {
  OrganizationService,
  UpdateOrganizationData,
} from '@/services/organization-service';
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

  const [orgLoading, setOrgLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [orgFormData, setOrgFormData] = useState<UpdateOrganizationData>({
    name: '',
    description: '',
    logo: '',
    industry: '',
    size: '',
  });

  useEffect(() => {
    const loadOrganization = async () => {
      if (!activeOrganization?.id) {
        setOrganization(null);
        setOrgFormData({
          name: '',
          description: '',
          logo: '',
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
          logo: org.logo || '',
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

  const onOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganization?.id) return;

    setOrgLoading(true);
    try {
      await OrganizationService.updateOrganization(
        activeOrganization.id,
        orgFormData
      );
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeOrganization?.id) return;
    
    const MAX_SIZE = import.meta.env.VITE_MAX_LOGO_UPLOAD_SIZE_MB ? parseInt(import.meta.env.VITE_MAX_LOGO_UPLOAD_SIZE_MB) : 5;
    if (file.size > MAX_SIZE * 1024 * 1024) {
      toast.error(`File size must be less than ${MAX_SIZE}MB`);
      return;
    }

    setUploadingLogo(true);
    try {
      const url = await uploadService.uploadLogo(activeOrganization.id, file);
      setOrgFormData(prev => ({ ...prev, logo: url }));
      toast.success('Logo uploaded successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };



  const isOrganizationOwner = currentWorkspaceRole === 'owner';

  if (!activeOrganization) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[1rem] tracking-[-0.01em]">
              <Building className="h-4 w-4 text-muted-foreground" />
              Workspace Settings
            </CardTitle>
            <CardDescription>No active workspace selected.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-10 text-muted-foreground flex flex-col items-center gap-2">
              <Users className="h-10 w-10 text-muted-foreground/60" />
              <p className="text-[0.875rem] font-semibold text-foreground mt-2">No active workspace</p>
              <p className="text-xs text-muted-foreground">
                Switch to an organization workspace to manage its settings.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[1.125rem] tracking-[-0.02em]">
            <Building className="h-4.5 w-4.5 text-primary" />
            Workspace Settings
          </CardTitle>
          <CardDescription>
            Manage the information and defaults for {activeOrganization.name}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onOrgSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="orgName">Workspace Name</Label>
                <Input
                  id="orgName"
                  value={orgFormData.name}
                  onChange={(e) =>
                    setOrgFormData({ ...orgFormData, name: e.target.value })
                  }
                  placeholder="Enter workspace name"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="orgLogo">Logo URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="orgLogo"
                    value={orgFormData.logo || ''}
                    onChange={(e) =>
                      setOrgFormData({ ...orgFormData, logo: e.target.value })
                    }
                    placeholder="https://example.com/logo.png"
                    type="url"
                    className="flex-1"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleLogoUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="orgIndustry">Industry</Label>
                <Select
                  value={orgFormData.industry}
                  onValueChange={(value) =>
                    setOrgFormData({ ...orgFormData, industry: value })
                  }
                >
                  <SelectTrigger id="orgIndustry">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent position="item-aligned">
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
                <Label htmlFor="orgSize">Workspace Size</Label>
                <Select
                  value={orgFormData.size}
                  onValueChange={(value) =>
                    setOrgFormData({ ...orgFormData, size: value })
                  }
                >
                  <SelectTrigger id="orgSize">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent position="item-aligned">
                    {SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Member Count</Label>
                <div className="flex items-center gap-2 h-10 px-3 py-2 border border-border bg-muted/40 rounded-xl">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[0.875rem] font-medium text-foreground">
                    {organization?.memberCount ?? 1} member
                    {(organization?.memberCount ?? 1) !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
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
                placeholder="What does your team do?"
                rows={3}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button id="org-settings-save-btn" type="submit" disabled={orgLoading || !isOrganizationOwner} className="rounded-xl font-semibold px-6">
                {orgLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save workspace settings'
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

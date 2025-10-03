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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Trash2, Building, Users, Settings } from 'lucide-react';

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
  const navigate = useNavigate();
  const { orgId } = useParams<{ orgId: string }>();
  const { handleNewToken } = useAuth();
  const { activeOrganization, refreshOrganizations } = useWorkspace();

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [organization, setOrganization] = useState<any>(null);
  const [formData, setFormData] = useState<UpdateOrganizationData>({
    name: '',
    description: '',
    industry: '',
    size: '',
  });

  // Load organization details
  useEffect(() => {
    const loadOrganization = async () => {
      if (!orgId) return;

      try {
        const response = await OrganizationService.getOrganizationDetails(
          orgId
        );
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

  // Check if user is owner
  const isOwner = organization?.role === 'owner';

  const handleInputChange = (
    field: keyof UpdateOrganizationData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!orgId || !isOwner) return;

    setLoading(true);
    try {
      const response = await OrganizationService.updateOrganization(
        orgId,
        formData
      );
      setOrganization(response.organization);
      await refreshOrganizations();
      toast.success('Organization updated successfully');
    } catch (error: any) {
      console.error('Failed to update organization:', error);
      toast.error(
        error.response?.data?.message || 'Failed to update organization'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!orgId || !isOwner) return;

    setDeleting(true);
    try {
      const response = await OrganizationService.deleteOrganization(orgId);

      // Handle new token (switches to personal account)
      if (response.token) {
        handleNewToken(response.token);
      }

      toast.success('Organization deleted successfully');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Failed to delete organization:', error);
      toast.error(
        error.response?.data?.message || 'Failed to delete organization'
      );
    } finally {
      setDeleting(false);
    }
  };

  if (!organization) {
    return (
      <div className="min-h-screen bg-background pt-20 md:pt-24">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="flex items-center justify-center h-64">
            <p className="text-sm text-muted-foreground">
              Loading organization settings...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-background pt-20 md:pt-24">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
              <p className="text-sm text-muted-foreground">
                Only organization owners can access settings.
              </p>
              <Button
                onClick={() => navigate('/dashboard')}
                className="mt-4"
                variant="outline"
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 md:pt-24">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Organization Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your organization's information and settings.
          </p>
        </div>

        <div className="space-y-6">
          {/* General Information */}
          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
              <CardDescription>
                Update your organization's basic details and information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter organization name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select
                    value={formData.industry}
                    onValueChange={(value) =>
                      handleInputChange('industry', value)
                    }
                  >
                    <SelectTrigger>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="size">Organization Size</Label>
                  <Select
                    value={formData.size}
                    onValueChange={(value) => handleInputChange('size', value)}
                  >
                    <SelectTrigger>
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
                <div className="space-y-2">
                  <Label>Member Count</Label>
                  <div className="flex items-center gap-2 h-10 px-3 py-2 border border-input bg-muted rounded-md">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {organization.memberCount} member
                      {organization.memberCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange('description', e.target.value)
                  }
                  placeholder="Enter organization description"
                  rows={3}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions that will permanently affect your
                organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-destructive mb-1">
                      Delete Organization
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      This will permanently delete your organization and all
                      associated data. All members will be switched to their
                      personal accounts.
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="ml-4">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{organization.name}"?
                          This action cannot be undone. All organization data
                          will be permanently deleted, and all members will be
                          switched to their personal accounts.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          disabled={deleting}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleting ? 'Deleting...' : 'Delete Organization'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

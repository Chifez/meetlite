import type React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, Building2, ArrowRight, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OrganizationSetupPage() {
  const [formData, setFormData] = useState({
    organizationName: '',
    organizationSize: '',
    industry: '',
    logo: null as File | null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Mock organization creation
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Create mock organization data
    const organization = {
      id: 'org_1',
      name: formData.organizationName,
      size: formData.organizationSize,
      industry: formData.industry,
      logo: formData.logo ? URL.createObjectURL(formData.logo) : null,
      members: [
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'admin',
        },
      ],
    };

    // Update user data
    const updatedUser = {
      ...user,
      accountType: 'organization',
      organizationId: organization.id,
      onboardingComplete: true,
    };

    localStorage.setItem('user', JSON.stringify(updatedUser));
    localStorage.setItem('organization', JSON.stringify(organization));

    navigate('/dashboard');
    setIsLoading(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, logo: file }));
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">
                ML
              </span>
            </div>
            <span className="text-xl font-semibold text-foreground">
              meetlite
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">Final Step</span>
            <span className="text-sm text-muted-foreground">Almost done!</span>
          </div>
          <Progress value={90} className="h-2" />
        </div>

        {/* Main Content */}
        <Card className="border-border shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-semibold">
              Set up your organization
            </CardTitle>
            <CardDescription className="text-base">
              Tell us about your organization to customize your meetlite
              experience
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name *</Label>
                <Input
                  id="orgName"
                  type="text"
                  placeholder="Enter your organization name"
                  value={formData.organizationName}
                  onChange={(e) =>
                    updateFormData('organizationName', e.target.value)
                  }
                  required
                  className="bg-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="orgSize">Organization Size</Label>
                <select
                  id="orgSize"
                  value={formData.organizationSize}
                  onChange={(e) =>
                    updateFormData('organizationSize', e.target.value)
                  }
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select organization size</option>
                  <option value="1-10">1-10 employees</option>
                  <option value="11-50">11-50 employees</option>
                  <option value="51-200">51-200 employees</option>
                  <option value="201-1000">201-1000 employees</option>
                  <option value="1000+">1000+ employees</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  type="text"
                  placeholder="e.g., Technology, Healthcare, Education"
                  value={formData.industry}
                  onChange={(e) => updateFormData('industry', e.target.value)}
                  className="bg-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo">Organization Logo (Optional)</Label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('logo')?.click()}
                      className="w-full justify-start"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {formData.logo ? formData.logo.name : 'Upload logo'}
                    </Button>
                  </div>
                  {formData.logo && (
                    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                      <img
                        src={
                          URL.createObjectURL(formData.logo) ||
                          '/placeholder.svg'
                        }
                        alt="Logo preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/onboarding')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>

                <Button
                  type="submit"
                  disabled={isLoading || !formData.organizationName}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isLoading ? 'Creating organization...' : 'Complete Setup'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

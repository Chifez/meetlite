import { useState, useEffect } from 'react';
import { Mail, Loader2, Building, Users, Briefcase, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/use-auth';

// Company size options
const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1000+', label: '1000+ employees' },
];

// Industry options
const INDUSTRIES = [
  { value: 'technology', label: 'Technology' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance & Banking' },
  { value: 'education', label: 'Education' },
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'media', label: 'Media & Entertainment' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'nonprofit', label: 'Non-profit' },
  { value: 'government', label: 'Government' },
  { value: 'startup', label: 'Startup' },
  { value: 'other', label: 'Other' },
];

// Use case options
const USE_CASES = [
  { value: 'team_meetings', label: 'Team Meetings' },
  { value: 'client_calls', label: 'Client Calls' },
  { value: 'webinars', label: 'Webinars & Events' },
  { value: 'training', label: 'Training & Onboarding' },
  { value: 'remote_work', label: 'Remote Work Collaboration' },
  { value: 'sales_demos', label: 'Sales Demos' },
  { value: 'support', label: 'Customer Support' },
  { value: 'education', label: 'Education & Learning' },
  { value: 'other', label: 'Other' },
];

// Timeline options
const TIMELINES = [
  { value: 'immediate', label: 'Immediately' },
  { value: '1-month', label: 'Within 1 month' },
  { value: '1-3-months', label: '1-3 months' },
  { value: '3-6-months', label: '3-6 months' },
  { value: '6-months+', label: '6+ months' },
  { value: 'just-exploring', label: 'Just exploring' },
];

export interface ContactSalesFormData {
  // Contact Info
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  // Company Info
  companyName: string;
  companySize: string;
  industry: string;
  website: string;
  country: string;
  // Use Case
  primaryUseCase: string;
  expectedUsers: string;
  timeline: string;
  // Additional
  requirements: string;
  message: string;
  // Startup-specific
  isStartup: boolean;
  fundingStage: string;
}

interface ContactSalesModalProps {
  open: boolean;
  onClose: () => void;
  source?: string; // Where the modal was opened from (landing_page, dashboard, settings, etc.)
}

const ContactSalesModal = ({
  open,
  onClose,
  source = 'unknown',
}: ContactSalesModalProps) => {
  const { user } = useAuth();
  const isAuthenticated = !!user;

  const [formData, setFormData] = useState<ContactSalesFormData>({
    name: '',
    email: '',
    phone: '',
    jobTitle: '',
    companyName: '',
    companySize: '',
    industry: '',
    website: '',
    country: '',
    primaryUseCase: '',
    expectedUsers: '',
    timeline: '',
    requirements: '',
    message: '',
    isStartup: false,
    fundingStage: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill data from authenticated user
  useEffect(() => {
    if (isAuthenticated && user) {
      setFormData((prev) => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
      }));
    }
  }, [isAuthenticated, user]);

  // Detect if company is a startup based on size and industry
  useEffect(() => {
    const isSmallCompany =
      formData.companySize === '1-10' || formData.companySize === '11-50';
    const isStartupIndustry = formData.industry === 'startup';
    setFormData((prev) => ({
      ...prev,
      isStartup: isSmallCompany || isStartupIndustry,
    }));
  }, [formData.companySize, formData.industry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Company name required
    if (!formData.companyName.trim()) {
      toast.error('Please enter your company name');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post('/api/contact/sales', {
        // Contact Info
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        jobTitle: formData.jobTitle.trim() || undefined,
        // Company Info
        companyName: formData.companyName.trim(),
        companySize: formData.companySize || undefined,
        industry: formData.industry || undefined,
        website: formData.website.trim() || undefined,
        country: formData.country.trim() || undefined,
        // Use Case
        primaryUseCase: formData.primaryUseCase || undefined,
        expectedUsers: formData.expectedUsers.trim() || undefined,
        timeline: formData.timeline || undefined,
        // Additional
        requirements: formData.requirements.trim() || undefined,
        message: formData.message.trim() || undefined,
        // Meta
        isStartup: formData.isStartup,
        fundingStage: formData.isStartup ? formData.fundingStage : undefined,
        source,
        isAuthenticated,
      });

      toast.success('Thank you! Our sales team will contact you within 24 hours.');
      resetForm();
      onClose();
    } catch (error: any) {
      console.error('Contact form error:', error);
      toast.error(
        error.response?.data?.message ||
          'Failed to send message. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      phone: '',
      jobTitle: '',
      companyName: '',
      companySize: '',
      industry: '',
      website: '',
      country: '',
      primaryUseCase: '',
      expectedUsers: '',
      timeline: '',
      requirements: '',
      message: '',
      isStartup: false,
      fundingStage: '',
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Contact Enterprise Sales
          </DialogTitle>
          <DialogDescription>
            Tell us about your organization and we'll create a custom solution
            for your needs.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Contact Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Mail className="h-4 w-4" />
              Contact Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">
                  Work Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@company.com"
                  disabled={isSubmitting || isAuthenticated}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 123-4567"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job Title</Label>
                <Input
                  id="jobTitle"
                  name="jobTitle"
                  type="text"
                  value={formData.jobTitle}
                  onChange={handleChange}
                  placeholder="VP of Engineering"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Company Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              Company Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">
                  Company Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="Acme Inc."
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companySize">Company Size</Label>
                <Select
                  value={formData.companySize}
                  onValueChange={(value) =>
                    handleSelectChange('companySize', value)
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZES.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Select
                  value={formData.industry}
                  onValueChange={(value) =>
                    handleSelectChange('industry', value)
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind.value} value={ind.value}>
                        {ind.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://company.com"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  name="country"
                  type="text"
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="United States"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Use Case */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4" />
              Your Requirements
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryUseCase">Primary Use Case</Label>
                <Select
                  value={formData.primaryUseCase}
                  onValueChange={(value) =>
                    handleSelectChange('primaryUseCase', value)
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select use case" />
                  </SelectTrigger>
                  <SelectContent>
                    {USE_CASES.map((uc) => (
                      <SelectItem key={uc.value} value={uc.value}>
                        {uc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectedUsers">Expected Users</Label>
                <Input
                  id="expectedUsers"
                  name="expectedUsers"
                  type="text"
                  value={formData.expectedUsers}
                  onChange={handleChange}
                  placeholder="e.g., 100-500"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="timeline">Implementation Timeline</Label>
                <Select
                  value={formData.timeline}
                  onValueChange={(value) =>
                    handleSelectChange('timeline', value)
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="When do you need this?" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMELINES.map((tl) => (
                      <SelectItem key={tl.value} value={tl.value}>
                        {tl.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Startup-specific fields */}
          {formData.isStartup && (
            <div className="space-y-4 p-4 rounded-lg bg-muted/50 border border-muted">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Globe className="h-4 w-4" />
                Startup Program
              </div>
              <p className="text-sm text-muted-foreground">
                We offer special pricing for startups. Tell us more about your
                company.
              </p>
              <div className="space-y-2">
                <Label htmlFor="fundingStage">Funding Stage (Optional)</Label>
                <Select
                  value={formData.fundingStage}
                  onValueChange={(value) =>
                    handleSelectChange('fundingStage', value)
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bootstrapped">Bootstrapped</SelectItem>
                    <SelectItem value="pre-seed">Pre-seed</SelectItem>
                    <SelectItem value="seed">Seed</SelectItem>
                    <SelectItem value="series-a">Series A</SelectItem>
                    <SelectItem value="series-b">Series B</SelectItem>
                    <SelectItem value="series-c+">Series C+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="message">Additional Information</Label>
            <Textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Tell us about your specific needs, requirements, or questions..."
              rows={4}
              disabled={isSubmitting}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Submit Inquiry'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContactSalesModal;



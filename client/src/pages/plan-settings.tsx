import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Button } from '@/components/ui/button';

import {
  Settings,
  TrendingUp,
  Crown,
  CreditCard,
  History,
  CheckCircle,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import PlanUsageCard from '@/components/plan/plan-usage-card';
import PlanComparison from '@/components/plan/plan-comparison';
import { PaymentService } from '@/services/payment-service';
import { PlanSummary } from '@/types/plan';
import { toast } from 'sonner';
import { extractError } from '@/lib/api-response';

export default function PlanSettings() {
  const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadPlanData();
  }, []);

  const loadPlanData = async () => {
    try {
      setLoading(true);
      // Mock data for now - replace with actual API call when available
      const mockSummary: PlanSummary = {
        plan: 'free',
        suggestions: [],
        canUpgrade: true,
        usage: {
          organizationsOwned: 1,
          organizationsMember: 1,
          invitationsSentToday: 2,
          invitationsSentThisMonth: 15,
          meetingsCreatedToday: 1,
          meetingsCreatedThisMonth: 12,
          storageUsedGB: 1,
          apiCallsToday: 50,
        },
        limits: {
          maxOrganizationsOwned: 1,
          maxOrganizationsMember: 5,
          maxTeamSize: 10,
          maxInvitationsPerDay: 5,
          maxInvitationsPerMonth: 100,
          maxConcurrentMeetings: 1,
          maxMeetingDuration: 60,
          maxParticipantsPerMeeting: 50,
          maxMeetingsPerDay: 10,
          maxMeetingsPerMonth: 50,
          maxStorageGB: 1,
          maxFileSizeMB: 10,
          maxFilesPerMeeting: 5,
          features: ['basic-meetings', 'screen-share', 'chat'],
          maxAPICallsPerDay: 1000,
          maxWebhooks: 0,
          supportLevel: 'community',
          responseTime: '48-72 hours',
          customBranding: false,
          whiteLabel: false,
          sso: false,
          advancedSecurity: false,
          analytics: 'basic',
          reporting: 'basic',
          dataRetention: 30,
        },
      };
      setPlanSummary(mockSummary);
    } catch (err: any) {
      console.error('Failed to load plan data:', err);
      toast.error(extractError(err) || 'Failed to load plan information. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planName: string) => {
    try {
      // Convert plan name to payment service format
      const planType = planName === 'pro' ? 'pro' : 'enterprise';
      await PaymentService.redirectToCheckout(planType, 'monthly');
    } catch (error: any) {
      console.error('Upgrade error:', error);
      toast.error(extractError(error) || 'Failed to start upgrade process. Please try again.');
    }
  };

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return <Crown className="h-5 w-5" />;
      case 'pro':
        return <TrendingUp className="h-5 w-5" />;
      default:
        return <CheckCircle className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Plan Settings</h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-6 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[1, 2, 3].map((j) => (
                      <div
                        key={j}
                        className="h-4 bg-muted rounded animate-pulse"
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Plan Settings</h1>
          </div>

          {planSummary && planSummary.plan !== 'enterprise' && (
            <Button onClick={() => handleUpgrade('pro')}>
              <Crown className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          )}
        </div>

        {/* Current Plan Summary */}
        {planSummary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getPlanIcon(planSummary.plan)}
                Current Plan: {planSummary.plan.toUpperCase()}
              </CardTitle>
              <CardDescription>
                Manage your subscription and view usage details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg border">
                  <div className="text-2xl font-bold text-primary">
                    {planSummary.plan.toUpperCase()}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Current Plan
                  </div>
                </div>

                <div className="text-center p-4 rounded-lg border">
                  <div className="text-2xl font-bold">
                    {planSummary.suggestions.length}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Upgrade Suggestions
                  </div>
                </div>

                <div className="text-center p-4 rounded-lg border">
                  <div className="text-2xl font-bold">
                    {planSummary.canUpgrade ? 'Yes' : 'No'}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Can Upgrade
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="usage">Usage Details</TabsTrigger>
            <TabsTrigger value="plans">Plans & Pricing</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Plan Usage Card */}
              <PlanUsageCard showUpgradeButton={false} />

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                  <CardDescription>
                    Manage your subscription and billing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setActiveTab('plans')}
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    View All Plans
                  </Button>

                  <Button variant="outline" className="w-full justify-start">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Billing History
                  </Button>

                  <Button variant="outline" className="w-full justify-start">
                    <History className="h-4 w-4 mr-2" />
                    Usage History
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Usage Details Tab */}
          <TabsContent value="usage" className="space-y-6">
            <PlanUsageCard compact={false} showUpgradeButton={true} />
          </TabsContent>

          {/* Plans & Pricing Tab */}
          <TabsContent value="plans" className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Choose Your Plan</h2>
              <p className="text-muted-foreground">
                Select the plan that best fits your needs
              </p>
            </div>

            <PlanComparison
              currentPlan={planSummary?.plan || 'free'}
              showUpgradeButtons={true}
            />

            {/* Additional Information */}
            <Card>
              <CardHeader>
                <CardTitle>Need Help Choosing?</CardTitle>
                <CardDescription>
                  Contact our sales team for personalized recommendations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Enterprise Features</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Custom integrations</li>
                      <li>• Dedicated support</li>
                      <li>• SSO & advanced security</li>
                      <li>• Custom analytics</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Pro Features</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Advanced meetings</li>
                      <li>• Breakout rooms</li>
                      <li>• Meeting analytics</li>
                      <li>• Custom backgrounds</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

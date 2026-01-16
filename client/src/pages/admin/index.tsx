import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AdminService,
  type OverviewMetrics,
  type UserGrowthData,
  type PlanDistribution,
} from '@/services/admin-service';
import AdminLayout from '@/components/admin/admin-layout';
import { MetricCard } from '@/components/admin/metric-card';
import { ChartCard } from '@/components/admin/chart-card';
import { Button } from '@/components/ui/button';
import { LineChart } from '@/components/admin/charts/line-chart';
import { PieChart } from '@/components/admin/charts/pie-chart';
import SEO from '@/components/seo';

export default function AdminOverview() {
  const [growthPeriod, setGrowthPeriod] = useState<'1d' | '7d' | '30d' | '90d'>(
    '30d'
  );

  const { data: metrics, isLoading: metricsLoading } =
    useQuery<OverviewMetrics>({
      queryKey: ['admin-metrics'],
      queryFn: () => AdminService.getOverviewMetrics(),
      refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    });

  const { data: userGrowthData, isLoading: growthLoading } = useQuery<
    UserGrowthData[]
  >({
    queryKey: ['admin-user-growth', growthPeriod],
    queryFn: () => AdminService.getUserGrowthData(growthPeriod),
  });

  const { data: planDistribution, isLoading: planLoading } =
    useQuery<PlanDistribution>({
      queryKey: ['admin-plan-distribution'],
      queryFn: () => AdminService.getPlanDistribution(),
    });

  const chartData = useMemo(() => {
    if (!userGrowthData) return [];
    return userGrowthData.map((item) => {
      const date = new Date(item.date);
      let formattedDate: string;

      if (growthPeriod === '1d') {
        // Format as hour:minute for hourly data
        formattedDate = date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      } else {
        // Format as month day for daily data
        formattedDate = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      }

      return {
        label: formattedDate,
        users: item.count,
      };
    });
  }, [userGrowthData, growthPeriod]);

  const pieData = useMemo(() => {
    if (!planDistribution) return [];
    return [
      { name: 'Free', value: planDistribution.free },
      { name: 'Pro', value: planDistribution.pro },
      { name: 'Enterprise', value: planDistribution.enterprise },
    ];
  }, [planDistribution]);

  if (metricsLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  if (!metrics) return null;

  return (
    <>
      <SEO title="Admin Overview" />
      <AdminLayout>
        <div className="space-y-6 p-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Admin Overview
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor your platform metrics and performance
            </p>
          </div>

          {/* Primary Metrics - 4 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Users"
              value={metrics.totalUsers.toLocaleString()}
              growth={metrics.totalUsersGrowth}
              trend={metrics.totalUsersGrowth >= 0 ? 'up' : 'down'}
              subscript={{
                label: 'Paid',
                value: metrics.paidUsers.toLocaleString(),
                growth: metrics.paidUsersGrowth,
                trend: metrics.paidUsersGrowth >= 0 ? 'up' : 'down',
              }}
            />
            <MetricCard
              title="MRR"
              value={`$${metrics.mrr.toLocaleString()}`}
              growth={metrics.mrrGrowth}
              trend={metrics.mrrGrowth >= 0 ? 'up' : 'down'}
              subscript={{
                label: 'Active (30d)',
                value: metrics.activeUsers.toLocaleString(),
                growth: metrics.activeUsersGrowth,
                trend: metrics.activeUsersGrowth >= 0 ? 'up' : 'down',
              }}
            />
            <MetricCard
              title="Organizations"
              value={metrics.organizationsCount.toLocaleString()}
              growth={metrics.organizationsGrowth}
              trend={metrics.organizationsGrowth >= 0 ? 'up' : 'down'}
              subscript={{
                label: 'Teams',
                value: metrics.teamsCount.toLocaleString(),
              }}
            />
            <MetricCard
              title="Meetings (This Month)"
              value={metrics.meetingsThisMonth.toLocaleString()}
              growth={metrics.meetingsGrowth}
              trend={metrics.meetingsGrowth >= 0 ? 'up' : 'down'}
              subscript={{
                label: 'Per day',
                value: metrics.meetingsPerDay.toFixed(1),
              }}
            />
          </div>

          {/* Charts - Bento Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
            <ChartCard
              title="User Growth"
              subtitle="User activity over time"
              className="lg:col-span-4"
              action={
                <div className="flex gap-2">
                  <Button
                    variant={growthPeriod === '1d' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setGrowthPeriod('1d')}
                  >
                    24h
                  </Button>
                  <Button
                    variant={growthPeriod === '7d' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setGrowthPeriod('7d')}
                  >
                    7d
                  </Button>
                  <Button
                    variant={growthPeriod === '30d' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setGrowthPeriod('30d')}
                  >
                    30d
                  </Button>
                  <Button
                    variant={growthPeriod === '90d' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setGrowthPeriod('90d')}
                  >
                    90d
                  </Button>
                </div>
              }
            >
              {growthLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <LineChart
                  data={chartData}
                  dataKey="users"
                  height={300}
                  color="hsl(var(--primary))"
                />
              )}
            </ChartCard>

            <ChartCard
              title="Plan Distribution"
              subtitle={
                planDistribution
                  ? `${(
                      planDistribution.free +
                      planDistribution.pro +
                      planDistribution.enterprise
                    ).toLocaleString()} organizations by plan`
                  : undefined
              }
              className="lg:col-span-2"
            >
              {planLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <PieChart data={pieData} height={300} />
              )}
            </ChartCard>
          </div>
        </div>
      </AdminLayout>
    </>
  );
}

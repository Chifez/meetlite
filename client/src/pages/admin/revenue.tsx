import { useQuery } from '@tanstack/react-query';
import { AdminService } from '@/services/admin-service';
import AdminLayout from '@/components/admin/admin-layout';
import { MetricCard } from '@/components/admin/metric-card';
import { ChartCard } from '@/components/admin/chart-card';
import { LineChart } from '@/components/admin/charts/line-chart';
import { PieChart } from '@/components/admin/charts/pie-chart';
import SEO from '@/components/seo';

export default function AdminRevenue() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['admin-revenue-metrics'],
    queryFn: () => AdminService.getRevenueMetrics(),
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['admin-revenue-chart', 'overTime', '12m'],
    queryFn: () => AdminService.getRevenueChartData('overTime', '12m'),
  });

  const { data: planChartData, isLoading: planChartLoading } = useQuery({
    queryKey: ['admin-revenue-chart', 'byPlan'],
    queryFn: () => AdminService.getRevenueChartData('byPlan'),
  });

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

  const formattedChartData =
    chartData?.map((item: any) => ({
      label: item.period,
      revenue: item.revenue,
    })) || [];

  return (
    <>
      <SEO title="Admin - Revenue" />
      <AdminLayout>
        <div className="space-y-6 p-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Revenue</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor revenue metrics and trends
            </p>
          </div>

          {/* Revenue Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
              title="MRR"
              value={`$${metrics.mrr.toLocaleString()}`}
              growth={metrics.revenueGrowth}
              trend={metrics.revenueGrowth >= 0 ? 'up' : 'down'}
            />
            <MetricCard
              title="ARR"
              value={`$${metrics.arr.toLocaleString()}`}
            />
            <MetricCard
              title="Revenue Growth"
              value={`${
                metrics.revenueGrowth >= 0 ? '+' : ''
              }${metrics.revenueGrowth.toFixed(1)}%`}
              trend={metrics.revenueGrowth >= 0 ? 'up' : 'down'}
            />
            <MetricCard title="ARPU" value={`$${metrics.arpu.toFixed(2)}`} />
            <MetricCard
              title="Failed Payments"
              value={metrics.failedPaymentsCount.toLocaleString()}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <ChartCard title="Revenue Over Time (12 Months)" className="lg:col-span-3">
              {chartLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <LineChart
                  data={formattedChartData}
                  dataKey="revenue"
                  height={300}
                  color="hsl(var(--primary))"
                />
              )}
            </ChartCard>

            <ChartCard title="Revenue by Plan Type" className="lg:col-span-1">
              {planChartLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : planChartData && planChartData[0] ? (
                <PieChart
                  data={[
                    {
                      name: 'Pro',
                      value: planChartData[0].breakdown?.pro || 0,
                    },
                    {
                      name: 'Enterprise',
                      value: planChartData[0].breakdown?.enterprise || 0,
                    },
                  ]}
                  height={300}
                />
              ) : null}
            </ChartCard>
          </div>
        </div>
      </AdminLayout>
    </>
  );
}

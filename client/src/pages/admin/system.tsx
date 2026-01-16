import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminService } from '@/services/admin-service';
import AdminLayout from '@/components/admin/admin-layout';
import { MetricCard } from '@/components/admin/metric-card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import SEO from '@/components/seo';

export default function AdminSystem() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    type: 'all',
    severity: 'all',
  });

  const { data: health } = useQuery({
    queryKey: ['admin-system-health'],
    queryFn: () => AdminService.getSystemHealth(),
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });

  // Mock logs data - replace with actual API call when implemented
  const allLogs = [
    {
      id: '1',
      timestamp: new Date(),
      type: 'error',
      severity: 'high',
      userEmail: 'user@example.com',
      description: 'API request failed',
      ipAddress: '192.168.1.1',
      status: 'resolved',
    },
  ];

  // Filter logs based on search and filters
  const logs = allLogs.filter((log) => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        log.userEmail?.toLowerCase().includes(searchLower) ||
        log.description?.toLowerCase().includes(searchLower) ||
        log.ipAddress?.toLowerCase().includes(searchLower) ||
        log.type?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Type filter
    if (filters.type !== 'all' && log.type !== filters.type) {
      return false;
    }

    // Severity filter
    if (filters.severity !== 'all' && log.severity !== filters.severity) {
      return false;
    }

    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="default">Medium</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  return (
    <>
      <SEO title="Admin - System & Logs" />
      <AdminLayout>
        <div className="space-y-6 p-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              System & Logs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor system health and activity logs
            </p>
          </div>

          {/* System Health */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="API Response Time"
              value={`${health?.apiResponseTime || 0}ms`}
              subtitle={
                health?.apiResponseTime < 200
                  ? 'Good'
                  : health?.apiResponseTime < 500
                  ? 'Acceptable'
                  : 'Slow'
              }
            />
            <MetricCard
              title="Error Rate"
              value={`${health?.errorRate || 0}%`}
              subtitle={
                health?.errorRate < 1
                  ? 'Good'
                  : health?.errorRate < 5
                  ? 'Warning'
                  : 'Critical'
              }
            />
            <div className="border rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Database Status
                </p>
                {getStatusIcon(health?.databaseStatus || 'unknown')}
              </div>
              <p className="text-2xl font-bold text-foreground capitalize">
                {health?.databaseStatus || 'Unknown'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {health?.databaseConnections?.used || 0} /{' '}
                {health?.databaseConnections?.total || 0} connections
              </p>
            </div>
            <MetricCard
              title="Storage Used"
              value={`${health?.storageUsed || 0} GB`}
              subtitle={`${(
                ((health?.storageUsed || 0) /
                  (health?.storageCapacity || 10000)) *
                100
              ).toFixed(1)}% of ${(
                (health?.storageCapacity || 10000) / 1000
              ).toFixed(0)} TB`}
            />
          </div>

          {/* Activity Logs */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Activity Logs
            </h2>

            <div className="flex gap-4 items-center flex-wrap">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                  }}
                  className="pl-10"
                />
              </div>
              <Select
                value={filters.type}
                onValueChange={(value) => {
                  setFilters({ ...filters, type: value });
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="user">User Activity</SelectItem>
                  <SelectItem value="system">System Events</SelectItem>
                  <SelectItem value="security">Security Events</SelectItem>
                  <SelectItem value="payment">Payment Events</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.severity}
                onValueChange={(value) => {
                  setFilters({ ...filters, severity: value });
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto scrollbar-hide" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                <table className="min-w-[800px] w-full caption-bottom text-sm">
                  <thead className="sticky top-0 z-30 bg-background shadow-sm [&_tr]:border-b">
                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      <th className="h-10 px-2 text-left align-middle font-semibold text-foreground sticky left-0 z-40 bg-background border-r">
                        Timestamp
                      </th>
                      <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Type</th>
                      <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Severity</th>
                      <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">User</th>
                      <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Description</th>
                      <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">IP Address</th>
                      <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-8"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <Search className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium">No logs found</p>
                          <p className="text-xs">
                            {search || filters.type !== 'all' || filters.severity !== 'all'
                              ? 'Try adjusting your filters'
                              : 'Logs API will be implemented in the backend'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm sticky left-0 z-30 bg-background border-r">
                          {format(
                            new Date(log.timestamp),
                            'MMM d, yyyy HH:mm:ss'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {log.type.charAt(0).toUpperCase() + log.type.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{getSeverityBadge(log.severity)}</TableCell>
                        <TableCell className="text-sm">{log.userEmail || 'N/A'}</TableCell>
                        <TableCell className="text-sm">{log.description}</TableCell>
                        <TableCell className="text-sm">{log.ipAddress}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              log.status === 'resolved'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </>
  );
}

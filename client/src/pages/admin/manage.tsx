import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminService } from '@/services/admin-service';
import AdminLayout from '@/components/admin/admin-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import {
  Search,
  MoreVertical,
  Edit,
  Trash2,
  UserX,
  UserCheck,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { toast } from 'sonner';
import SEO from '@/components/seo';
import { Pagination } from '@/components/admin/pagination';

const PAGE_SIZE = 10;

export default function AdminManage() {
  const [activeTab, setActiveTab] = useState<
    'users' | 'organizations' | 'meetings'
  >('users');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    plan: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
  });

  // Users query
  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['admin-users', page, search, filters.plan, filters.status],
    queryFn: () =>
      AdminService.getUsersList({
        page,
        limit: PAGE_SIZE,
        search,
        plan: filters.plan === 'all' ? undefined : filters.plan,
        status: filters.status === 'all' ? undefined : filters.status,
      }),
    enabled: activeTab === 'users',
  });

  // Organizations query
  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ['admin-organizations', page, search, filters.plan],
    queryFn: () =>
      AdminService.getOrganizationsList({
        page,
        limit: PAGE_SIZE,
        search,
        plan: filters.plan === 'all' ? undefined : filters.plan,
      }),
    enabled: activeTab === 'organizations',
  });

  // Meetings query
  const {
    data: meetingsData,
    isLoading: meetingsLoading,
    refetch: refetchMeetings,
  } = useQuery({
    queryKey: [
      'admin-meetings',
      page,
      search,
      filters.status,
      filters.dateFrom,
      filters.dateTo,
    ],
    queryFn: () =>
      AdminService.getMeetingsList({
        page,
        limit: PAGE_SIZE,
        search,
        status: filters.status === 'all' ? undefined : filters.status,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      }),
    enabled: activeTab === 'meetings',
  });

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await AdminService.deleteUser(userId);
      toast.success('User deleted successfully');
      refetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    }
  };

  const handleSuspendUser = async (userId: string) => {
    try {
      await AdminService.suspendUser(userId);
      toast.success('User suspended successfully');
      refetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to suspend user');
    }
  };

  const handleUnsuspendUser = async (userId: string) => {
    try {
      await AdminService.unsuspendUser(userId);
      toast.success('User unsuspended successfully');
      refetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to unsuspend user');
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!confirm('Are you sure you want to delete this meeting?')) return;
    try {
      await AdminService.deleteMeeting(meetingId);
      toast.success('Meeting deleted successfully');
      refetchMeetings();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete meeting');
    }
  };

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case 'pro':
        return 'default';
      case 'enterprise':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'scheduled':
        return 'secondary';
      case 'completed':
        return 'outline';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <>
      <SEO title="Admin - Manage" />
      <AdminLayout>
        <div className="space-y-6 p-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Manage</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage users, organizations, and meetings
            </p>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as any);
              setPage(1);
              setSearch('');
              setFilters({
                plan: 'all',
                status: 'all',
                dateFrom: '',
                dateTo: '',
              });
            }}
          >
            <TabsList>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="organizations">Organizations</TabsTrigger>
              <TabsTrigger value="meetings">Meetings</TabsTrigger>
            </TabsList>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-4">
              <div className="flex gap-4 items-center flex-wrap">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={filters.plan}
                  onValueChange={(value) => {
                    setFilters({ ...filters, plan: value });
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {usersLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto overflow-y-auto scrollbar-hide" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                      <table className="min-w-[800px] w-full caption-bottom text-sm">
                        <thead className="sticky top-0 z-30 bg-background shadow-sm [&_tr]:border-b">
                          <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground sticky left-0 z-40 bg-background border-r">
                              Name
                            </th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Email</th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Plan</th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Status</th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Created</th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Last Active</th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Orgs</th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground w-[50px]"></th>
                          </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                        {usersData?.users && usersData.users.length > 0 ? (
                          usersData.users.map((user: any) => (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium sticky left-0 z-30 bg-background border-r">
                                {user.name || 'N/A'}
                              </TableCell>
                              <TableCell className="text-sm">{user.email}</TableCell>
                              <TableCell>
                                <Badge variant={getPlanBadgeVariant(user.plan)}>
                                  {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    user.status === 'active'
                                      ? 'default'
                                      : 'destructive'
                                  }
                                >
                                  {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {format(new Date(user.createdAt), 'MMM d, yyyy')}
                              </TableCell>
                              <TableCell className="text-sm">
                                {user.lastActive
                                  ? format(
                                      new Date(user.lastActive),
                                      'MMM d, yyyy'
                                    )
                                  : 'Never'}
                              </TableCell>
                              <TableCell className="text-sm">{user.orgsCount || 0}</TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem>
                                      <Edit className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    {user.status === 'active' ? (
                                      <DropdownMenuItem
                                        onClick={() => handleSuspendUser(user.id)}
                                      >
                                        <UserX className="mr-2 h-4 w-4" />
                                        Suspend
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          handleUnsuspendUser(user.id)
                                        }
                                      >
                                        <UserCheck className="mr-2 h-4 w-4" />
                                        Unsuspend
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() => handleDeleteUser(user.id)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={8}
                              className="text-center text-muted-foreground py-8"
                            >
                              <div className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                  <Search className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <p className="text-sm font-medium">No users found</p>
                                <p className="text-xs">
                                  {search || filters.plan !== 'all' || filters.status !== 'all'
                                    ? 'Try adjusting your filters'
                                    : 'Users will appear here once they sign up'}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {usersData && usersData.totalPages > 0 && (
                    <Pagination
                      currentPage={page}
                      totalPages={usersData.totalPages}
                      onPageChange={setPage}
                      totalItems={usersData.total}
                      itemsPerPage={PAGE_SIZE}
                      itemName="users"
                    />
                  )}
                </>
              )}
            </TabsContent>

            {/* Organizations Tab */}
            <TabsContent value="organizations" className="space-y-4">
              <div className="flex gap-4 items-center flex-wrap">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search organizations..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
              </div>

              {orgsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto overflow-y-auto scrollbar-hide" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                      <table className="min-w-[800px] w-full caption-bottom text-sm">
                        <thead className="sticky top-0 z-30 bg-background shadow-sm [&_tr]:border-b">
                          <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground sticky left-0 z-40 bg-background border-r">
                              Name
                            </th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Owner</th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Members</th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Teams</th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Plan</th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Created</th>
                          </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                        {orgsData?.organizations && orgsData.organizations.length > 0 ? (
                          orgsData.organizations.map((org: any) => (
                            <TableRow key={org.id}>
                              <TableCell className="font-medium sticky left-0 z-30 bg-background border-r">
                                {org.name}
                              </TableCell>
                              <TableCell className="text-sm">{org.ownerEmail}</TableCell>
                              <TableCell className="text-sm">{org.membersCount}</TableCell>
                              <TableCell className="text-sm">{org.teamsCount}</TableCell>
                              <TableCell>
                                <Badge variant={getPlanBadgeVariant(org.plan)}>
                                  {org.plan.charAt(0).toUpperCase() + org.plan.slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {format(new Date(org.createdAt), 'MMM d, yyyy')}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center text-muted-foreground py-8"
                            >
                              <div className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                  <Search className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <p className="text-sm font-medium">No organizations found</p>
                                <p className="text-xs">
                                  {search || filters.plan !== 'all'
                                    ? 'Try adjusting your filters'
                                    : 'Organizations will appear here once created'}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {orgsData && orgsData.totalPages > 0 && (
                    <Pagination
                      currentPage={page}
                      totalPages={orgsData.totalPages}
                      onPageChange={setPage}
                      totalItems={orgsData.total}
                      itemsPerPage={PAGE_SIZE}
                      itemName="organizations"
                    />
                  )}
                </>
              )}
            </TabsContent>

            {/* Meetings Tab */}
            <TabsContent value="meetings" className="space-y-4">
              <div className="flex gap-4 items-center flex-wrap">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search meetings..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={filters.status}
                  onValueChange={(value) => {
                    setFilters({ ...filters, status: value });
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {meetingsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto overflow-y-auto scrollbar-hide" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                      <table className="min-w-[800px] w-full caption-bottom text-sm">
                        <thead className="sticky top-0 z-30 bg-background shadow-sm [&_tr]:border-b">
                          <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground sticky left-0 z-40 bg-background border-r">
                              Title
                            </th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Host</th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Scheduled</th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Duration</th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Participants</th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Status</th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground">Type</th>
                            <th className="h-10 px-2 text-left align-middle font-semibold text-foreground w-[50px]"></th>
                          </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                        {meetingsData?.meetings && meetingsData.meetings.length > 0 ? (
                          meetingsData.meetings.map((meeting: any) => (
                            <TableRow key={meeting.id}>
                              <TableCell className="font-medium sticky left-0 z-30 bg-background border-r">
                                {meeting.title}
                              </TableCell>
                              <TableCell className="text-sm">{meeting.hostEmail}</TableCell>
                              <TableCell className="text-sm">
                                {format(
                                  new Date(meeting.scheduledTime),
                                  'MMM d, yyyy HH:mm'
                                )}
                              </TableCell>
                              <TableCell className="text-sm">{meeting.duration} min</TableCell>
                              <TableCell className="text-sm">{meeting.participantsCount}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={getStatusBadgeVariant(meeting.status)}
                                >
                                  {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {meeting.isRecurring ? (
                                  <Badge variant="secondary">Recurring</Badge>
                                ) : (
                                  <Badge variant="outline">One-Time</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() =>
                                        handleDeleteMeeting(meeting.id)
                                      }
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={8}
                              className="text-center text-muted-foreground py-8"
                            >
                              <div className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                  <Search className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <p className="text-sm font-medium">No meetings found</p>
                                <p className="text-xs">
                                  {search || filters.status !== 'all' || filters.dateFrom || filters.dateTo
                                    ? 'Try adjusting your filters'
                                    : 'Meetings will appear here once scheduled'}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {meetingsData && meetingsData.totalPages > 0 && (
                    <Pagination
                      currentPage={page}
                      totalPages={meetingsData.totalPages}
                      onPageChange={setPage}
                      totalItems={meetingsData.total}
                      itemsPerPage={PAGE_SIZE}
                      itemName="meetings"
                    />
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </AdminLayout>
    </>
  );
}

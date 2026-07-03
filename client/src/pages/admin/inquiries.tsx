import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import {
  Building,
  Mail,
  Phone,
  Globe,
  Users,
  Calendar,
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  Briefcase,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import api from '@/lib/axios';
import { toast } from 'sonner';

interface Inquiry {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  companyName: string;
  companySize?: string;
  industry?: string;
  website?: string;
  country?: string;
  primaryUseCase?: string;
  expectedUsers?: string;
  timeline?: string;
  message?: string;
  isStartup: boolean;
  fundingStage?: string;
  source: string;
  status: string;
  priority: string;
  assignedTo?: string;
  notes: Array<{
    content: string;
    author: string;
    createdAt: string;
  }>;
  createdAt: string;
  lastContactedAt?: string;
}

interface Stats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  closed: number;
  startups: number;
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-blue-500' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { value: 'qualified', label: 'Qualified', color: 'bg-green-500' },
  { value: 'negotiating', label: 'Negotiating', color: 'bg-purple-500' },
  { value: 'closed', label: 'Closed Won', color: 'bg-emerald-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-500' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' },
];

export default function AdminInquiries() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [newNote, setNewNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Load inquiries
  const loadInquiries = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (searchQuery) params.search = searchQuery;
      if (statusFilter) params.status = statusFilter;

      const response = await api.get('/api/v1/admin/inquiries', { params });
      setInquiries(response.data.inquiries);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to load inquiries:', error);
      toast.error('Failed to load inquiries');
    } finally {
      setIsLoading(false);
    }
  };

  // Load stats
  const loadStats = async () => {
    try {
      const response = await api.get('/api/v1/admin/inquiries/stats');
      setStats(response.data.stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  useEffect(() => {
    loadInquiries();
    loadStats();
  }, [pagination.page, statusFilter]);

  useEffect(() => {
    // Check for inquiry ID in URL params
    const inquiryId = searchParams.get('id');
    if (inquiryId && inquiries.length > 0) {
      const inquiry = inquiries.find((i) => i._id === inquiryId);
      if (inquiry) {
        setSelectedInquiry(inquiry);
        setIsDetailModalOpen(true);
      }
    }
  }, [searchParams, inquiries]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    loadInquiries();
  };

  const handleStatusChange = async (inquiryId: string, newStatus: string) => {
    try {
      setIsSaving(true);
      await api.patch(`/api/v1/admin/inquiries/${inquiryId}`, {
        status: newStatus,
      });
      toast.success('Status updated');
      loadInquiries();
      loadStats();
      if (selectedInquiry?._id === inquiryId) {
        setSelectedInquiry((prev) =>
          prev ? { ...prev, status: newStatus } : null
        );
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePriorityChange = async (
    inquiryId: string,
    newPriority: string
  ) => {
    try {
      setIsSaving(true);
      await api.patch(`/api/v1/admin/inquiries/${inquiryId}`, {
        priority: newPriority,
      });
      toast.success('Priority updated');
      loadInquiries();
      if (selectedInquiry?._id === inquiryId) {
        setSelectedInquiry((prev) =>
          prev ? { ...prev, priority: newPriority } : null
        );
      }
    } catch (error) {
      console.error('Failed to update priority:', error);
      toast.error('Failed to update priority');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedInquiry || !newNote.trim()) return;

    try {
      setIsSaving(true);
      const response = await api.post(
        `/api/v1/admin/inquiries/${selectedInquiry._id}/notes`,
        { content: newNote.trim() }
      );
      setSelectedInquiry(response.data.inquiry);
      setNewNote('');
      toast.success('Note added');
    } catch (error) {
      console.error('Failed to add note:', error);
      toast.error('Failed to add note');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <Badge
        variant="outline"
        className={`${statusOption?.color} text-white border-0`}
      >
        {statusOption?.label || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityOption = PRIORITY_OPTIONS.find((p) => p.value === priority);
    return (
      <Badge variant="outline" className="text-xs">
        {priorityOption?.label || priority}
      </Badge>
    );
  };

  const formatIndustry = (industry?: string) => {
    const labels: Record<string, string> = {
      technology: 'Technology',
      healthcare: 'Healthcare',
      finance: 'Finance',
      education: 'Education',
      retail: 'Retail',
      manufacturing: 'Manufacturing',
      media: 'Media',
      consulting: 'Consulting',
      nonprofit: 'Non-profit',
      government: 'Government',
      startup: 'Startup',
      other: 'Other',
    };
    return labels[industry || ''] || industry || '-';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Enterprise Inquiries</h1>
            <p className="text-muted-foreground">
              Manage sales leads and enterprise inquiries
            </p>
          </div>
          <Button onClick={loadInquiries} variant="outline" disabled={isLoading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-500">
                  {stats.new}
                </div>
                <div className="text-sm text-muted-foreground">New</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-500">
                  {stats.contacted}
                </div>
                <div className="text-sm text-muted-foreground">Contacted</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-500">
                  {stats.qualified}
                </div>
                <div className="text-sm text-muted-foreground">Qualified</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-emerald-500">
                  {stats.closed}
                </div>
                <div className="text-sm text-muted-foreground">Closed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-500">
                  {stats.startups}
                </div>
                <div className="text-sm text-muted-foreground">Startups</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <form onSubmit={handleSearch} className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or company..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </form>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value === 'all' ? '' : value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Inquiries Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : inquiries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No inquiries found
                    </TableCell>
                  </TableRow>
                ) : (
                  inquiries.map((inquiry) => (
                    <TableRow key={inquiry._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {inquiry.companyName}
                              {inquiry.isStartup && (
                                <Badge
                                  variant="outline"
                                  className="bg-orange-100 text-orange-700 border-orange-200 text-xs"
                                >
                                  Startup
                                </Badge>
                              )}
                            </div>
                            {inquiry.companySize && (
                              <div className="text-xs text-muted-foreground">
                                {inquiry.companySize} employees
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{inquiry.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {inquiry.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatIndustry(inquiry.industry)}</TableCell>
                      <TableCell>{getStatusBadge(inquiry.status)}</TableCell>
                      <TableCell>{getPriorityBadge(inquiry.priority)}</TableCell>
                      <TableCell>
                        {format(new Date(inquiry.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedInquiry(inquiry);
                            setIsDetailModalOpen(true);
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} inquiries
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                }
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.totalPages}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                }
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              {selectedInquiry?.companyName}
              {selectedInquiry?.isStartup && (
                <Badge
                  variant="outline"
                  className="bg-orange-100 text-orange-700 border-orange-200"
                >
                  Startup
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Submitted on{' '}
              {selectedInquiry &&
                format(new Date(selectedInquiry.createdAt), 'MMMM d, yyyy')}
            </DialogDescription>
          </DialogHeader>

          {selectedInquiry && (
            <div className="space-y-6">
              {/* Status and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={selectedInquiry.status}
                    onValueChange={(value) =>
                      handleStatusChange(selectedInquiry._id, value)
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={selectedInquiry.priority}
                    onValueChange={(value) =>
                      handlePriorityChange(selectedInquiry._id, value)
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          {priority.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Contact Info */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Contact Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>{' '}
                    {selectedInquiry.name}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>{' '}
                    <a
                      href={`mailto:${selectedInquiry.email}`}
                      className="text-primary hover:underline"
                    >
                      {selectedInquiry.email}
                    </a>
                  </div>
                  {selectedInquiry.phone && (
                    <div>
                      <span className="text-muted-foreground">Phone:</span>{' '}
                      {selectedInquiry.phone}
                    </div>
                  )}
                  {selectedInquiry.jobTitle && (
                    <div>
                      <span className="text-muted-foreground">Job Title:</span>{' '}
                      {selectedInquiry.jobTitle}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Company Info */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Company Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Company:</span>{' '}
                    {selectedInquiry.companyName}
                  </div>
                  {selectedInquiry.companySize && (
                    <div>
                      <span className="text-muted-foreground">Size:</span>{' '}
                      {selectedInquiry.companySize}
                    </div>
                  )}
                  {selectedInquiry.industry && (
                    <div>
                      <span className="text-muted-foreground">Industry:</span>{' '}
                      {formatIndustry(selectedInquiry.industry)}
                    </div>
                  )}
                  {selectedInquiry.website && (
                    <div>
                      <span className="text-muted-foreground">Website:</span>{' '}
                      <a
                        href={selectedInquiry.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {selectedInquiry.website}
                      </a>
                    </div>
                  )}
                  {selectedInquiry.country && (
                    <div>
                      <span className="text-muted-foreground">Country:</span>{' '}
                      {selectedInquiry.country}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Requirements */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Requirements
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedInquiry.primaryUseCase && (
                    <div>
                      <span className="text-muted-foreground">Use Case:</span>{' '}
                      {selectedInquiry.primaryUseCase}
                    </div>
                  )}
                  {selectedInquiry.expectedUsers && (
                    <div>
                      <span className="text-muted-foreground">
                        Expected Users:
                      </span>{' '}
                      {selectedInquiry.expectedUsers}
                    </div>
                  )}
                  {selectedInquiry.timeline && (
                    <div>
                      <span className="text-muted-foreground">Timeline:</span>{' '}
                      {selectedInquiry.timeline}
                    </div>
                  )}
                </div>
                {selectedInquiry.message && (
                  <div className="mt-3 p-3 bg-muted rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedInquiry.message}
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Notes */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Notes
                </h4>
                <div className="space-y-2">
                  {selectedInquiry.notes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No notes yet
                    </p>
                  ) : (
                    selectedInquiry.notes.map((note, index) => (
                      <div
                        key={index}
                        className="p-3 bg-muted rounded-lg text-sm"
                      >
                        <p className="whitespace-pre-wrap">{note.content}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {note.author} -{' '}
                          {format(new Date(note.createdAt), 'MMM d, yyyy HH:mm')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={2}
                  />
                  <Button
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || isSaving}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}



import api from '@/lib/axios';
import { extractData } from '@/lib/api-response';

export interface OverviewMetrics {
  totalUsers: number;
  totalUsersGrowth: number;
  paidUsers: number;
  paidUsersPercentage: number;
  paidUsersGrowth: number;
  mrr: number;
  mrrGrowth: number;
  activeUsers: number;
  activeUsersPercentage: number;
  activeUsersGrowth: number;
  meetingsThisMonth: number;
  meetingsGrowth: number;
  meetingsPerDay: number;
  organizationsCount: number;
  organizationsGrowth: number;
  teamsCount: number;
  avgTeamsPerOrg: number;
  storageUsed: number;
  storageCapacity: number;
  meetingsCompletedToday: number;
  meetingsCompletedYesterday: number;
}

export interface UserGrowthData {
  date: string;
  count: number;
}

export interface PlanDistribution {
  free: number;
  pro: number;
  enterprise: number;
}

export interface UsersListResponse {
  users: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OrganizationsListResponse {
  organizations: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MeetingsListResponse {
  meetings: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class AdminService {
  static async getOverviewMetrics(): Promise<OverviewMetrics> {
    const response = await api.get('/api/admin/metrics');
    return extractData<OverviewMetrics>(response);
  }

  static async getUserGrowthData(
    period: '1d' | '7d' | '30d' | '90d' = '30d'
  ): Promise<UserGrowthData[]> {
    const response = await api.get('/api/admin/metrics/user-growth', {
      params: { period },
    });
    return extractData<UserGrowthData[]>(response);
  }

  static async getPlanDistribution(): Promise<PlanDistribution> {
    const response = await api.get('/api/admin/metrics/plan-distribution');
    return extractData<PlanDistribution>(response);
  }

  static async getUsersList(params: {
    page?: number;
    limit?: number;
    search?: string;
    plan?: string;
    status?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<UsersListResponse> {
    const response = await api.get('/api/admin/users', { params });
    return extractData<UsersListResponse>(response);
  }

  static async getOrganizationsList(params: {
    page?: number;
    limit?: number;
    search?: string;
    plan?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<OrganizationsListResponse> {
    const response = await api.get('/api/admin/organizations', { params });
    return extractData<OrganizationsListResponse>(response);
  }

  static async getMeetingsList(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<MeetingsListResponse> {
    const response = await api.get('/api/admin/meetings', { params });
    return extractData<MeetingsListResponse>(response);
  }

  static async getRevenueMetrics(): Promise<any> {
    const response = await api.get('/api/admin/revenue/metrics');
    return extractData<any>(response);
  }

  static async getRevenueChartData(
    type: 'overTime' | 'byPlan' = 'overTime',
    period: '6m' | '12m' = '12m'
  ): Promise<any[]> {
    const response = await api.get('/api/admin/revenue/chart', {
      params: { type, period },
    });
    return extractData<any[]>(response);
  }

  static async getSystemHealth(): Promise<any> {
    const response = await api.get('/api/admin/system/health');
    return extractData<any>(response);
  }

  static async updateUser(userId: string, data: any): Promise<any> {
    const response = await api.patch(`/api/admin/users/${userId}`, data);
    return extractData<any>(response);
  }

  static async deleteUser(userId: string): Promise<void> {
    await api.delete(`/api/admin/users/${userId}`);
  }

  static async suspendUser(userId: string): Promise<void> {
    await api.post(`/api/admin/users/${userId}/suspend`);
  }

  static async unsuspendUser(userId: string): Promise<void> {
    await api.post(`/api/admin/users/${userId}/unsuspend`);
  }

  static async deleteMeeting(meetingId: string): Promise<void> {
    await api.delete(`/api/admin/meetings/${meetingId}`);
  }
}

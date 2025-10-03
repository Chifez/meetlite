import api from '@/lib/axios';
import { env } from '@/config/env';

export interface UpdateOrganizationData {
  name?: string;
  description?: string;
  industry?: string;
  size?: string;
  settings?: Record<string, any>;
}

export interface DeleteOrganizationResponse {
  message: string;
  token: string;
}

export class OrganizationService {
  static async updateOrganization(
    orgId: string,
    data: UpdateOrganizationData
  ): Promise<any> {
    const response = await api.put(
      `${env.AUTH_API_URL}/organizations/${orgId}`,
      data
    );
    return response.data;
  }

  static async deleteOrganization(
    orgId: string
  ): Promise<DeleteOrganizationResponse> {
    const response = await api.delete(
      `${env.AUTH_API_URL}/organizations/${orgId}`
    );
    return response.data;
  }

  static async getOrganizationDetails(orgId: string): Promise<any> {
    const response = await api.get(
      `${env.AUTH_API_URL}/organizations/${orgId}`
    );
    return response.data;
  }
}

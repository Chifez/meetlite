import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { env } from '@/config/env';
import { Organization } from '@/types/organization';

interface WorkspaceContextType {
  // Current workspace state
  activeOrganization: Organization | null;
  organizations: Organization[];
  isPersonalMode: boolean;

  // Loading states
  loading: boolean;
  switchingOrg: boolean;

  // Actions
  switchToOrganization: (orgId: string) => Promise<void>;
  switchToPersonal: () => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  createOrganization: (data: {
    name: string;
    description?: string;
    industry?: string;
    size?: string;
  }) => Promise<Organization | null>;

  // Computed values
  currentWorkspaceName: string;
  currentWorkspaceRole: 'owner' | 'member' | null;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

interface WorkspaceProviderProps {
  children: ReactNode;
}

export const WorkspaceProvider = ({ children }: WorkspaceProviderProps) => {
  const { user, isAuthenticated, updateUser } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganization, setActiveOrganization] =
    useState<Organization | null>(null);
  const [loading, setLoading] = useState(false);
  const [switchingOrg, setSwitchingOrg] = useState(false);

  // Computed values
  const isPersonalMode = !activeOrganization;
  const currentWorkspaceName = activeOrganization?.name || 'Personal Account';
  const currentWorkspaceRole = activeOrganization
    ? (user?.organizationId === activeOrganization.id && user?.role) || null
    : null;

  // Load organizations when user authenticates
  useEffect(() => {
    if (isAuthenticated && user) {
      refreshOrganizations();
    } else {
      // Clear state when user logs out
      setOrganizations([]);
      setActiveOrganization(null);
    }
  }, [isAuthenticated, user?.id]);

  // Set active organization based on user's current organizationId
  useEffect(() => {
    if (user?.organizationId && organizations.length > 0) {
      const userOrg = organizations.find(
        (org) => org.id === user.organizationId
      );
      setActiveOrganization(userOrg || null);
    } else {
      setActiveOrganization(null);
    }
  }, [user?.organizationId, organizations]);

  const refreshOrganizations = async (): Promise<void> => {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      const response = await api.get(`${env.AUTH_API_URL}/organizations`);
      const orgs: Organization[] = response.data.organizations.map(
        (org: any) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          logo: org.logo,
          industry: org.industry,
          size: org.size,
          members: [], // Will be populated when needed
          email: '',
          website: '',
          phone: '',
          address: '',
          plan: org.plan,
          role: org.role,
          memberCount: org.memberCount,
          settings: org.settings,
          createdAt: org.createdAt,
        })
      );

      setOrganizations(orgs);
    } catch (error) {
      console.error('Failed to load organizations:', error);
      toast.error('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const switchToOrganization = async (orgId: string): Promise<void> => {
    if (switchingOrg) return;

    setSwitchingOrg(true);
    try {
      await api.post(`${env.AUTH_API_URL}/organizations/${orgId}/switch`);

      // Update user context
      updateUser({
        organizationId: orgId,
        role: organizations.find((org) => org.id === orgId)?.role || 'member',
      });

      toast.success('Workspace switched successfully');
    } catch (error: any) {
      console.error('Failed to switch organization:', error);
      toast.error(
        error.response?.data?.message || 'Failed to switch workspace'
      );
    } finally {
      setSwitchingOrg(false);
    }
  };

  const switchToPersonal = async (): Promise<void> => {
    if (switchingOrg || isPersonalMode) return;

    setSwitchingOrg(true);
    try {
      // For personal mode, we just update the local state
      // The backend will handle this as no organizationId
      updateUser({
        organizationId: null,
        role: 'owner', // Personal accounts are always "owner" role
      });

      setActiveOrganization(null);
      toast.success('Switched to personal workspace');
    } catch (error) {
      console.error('Failed to switch to personal:', error);
      toast.error('Failed to switch to personal workspace');
    } finally {
      setSwitchingOrg(false);
    }
  };

  const createOrganization = async (data: {
    name: string;
    description?: string;
    industry?: string;
    size?: string;
  }): Promise<Organization | null> => {
    try {
      const response = await api.post(
        `${env.AUTH_API_URL}/organizations`,
        data
      );
      const newOrg: Organization = {
        id: response.data.organization.id,
        name: response.data.organization.name,
        slug: response.data.organization.slug,
        logo: response.data.organization.logo || '',
        industry: response.data.organization.industry || '',
        size: response.data.organization.size || '',
        members: [],
        email: '',
        website: '',
        phone: '',
        address: '',
        plan: response.data.organization.plan,
        role: response.data.organization.role,
        memberCount: response.data.organization.memberCount,
        settings: response.data.organization.settings,
        createdAt: response.data.organization.createdAt,
      };

      // Add to organizations list
      setOrganizations((prev) => [newOrg, ...prev]);

      // Auto-switch to the new organization
      updateUser({
        organizationId: newOrg.id,
        role: 'owner',
      });

      toast.success(`Organization "${newOrg.name}" created successfully!`);
      return newOrg;
    } catch (error: any) {
      console.error('Failed to create organization:', error);
      toast.error(
        error.response?.data?.message || 'Failed to create organization'
      );
      return null;
    }
  };

  const contextValue: WorkspaceContextType = {
    // State
    activeOrganization,
    organizations,
    isPersonalMode,
    loading,
    switchingOrg,

    // Actions
    switchToOrganization,
    switchToPersonal,
    refreshOrganizations,
    createOrganization,

    // Computed values
    currentWorkspaceName,
    currentWorkspaceRole,
  };

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export default WorkspaceContext;

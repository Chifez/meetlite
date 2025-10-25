import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import api from '@/lib/axios';
// import { env } from '@/config/env';
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
  const { user, isAuthenticated, updateUser, handleNewToken } = useAuth();
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
      const response = await api.get('/api/organizations');
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
      const response = await api.post('/api/workspace/switch', {
        type: 'organization',
        organizationId: orgId,
      });

      // Handle new token - this should always be returned with the new endpoint
      if (response.data.token) {
        handleNewToken(response.data.token);
      } else {
        // This shouldn't happen with the new endpoint, but keeping for safety
        console.warn(
          'No token returned from workspace switch - using fallback'
        );
        updateUser({
          organizationId: orgId,
          role: organizations.find((org) => org.id === orgId)?.role || 'member',
        });
      }

      toast.success(response.data.message || 'Workspace switched successfully');
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
      const response = await api.post('/api/workspace/switch', {
        type: 'personal',
      });

      // Handle new token - this should always be returned with the new endpoint
      if (response.data.token) {
        handleNewToken(response.data.token);
      } else {
        // This shouldn't happen with the new endpoint, but keeping for safety
        console.warn(
          'No token returned from workspace switch - using fallback'
        );
        updateUser({
          organizationId: null,
          role: 'owner', // Personal accounts are always "owner" role
        });
        setActiveOrganization(null);
      }

      toast.success(response.data.message || 'Switched to personal workspace');
    } catch (error: any) {
      console.error('Failed to switch to personal:', error);
      toast.error(
        error.response?.data?.message ||
          'Failed to switch to personal workspace'
      );
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
      const response = await api.post(`/api/organizations`, data);
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

      // Handle new token if returned
      if (response.data.token) {
        handleNewToken(response.data.token);
      } else {
        // Fallback: Update user context manually (for backward compatibility)
        updateUser({
          organizationId: newOrg.id,
          role: 'owner',
        });
      }

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

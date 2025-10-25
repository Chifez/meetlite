import api from '@/lib/axios';

export interface OrganizationMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
  joinedAt: string;
  isOwner: boolean;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: 'owner' | 'member';
  invitedBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  expiresAt: string;
}

export interface OrganizationMembersResponse {
  organization: {
    id: string;
    name: string;
    memberCount: number;
    maxMembers: number;
  };
  members: OrganizationMember[];
  pendingInvitations: PendingInvitation[];
  userRole: 'owner' | 'member';
}

export interface InviteMemberRequest {
  organizationId: string;
  email: string;
  role: 'member' | 'owner';
  message?: string;
}

export interface InviteMemberResponse {
  message: string;
  invitation: {
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: string;
    createdAt: string;
  };
}

class MemberService {
  // Get organization members and pending invitations
  async getOrganizationMembers(
    organizationId: string
  ): Promise<OrganizationMembersResponse> {
    try {
      const response = await api.get(
        `/api/organizations/members/${organizationId}`
      );
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch organization members:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to fetch members'
      );
    }
  }

  // Invite a new member to organization
  async inviteMember(data: InviteMemberRequest): Promise<InviteMemberResponse> {
    try {
      const response = await api.post(
        `/api/organizations/members/invite`,
        data
      );
      return response.data;
    } catch (error: any) {
      console.error('Failed to invite member:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to send invitation'
      );
    }
  }

  // Remove a member from organization
  async removeMember(
    organizationId: string,
    memberId: string
  ): Promise<{
    message: string;
    removedMember: { id: string; name: string; email: string };
  }> {
    try {
      const response = await api.delete(
        `/api/organizations/members/${organizationId}/${memberId}`
      );
      return response.data;
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to remove member'
      );
    }
  }

  // Cancel a pending invitation
  async cancelInvitation(invitationId: string): Promise<{
    message: string;
    invitation: { id: string; email: string; status: string };
  }> {
    try {
      const response = await api.delete(
        `/api/organizations/members/invitations/${invitationId}`
      );
      return response.data;
    } catch (error: any) {
      console.error('Failed to cancel invitation:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to cancel invitation'
      );
    }
  }

  // Update member role
  async updateMemberRole(
    organizationId: string,
    memberId: string,
    newRole: 'owner' | 'member'
  ): Promise<{
    message: string;
    user: { id: string; name: string; email: string; role: string };
    token?: string;
  }> {
    try {
      const response = await api.put(`/api/multi-org/update-role`, {
        userId: memberId,
        organizationId,
        newRole,
      });
      return response.data;
    } catch (error: any) {
      console.error('Failed to update member role:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to update member role'
      );
    }
  }
}

export const memberService = new MemberService();

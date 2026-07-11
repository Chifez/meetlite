import { useState, useCallback } from 'react';
import {
  memberService,
  type OrganizationMembersResponse,
  type InviteMemberRequest,
} from '@/services/member-service';
import { useToast } from '@/hooks/use-toast';
import { extractError } from '@/lib/api-response';

export const useMembers = () => {
  const [members, setMembers] = useState<OrganizationMembersResponse | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch organization members
  const fetchMembers = useCallback(
    async (organizationId: string) => {
      if (!organizationId) return;

      setLoading(true);
      try {
        const data = await memberService.getOrganizationMembers(organizationId);
        console.log('[FRONTEND] useMembers received data:', {
          hasMembers: !!data.members,
          membersCount: data.members?.length,
          sampleMember: data.members?.[0],
        });
        setMembers(data);
      } catch (error: any) {
        console.error('[FRONTEND] Error fetching members:', error);
        toast({
          title: 'Error',
          description: extractError(error) || 'Failed to load members',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Invite a new member
  const inviteMember = useCallback(
    async (data: InviteMemberRequest) => {
      setInviting(true);
      try {
        const response = await memberService.inviteMember(data);

        // Update local state directly
        setMembers((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            pendingInvitations: [
              ...prev.pendingInvitations,
              {
                id: response.invitation.id,
                email: response.invitation.email,
                role: data.role as 'owner' | 'member',
                invitedBy: {
                  _id: '',
                  name: '',
                  email: '',
                },
                createdAt: response.invitation.createdAt,
                expiresAt: response.invitation.expiresAt,
              },
            ],
            organization: {
              ...prev.organization,
              memberCount: prev.organization.memberCount,
            },
          };
        });

        toast({
          title: 'Invitation sent!',
          description: `Invitation sent to ${data.email}`,
        });
        return true;
      } catch (error: any) {
        console.error('Error inviting member:', error);
        toast({
          title: 'Failed to send invitation',
          description: extractError(error) || 'Please try again',
          variant: 'destructive',
        });
        return false;
      } finally {
        setInviting(false);
      }
    },
    [toast]
  );

  // Remove a member
  const removeMember = useCallback(
    async (organizationId: string, memberId: string, memberName: string) => {
      setRemoving(memberId);
      try {
        await memberService.removeMember(organizationId, memberId);

        // Update local state directly
        setMembers((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            members: prev.members.filter((m) => m.id !== memberId),
            organization: {
              ...prev.organization,
              memberCount: prev.organization.memberCount - 1,
            },
          };
        });

        toast({
          title: 'Member removed',
          description: `${memberName} has been removed from the organization`,
        });
        return true;
      } catch (error: any) {
        console.error('Error removing member:', error);
        toast({
          title: 'Failed to remove member',
          description: extractError(error) || 'Please try again',
          variant: 'destructive',
        });
        return false;
      } finally {
        setRemoving(null);
      }
    },
    [toast]
  );

  // Cancel an invitation
  const cancelInvitation = useCallback(
    async (_organizationId: string, invitationId: string, email: string) => {
      // organizationId is kept for API consistency but not used in service call
      setCanceling(invitationId);
      try {
        await memberService.cancelInvitation(invitationId);

        // Update local state directly
        setMembers((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            pendingInvitations: prev.pendingInvitations.filter(
              (inv) => inv.id !== invitationId
            ),
          };
        });

        toast({
          title: 'Invitation canceled',
          description: `Invitation to ${email} has been canceled`,
        });
        return true;
      } catch (error: any) {
        console.error('Error canceling invitation:', error);
        toast({
          title: 'Failed to cancel invitation',
          description: extractError(error) || 'Please try again',
          variant: 'destructive',
        });
        return false;
      } finally {
        setCanceling(null);
      }
    },
    [toast]
  );

  // Update member role
  const updateMemberRole = useCallback(
    async (
      organizationId: string,
      memberId: string,
      newRole: 'owner' | 'member' | 'admin'
    ) => {
      setUpdatingRole(memberId);
      try {
        // organizationId is required by the service but we update local state directly
        await memberService.updateMemberRole(organizationId, memberId, newRole);

        // Update local state directly
        setMembers((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            members: prev.members.map((m) =>
              m.id === memberId ? { ...m, role: newRole } : m
            ),
          };
        });

        toast({
          title: 'Role updated',
          description: `Member role has been updated to ${newRole}`,
        });
        return true;
      } catch (error: any) {
        console.error('Error updating member role:', error);
        toast({
          title: 'Failed to update role',
          description: extractError(error) || 'Please try again',
          variant: 'destructive',
        });
        return false;
      } finally {
        setUpdatingRole(null);
      }
    },
    [toast]
  );

  // Update member's teams array (for team assignment)
  const updateMemberTeams = useCallback(
    (
      memberId: string,
      teamId: string,
      action: 'add' | 'remove',
      teamName: string
    ) => {
      setMembers((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: prev.members.map((m) => {
            if (m.id !== memberId) return m;

            const currentTeams = m.teams || [];
            if (action === 'add') {
              // Check if team already exists to avoid duplicates
              if (currentTeams.some((t) => t.teamId === teamId)) {
                return m;
              }
              return {
                ...m,
                teams: [
                  ...currentTeams,
                  { teamId, teamName, role: 'member' as const },
                ],
              };
            } else {
              // Remove team
              return {
                ...m,
                teams: currentTeams.filter((t) => t.teamId !== teamId),
              };
            }
          }),
        };
      });
    },
    []
  );

  return {
    members,
    loading,
    inviting,
    removing,
    canceling,
    updatingRole,
    fetchMembers,
    inviteMember,
    removeMember,
    cancelInvitation,
    updateMemberRole,
    updateMemberTeams,
  };
};

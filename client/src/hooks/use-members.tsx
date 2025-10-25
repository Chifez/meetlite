import { useState, useCallback } from 'react';
import {
  memberService,
  type OrganizationMembersResponse,
  type InviteMemberRequest,
} from '@/services/member-service';
import { useToast } from '@/hooks/use-toast';

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
        setMembers(data);
      } catch (error: any) {
        console.error('Error fetching members:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to load members',
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
        await memberService.inviteMember(data);
        toast({
          title: 'Invitation sent!',
          description: `Invitation sent to ${data.email}`,
        });

        // Refresh members list
        await fetchMembers(data.organizationId);
        return true;
      } catch (error: any) {
        console.error('Error inviting member:', error);
        toast({
          title: 'Failed to send invitation',
          description: error.message || 'Please try again',
          variant: 'destructive',
        });
        return false;
      } finally {
        setInviting(false);
      }
    },
    [fetchMembers, toast]
  );

  // Remove a member
  const removeMember = useCallback(
    async (organizationId: string, memberId: string, memberName: string) => {
      setRemoving(memberId);
      try {
        await memberService.removeMember(organizationId, memberId);
        toast({
          title: 'Member removed',
          description: `${memberName} has been removed from the organization`,
        });

        // Refresh members list
        await fetchMembers(organizationId);
        return true;
      } catch (error: any) {
        console.error('Error removing member:', error);
        toast({
          title: 'Failed to remove member',
          description: error.message || 'Please try again',
          variant: 'destructive',
        });
        return false;
      } finally {
        setRemoving(null);
      }
    },
    [fetchMembers, toast]
  );

  // Cancel an invitation
  const cancelInvitation = useCallback(
    async (organizationId: string, invitationId: string, email: string) => {
      setCanceling(invitationId);
      try {
        await memberService.cancelInvitation(invitationId);
        toast({
          title: 'Invitation canceled',
          description: `Invitation to ${email} has been canceled`,
        });

        // Refresh members list
        await fetchMembers(organizationId);
        return true;
      } catch (error: any) {
        console.error('Error canceling invitation:', error);
        toast({
          title: 'Failed to cancel invitation',
          description: error.message || 'Please try again',
          variant: 'destructive',
        });
        return false;
      } finally {
        setCanceling(null);
      }
    },
    [fetchMembers, toast]
  );

  // Update member role
  const updateMemberRole = useCallback(
    async (
      organizationId: string,
      memberId: string,
      newRole: 'owner' | 'member'
    ) => {
      setUpdatingRole(memberId);
      try {
        await memberService.updateMemberRole(organizationId, memberId, newRole);
        toast({
          title: 'Role updated',
          description: `Member role has been updated to ${newRole}`,
        });

        // Refresh members list
        await fetchMembers(organizationId);
        return true;
      } catch (error: any) {
        console.error('Error updating member role:', error);
        toast({
          title: 'Failed to update role',
          description: error.message || 'Please try again',
          variant: 'destructive',
        });
        return false;
      } finally {
        setUpdatingRole(null);
      }
    },
    [fetchMembers, toast]
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
  };
};

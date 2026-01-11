import { v4 as uuidv4 } from 'uuid';
import { models } from '../index.js';
import { OrganizationMemberService } from '../services/organization-member.service.js';
import { PlanValidationService, EmailQueue } from '@minimeet/shared';

export class OrganizationMemberController {
  constructor() {
    this.memberService = new OrganizationMemberService();
  }

  // POST /members/invite - Invite a member to organization
  async inviteMember(req, res) {
    try {
      const { organizationId, email, role = 'member', message = '' } = req.body;
      const userId = req.user._id;

      // Validation
      if (!organizationId || !email) {
        return res.status(400).json({
          message: 'Organization ID and email are required',
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }

      if (!['member', 'owner'].includes(role)) {
        return res
          .status(400)
          .json({ message: 'Invalid role. Must be member or owner' });
      }

      // Check if user is organization owner
      const organization = await this.memberService.checkOrganizationOwner(
        userId,
        organizationId
      );
      if (!organization) {
        return res.status(403).json({
          message: 'Only organization owners can invite members',
        });
      }

      // 1. Validate plan constraints for invitation sending
      const invitationValidation =
        await PlanValidationService.validateInvitationSending(userId, models);
      if (!invitationValidation.isValid) {
        return res.status(403).json({
          message: invitationValidation.message,
          upgradeRequired: invitationValidation.upgradeRequired,
          currentPlan: invitationValidation.currentPlan,
          currentUsage: invitationValidation.currentUsage,
          limit: invitationValidation.limit,
        });
      }

      // 2. Validate organization capacity based on owner's plan
      const capacityValidation =
        await PlanValidationService.validateOrganizationCapacity(
          organizationId,
          models
        );
      if (!capacityValidation.isValid) {
        return res.status(403).json({
          message: capacityValidation.message,
          upgradeRequired: capacityValidation.upgradeRequired,
          organizationPlan: capacityValidation.organizationPlan,
          currentMembers: capacityValidation.currentMembers,
          maxMembers: capacityValidation.maxMembers,
        });
      }

      // 3. Check if email is already a member
      const existingMember = await models.User.findOne({
        email: email.toLowerCase(),
        organizationId: organizationId,
      });

      if (existingMember) {
        return res.status(400).json({
          message: 'User is already a member of this organization',
        });
      }

      // 4. Check if there's already a pending invitation
      const existingInvitation =
        await models.OrganizationInvitation.findPendingInvitation(
          organizationId,
          email
        );

      if (existingInvitation) {
        return res.status(400).json({
          message: 'There is already a pending invitation for this email',
        });
      }

      // Create invitation
      const inviteToken = uuidv4();
      const invitation = new models.OrganizationInvitation({
        organizationId,
        invitedBy: userId,
        email: email.toLowerCase(),
        role,
        inviteToken,
        message: message.trim(),
      });

      await invitation.save();

      // Queue invitation email
      try {
        const emailQueue = new EmailQueue();
        await emailQueue.addEmailJob(
          'organization_invite',
          {
            userEmail: email.toLowerCase(),
            organizationName: organization.name,
            inviterName: req.user.name || req.user.email,
            inviterEmail: req.user.email,
            inviteToken,
            message: message.trim(),
            role,
          },
          {
            priority: 1,
            jobId: `org-invite-${invitation._id}`,
          }
        );
      } catch (emailError) {
        // If email fails, remove the invitation
        await models.OrganizationInvitation.findByIdAndDelete(invitation._id);
        console.error('Failed to queue invitation email:', emailError);
        return res.status(500).json({
          message: 'Failed to send invitation email',
        });
      }

      // 5. Update user's invitation usage after successful email send
      await PlanValidationService.updateInvitationUsage(userId, models);

      res.status(201).json({
        message: 'Invitation sent successfully',
        invitation: {
          id: invitation._id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
        },
      });
    } catch (error) {
      console.error('Invite member error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // GET /members/:organizationId - List organization members and pending invitations
  async listMembers(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user._id;

      // Check if user has access to this organization
      const organization = await models.Organization.findOne({
        _id: organizationId,
        status: 'active',
      });

      if (!organization) {
        return res.status(404).json({ message: 'Organization not found' });
      }

      // Check if user is member or owner of this organization
      // First check if user is the organization owner
      const isOwner = organization.ownerId.toString() === userId.toString();

      // Also check memberships array (for multi-org support)
      const userMembership = req.user.memberships?.find(
        (m) =>
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      // Also check if user has organizationId set (legacy/active org)
      const hasActiveOrg =
        req.user.organizationId?.toString() === organizationId.toString();

      console.log('[BACKEND] listMembers access check:', {
        userId: userId.toString(),
        organizationId: organizationId.toString(),
        isOwner,
        hasActiveOrg,
        hasMembership: !!userMembership,
        userMembershipRole: userMembership?.role,
        userOrganizationId: req.user.organizationId?.toString(),
        membershipsCount: req.user.memberships?.length || 0,
      });

      // Grant access if user is owner, has membership, or has active org
      if (!isOwner && !userMembership && !hasActiveOrg) {
        console.log('[BACKEND] Access denied for user:', {
          userId: userId.toString(),
          organizationId: organizationId.toString(),
          reason: 'Not owner, no membership, no active org',
        });
        return res.status(403).json({
          message: 'Access denied. You are not a member of this organization',
        });
      }

      // Determine user role for response
      const userRole = isOwner
        ? 'owner'
        : userMembership?.role
        ? userMembership.role
        : req.user.role || 'member';

      // Get members using correct memberships array query
      // Include both users with active memberships AND the organization owner
      const members = await models.User.find({
        $or: [
          {
            'memberships.organizationId': organizationId,
            'memberships.status': 'active',
          },
          {
            _id: organization.ownerId, // Include the owner even if no membership entry
          },
        ],
      })
        .select('name email memberships teamMemberships')
        .sort({ name: 1 });

      // Get all teams for this organization to map team IDs to team names
      const teams = await models.Team.find({
        organizationId,
        status: { $ne: 'deleted' },
      }).select('_id name');

      const teamMap = new Map(
        teams.map((team) => [team._id.toString(), team.name])
      );

      // Format members with teams data
      const formattedMembers = members
        .map((member) => {
          const isOwner =
            member._id.toString() === organization.ownerId.toString();

          // Find membership entry, or create a virtual one for the owner
          const membership =
            member.memberships?.find(
              (m) => m.organizationId.toString() === organizationId.toString()
            ) ||
            (isOwner
              ? {
                  role: 'owner',
                  joinedAt: organization.createdAt || new Date(),
                }
              : null);

          // If no membership found and not owner, skip this member (shouldn't happen with $or query)
          if (!membership && !isOwner) {
            console.warn('[BACKEND] Member without membership entry:', {
              memberId: member._id.toString(),
              organizationId: organizationId.toString(),
            });
            return null;
          }

          // Get active team memberships for this organization
          const userTeams =
            member.teamMemberships
              ?.filter(
                (tm) =>
                  tm.organizationId.toString() === organizationId.toString() &&
                  tm.status === 'active'
              )
              .map((tm) => ({
                teamId: tm.teamId.toString(),
                teamName: teamMap.get(tm.teamId.toString()) || 'Unknown Team',
                role: tm.role,
              })) || [];

          return {
            id: member._id,
            name: member.name,
            email: member.email,
            role: membership?.role || 'owner',
            joinedAt:
              membership?.joinedAt || organization.createdAt || new Date(),
            isOwner: isOwner,
            teams: userTeams,
          };
        })
        .filter(Boolean); // Remove any null entries

      // Get pending invitations (only for owners/admins)
      let pendingInvitations = [];
      if (isOwner || userMembership.role === 'admin') {
        pendingInvitations = await models.OrganizationInvitation.find({
          organizationId: organizationId,
          status: 'pending',
          expiresAt: { $gt: new Date() },
        })
          .populate('invitedBy', 'name email')
          .sort({ createdAt: -1 });
      }

      // Get member count from organization stats or calculate from members
      const memberCount =
        organization.stats?.totalMembers || formattedMembers.length;

      console.log('[BACKEND] listMembers response:', {
        membersCount: formattedMembers.length,
        firstMemberHasTeams: formattedMembers[0]?.teams?.length > 0,
        firstMemberTeams: formattedMembers[0]?.teams,
      });

      res.json({
        organization: {
          id: organization._id,
          name: organization.name,
          memberCount,
          maxMembers: organization.limits?.maxMembers || 100,
        },
        members: formattedMembers,
        pendingInvitations: pendingInvitations.map((inv) => ({
          id: inv._id,
          email: inv.email,
          role: inv.role,
          invitedBy: inv.invitedBy,
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt,
        })),
        userRole: userRole,
      });
    } catch (error) {
      console.error('List members error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // DELETE /members/:organizationId/:memberId - Remove member from organization
  async removeMember(req, res) {
    try {
      const { organizationId, memberId } = req.params;
      const userId = req.user._id;

      // Check if user is organization owner
      const organization = await this.memberService.checkOrganizationOwner(
        userId,
        organizationId
      );
      if (!organization) {
        return res.status(403).json({
          message: 'Only organization owners can remove members',
        });
      }

      // Prevent owner from removing themselves
      if (memberId === userId.toString()) {
        return res.status(400).json({
          message: 'Organization owners cannot remove themselves',
        });
      }

      // Find and remove member
      const member = await models.User.findOne({
        _id: memberId,
        organizationId: organizationId,
      });

      if (!member) {
        return res.status(404).json({
          message: 'Member not found in this organization',
        });
      }

      // Remove user from organization
      await models.User.findByIdAndUpdate(memberId, {
        $unset: { organizationId: 1 },
        role: 'owner', // Reset to default role
      });

      // Update organization member count
      await models.Organization.findByIdAndUpdate(organizationId, {
        $inc: { 'stats.totalMembers': -1 },
      });

      res.json({
        message: 'Member removed successfully',
        removedMember: {
          id: member._id,
          name: member.name,
          email: member.email,
        },
      });
    } catch (error) {
      console.error('Remove member error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // DELETE /invitations/:invitationId - Cancel pending invitation
  async cancelInvitation(req, res) {
    try {
      const { invitationId } = req.params;
      const userId = req.user._id;

      // Find invitation
      const invitation = await models.OrganizationInvitation.findById(
        invitationId
      ).populate('organizationId');

      if (!invitation) {
        return res.status(404).json({ message: 'Invitation not found' });
      }

      // Check if user is organization owner
      const isOwner =
        invitation.organizationId.ownerId.toString() === userId.toString();
      if (!isOwner) {
        return res.status(403).json({
          message: 'Only organization owners can cancel invitations',
        });
      }

      // Only allow canceling pending invitations
      if (invitation.status !== 'pending') {
        return res.status(400).json({
          message: 'Only pending invitations can be canceled',
        });
      }

      // Cancel invitation
      invitation.status = 'expired';
      await invitation.save();

      res.json({
        message: 'Invitation canceled successfully',
        invitation: {
          id: invitation._id,
          email: invitation.email,
          status: invitation.status,
        },
      });
    } catch (error) {
      console.error('Cancel invitation error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

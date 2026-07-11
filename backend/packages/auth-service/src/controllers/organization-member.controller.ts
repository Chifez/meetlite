import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@minimeet/shared';
// @ts-ignore
import { OrganizationMemberService } from '../services/organization-member.service.js';
import { PlanValidationService, EmailQueue } from '@minimeet/shared';
import { WORKSPACE_ROLES } from '@minimeet/shared';


export class OrganizationMemberController {
  private memberService: OrganizationMemberService;

  constructor() {
    this.memberService = new OrganizationMemberService();
  }

  // POST /members/invite - Invite a member to organization
  async inviteMember(req: any, res: Response) {
    try {
      const { organizationId, email, role = 'member', message = '' } = req.body;
      const userId = req.user._id;

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
        await PlanValidationService.validateInvitationSending(userId, prisma);
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
          prisma
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
      const existingMember = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          organizationId: organizationId,
        }
      });

      if (existingMember) {
        return res.status(400).json({
          message: 'User is already a member of this organization',
        });
      }

      // 4. Check if there's already a pending invitation
      const existingInvitation = await prisma.organizationInvitation.findFirst({
        where: {
          organizationId: organizationId,
          email: email.toLowerCase(),
          status: 'pending',
          expiresAt: { gt: new Date() }
        }
      });

      if (existingInvitation) {
        return res.status(400).json({
          message: 'There is already a pending invitation for this email',
        });
      }

      // Create invitation
      const inviteToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Default 7 days expiry
      
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId,
          invitedBy: userId,
          email: email.toLowerCase(),
          role,
          inviteToken,
          message: message.trim(),
          expiresAt,
        }
      });

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
            jobId: `org-invite-${invitation.id}`,
          }
        );
      } catch (emailError) {
        // If email fails, remove the invitation
        await prisma.organizationInvitation.delete({ where: { id: invitation.id } });
        console.error('Failed to queue invitation email:', emailError);
        return res.status(500).json({
          message: 'Failed to send invitation email',
        });
      }

      // 5. Update user's invitation usage after successful email send
      await PlanValidationService.updateInvitationUsage(userId, prisma);

      // Log Activity
      try {
        await (prisma as any).activity.create({
          data: {
            action: 'MEMBER_INVITED',
            userId: userId,
            organizationId: organizationId,
            metadata: {
              email: email.toLowerCase(),
              role,
            }
          }
        });
      } catch (err) {
        console.error('[Activity] Failed to log MEMBER_INVITED', err);
      }

      res.status(201).json({
        message: 'Invitation sent successfully',
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          createdAt: new Date(invitation.expiresAt.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      console.error('Invite member error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // GET /members/:organizationId - List organization members and pending invitations
  async listMembers(req: any, res: Response) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id || req.user._id;

      const organization = await prisma.organization.findFirst({
        where: {
          id: organizationId,
          status: 'active',
        }
      });

      if (!organization) {
        return res.status(404).json({ message: 'Organization not found' });
      }

      const isOwner = organization.ownerId === userId;

      const userMembership = req.user.memberships?.find(
        (m: any) =>
          m.organizationId === organizationId &&
          m.status === 'active'
      );

      const hasActiveOrg = req.user.organizationId === organizationId;

      if (!isOwner && !userMembership && !hasActiveOrg) {
        return res.status(403).json({
          message: 'Access denied. You are not a member of this organization',
        });
      }

      const userRole = isOwner
        ? 'owner'
        : userMembership?.role
        ? userMembership.role
        : req.user.role || 'member';

      const members = await prisma.user.findMany({
        where: {
          OR: [
            {
              memberships: {
                some: {
                  organizationId,
                  status: 'active'
                }
              }
            },
            {
              id: organization.ownerId
            }
          ]
        },
        select: {
          id: true,
          name: true,
          email: true,
          memberships: true,
          teamMemberships: true
        },
        orderBy: { name: 'asc' }
      });

      const teams = await prisma.team.findMany({
        where: {
          organizationId,
          status: { not: 'deleted' }
        },
        select: {
          id: true,
          name: true
        }
      });

      const teamMap = new Map(
        teams.map((team: any) => [team.id, team.name])
      );

      const formattedMembers = members
        .map((member: any) => {
          const isMemberOwner = member.id === organization.ownerId;

          const membership =
            member.memberships?.find(
              (m: any) => m.organizationId === organizationId
            ) ||
            (isMemberOwner
              ? {
                  role: 'owner',
                  joinedAt: organization.createdAt || new Date(),
                }
              : null);

          if (!membership && !isMemberOwner) {
            return null;
          }

          const userTeams =
            member.teamMemberships
              ?.filter(
                (tm: any) =>
                  tm.organizationId === organizationId &&
                  tm.status === 'active'
              )
              .map((tm: any) => ({
                teamId: tm.teamId,
                teamName: teamMap.get(tm.teamId) || 'Unknown Team',
                role: tm.role,
              })) || [];

          return {
            id: member.id,
            name: member.name,
            email: member.email,
            role: membership?.role || 'owner',
            joinedAt:
              membership?.joinedAt || organization.createdAt || new Date(),
            isOwner: isMemberOwner,
            teams: userTeams,
          };
        })
        .filter(Boolean);

      let pendingInvitations: any[] = [];
      if (isOwner || (userMembership && userMembership.role === WORKSPACE_ROLES.ADMIN)) {
        pendingInvitations = await prisma.organizationInvitation.findMany({
            where: {
              organizationId,
              status: 'pending',
              expiresAt: { gt: new Date() }
            },
            include: {
              inviter: {
                select: { name: true, email: true }
              }
            },
            orderBy: { expiresAt: 'desc' }
          });
      }

      const memberCount =
        organization.statsTotalMembers || formattedMembers.length;

      res.json({
        organization: {
          id: organization.id,
          name: organization.name,
          memberCount,
          maxMembers: organization.limitMaxMembers || 100,
        },
        members: formattedMembers,
        pendingInvitations: pendingInvitations.map((inv: any) => ({
          id: inv.id,
          _id: inv.id,
          email: inv.email,
          role: inv.role,
          invitedBy: inv.inviter ? { _id: inv.invitedBy, name: inv.inviter.name, email: inv.inviter.email } : inv.invitedBy,
          createdAt: new Date(inv.expiresAt.getTime() - 7 * 24 * 60 * 60 * 1000),
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
  async removeMember(req: any, res: Response) {
    try {
      const { organizationId, memberId } = req.params;
      const userId = req.user._id;

      const organization = await this.memberService.checkOrganizationOwner(
        userId,
        organizationId
      );
      if (!organization) {
        return res.status(403).json({
          message: 'Only organization owners can remove members',
        });
      }

      if (memberId === userId) {
        return res.status(400).json({
          message: 'Organization owners cannot remove themselves',
        });
      }

      const member = await prisma.user.findFirst({
        where: {
          id: memberId,
          organizationId: organizationId,
        }
      });

      if (!member) {
        return res.status(404).json({
          message: 'Member not found in this organization',
        });
      }

      await prisma.user.update({
        where: { id: memberId },
        data: {
          organizationId: null,
          role: 'owner',
        }
      });

      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          statsTotalMembers: { decrement: 1 }
        }
      });

      res.json({
        message: 'Member removed successfully',
        removedMember: {
          id: member.id,
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
  async cancelInvitation(req: any, res: Response) {
    try {
      const { invitationId } = req.params;
      const userId = req.user.id || req.user._id;

      const invitation = await prisma.organizationInvitation.findUnique({
        where: { id: invitationId },
        include: { organization: true }
      });

      if (!invitation || !invitation.organization) {
        return res.status(404).json({ message: 'Invitation not found' });
      }

      const isOwner = invitation.organization.ownerId === userId;
      if (!isOwner) {
        return res.status(403).json({
          message: 'Only organization owners can cancel invitations',
        });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({
          message: 'Only pending invitations can be canceled',
        });
      }

      await prisma.organizationInvitation.update({
        where: { id: invitationId },
        data: { status: 'expired' }
      });

      res.json({
        message: 'Invitation canceled successfully',
        invitation: {
          id: invitation.id,
          email: invitation.email,
          status: 'expired',
        },
      });
    } catch (error) {
      console.error('Cancel invitation error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

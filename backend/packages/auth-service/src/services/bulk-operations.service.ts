import { v4 as uuidv4 } from 'uuid';
import { models } from '../index.js';
import { PlanValidationService } from '@minimeet/shared';
// @ts-ignore
import { MultiOrganizationService } from './multi-organization.service.js';
import { sendOrganizationInviteEmail } from './email-service.js';

export class BulkOperationsService {
  /**
   * Bulk invite members to organization
   */
  static async bulkInviteMembers(organizationId: any, inviterId: any, invitations: any[]) {
    try {
      const results: any = {
        successful: [],
        failed: [],
        skipped: [],
      };

      const organization = await models.Organization.findById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      const inviter = await models.User.findById(inviterId);
      if (!inviter) {
        throw new Error('Inviter not found');
      }

      const inviterMembership = inviter.memberships?.find(
        (m: any) =>
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      if (
        !inviterMembership ||
        (inviterMembership.role !== 'owner' &&
          inviterMembership.role !== 'admin')
      ) {
        throw new Error(
          'Only organization owners and admins can invite members'
        );
      }

      const invitationValidation =
        await PlanValidationService.validateInvitationSending(
          inviterId,
          models
        );
      if (!invitationValidation.isValid) {
        throw new Error(invitationValidation.message);
      }

      const capacityValidation =
        await PlanValidationService.validateOrganizationCapacity(
          organizationId,
          models
        );
      if (!capacityValidation.isValid) {
        throw new Error(capacityValidation.message);
      }

      for (const invitation of invitations) {
        try {
          const { email, role = 'member', message = '' } = invitation;

          if (!email || !email.includes('@')) {
            results.failed.push({
              email,
              error: 'Invalid email format',
            });
            continue;
          }

          const existingMember = await models.User.findOne({
            email: email.toLowerCase(),
            'memberships.organizationId': organizationId,
            'memberships.status': 'active',
          });

          if (existingMember) {
            results.skipped.push({
              email,
              reason: 'User is already a member',
            });
            continue;
          }

          const existingInvitation =
            await models.OrganizationInvitation.findPendingInvitation(
              organizationId,
              email
            );

          if (existingInvitation) {
            results.skipped.push({
              email,
              reason: 'Invitation already pending',
            });
            continue;
          }

          const inviteToken = uuidv4();
          const newInvitation = new models.OrganizationInvitation({
            organizationId,
            invitedBy: inviterId,
            email: email.toLowerCase(),
            role,
            inviteToken,
            message: message.trim(),
          });

          await newInvitation.save();

          try {
            await sendOrganizationInviteEmail({
              email,
              organizationName: organization.name,
              inviteToken,
              message,
              inviterName: inviter.name,
              inviterEmail: inviter.email,
              role,
            });
          } catch (emailError) {
            console.error('Email sending error:', emailError);
          }

          results.successful.push({
            email,
            role,
            inviteToken: newInvitation.inviteToken,
          });
        } catch (error: any) {
          console.error(`Error inviting ${invitation.email}:`, error);
          results.failed.push({
            email: invitation.email,
            error: error.message,
          });
        }
      }

      if (results.successful.length > 0) {
        for (let i = 0; i < results.successful.length; i++) {
          await PlanValidationService.updateInvitationUsage(inviterId, models);
        }
      }

      return results;
    } catch (error) {
      console.error('Bulk invite error:', error);
      throw error;
    }
  }

  /**
   * Bulk remove members from organization
   */
  static async bulkRemoveMembers(organizationId: any, removerId: any, memberIds: string[]) {
    try {
      const results: any = {
        successful: [],
        failed: [],
      };

      const organization = await models.Organization.findById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      const remover = await models.User.findById(removerId);
      if (!remover) {
        throw new Error('Remover not found');
      }

      const removerMembership = remover.memberships?.find(
        (m: any) =>
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      if (
        !removerMembership ||
        (removerMembership.role !== 'owner' &&
          removerMembership.role !== 'admin')
      ) {
        throw new Error(
          'Only organization owners and admins can remove members'
        );
      }

      for (const memberId of memberIds) {
        try {
          if (memberId === removerId.toString()) {
            results.failed.push({
              memberId,
              error: 'Cannot remove yourself',
            });
            continue;
          }

          const member = await models.User.findById(memberId);
          if (!member) {
            results.failed.push({
              memberId,
              error: 'Member not found',
            });
            continue;
          }

          const membership = member.memberships.find(
            (m: any) =>
              m.organizationId.toString() === organizationId.toString() &&
              m.status === 'active'
          );

          if (!membership) {
            results.failed.push({
              memberId,
              error: 'Member is not in this organization',
            });
            continue;
          }

          await MultiOrganizationService.removeUserFromOrganization(
            memberId,
            organizationId
          );

          await models.Organization.findByIdAndUpdate(organizationId, {
            $inc: { 'stats.totalMembers': -1 },
          });

          results.successful.push({
            memberId,
            memberName: member.name,
            memberEmail: member.email,
          });
        } catch (error: any) {
          console.error(`Error removing member ${memberId}:`, error);
          results.failed.push({
            memberId,
            error: error.message,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Bulk remove error:', error);
      throw error;
    }
  }

  /**
   * Bulk update member roles
   */
  static async bulkUpdateRoles(organizationId: any, updaterId: any, roleUpdates: any[]) {
    try {
      const results: any = {
        successful: [],
        failed: [],
      };

      const organization = await models.Organization.findById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      const updater = await models.User.findById(updaterId);
      if (!updater) {
        throw new Error('Updater not found');
      }

      const updaterMembership = updater.memberships?.find(
        (m: any) =>
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      if (
        !updaterMembership ||
        (updaterMembership.role !== 'owner' &&
          updaterMembership.role !== 'admin')
      ) {
        throw new Error(
          'Only organization owners and admins can update member roles'
        );
      }

      for (const update of roleUpdates) {
        try {
          const { memberId, newRole } = update;

          if (!['owner', 'admin', 'member'].includes(newRole)) {
            results.failed.push({
              memberId,
              error: 'Invalid role. Must be "owner", "admin", or "member"',
            });
            continue;
          }

          if (memberId === updaterId.toString()) {
            results.failed.push({
              memberId,
              error: 'Cannot change your own role',
            });
            continue;
          }

          const member = await models.User.findById(memberId);
          if (!member) {
            results.failed.push({
              memberId,
              error: 'Member not found',
            });
            continue;
          }

          const membership = member.memberships.find(
            (m: any) =>
              m.organizationId.toString() === organizationId.toString() &&
              m.status === 'active'
          );

          if (!membership) {
            results.failed.push({
              memberId,
              error: 'Member is not in this organization',
            });
            continue;
          }

          await MultiOrganizationService.updateUserRole(
            memberId,
            organizationId,
            newRole
          );

          results.successful.push({
            memberId,
            memberName: member.name,
            memberEmail: member.email,
            newRole,
          });
        } catch (error: any) {
          console.error(
            `Error updating role for member ${update.memberId}:`,
            error
          );
          results.failed.push({
            memberId: update.memberId,
            error: error.message,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Bulk update roles error:', error);
      throw error;
    }
  }

  /**
   * Get organization members with pagination
   */
  static async getOrganizationMembers(
    organizationId: any,
    page = 1,
    limit = 20,
    search = ''
  ) {
    try {
      const skip = (page - 1) * limit;

      const searchQuery = search
        ? {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } },
            ],
          }
        : {};

      const members = await models.User.find({
        'memberships.organizationId': organizationId,
        'memberships.status': 'active',
        ...searchQuery,
      })
        .select('name email memberships teamMemberships')
        .skip(skip)
        .limit(limit)
        .sort({ name: 1 });

      const totalCount = await models.User.countDocuments({
        'memberships.organizationId': organizationId,
        'memberships.status': 'active',
        ...searchQuery,
      });

      const formattedMembers = members.map((member: any) => {
        const membership = member.memberships.find(
          (m: any) => m.organizationId.toString() === organizationId.toString()
        );

        const formatted = {
          id: member._id,
          name: member.name,
          email: member.email,
          role: membership.role,
          joinedAt: membership.joinedAt,
        };

        console.log('[BACKEND SERVICE] Formatted member:', {
          id: formatted.id,
          name: formatted.name,
          hasTeamMemberships: !!member.teamMemberships,
          teamMembershipsCount: member.teamMemberships?.length || 0,
        });

        return formatted;
      });

      console.log('[BACKEND SERVICE] Returning members:', {
        count: formattedMembers.length,
        firstMemberKeys: formattedMembers[0]
          ? Object.keys(formattedMembers[0])
          : [],
      });

      return {
        members: formattedMembers,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page < Math.ceil(totalCount / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Get organization members error:', error);
      throw error;
    }
  }
}

import { v4 as uuidv4 } from 'uuid';
import { models } from '../index.js';
import { PlanValidationService } from './plan-validation.service.js';
import { MultiOrganizationService } from './multi-organization.service.js';
import { sendOrganizationInviteEmail } from './email-service.js';

export class BulkOperationsService {
  /**
   * Bulk invite members to organization
   */
  static async bulkInviteMembers(organizationId, inviterId, invitations) {
    try {
      const results = {
        successful: [],
        failed: [],
        skipped: [],
      };

      // Validate organization exists and user has permission
      const organization = await models.Organization.findById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      if (organization.ownerId.toString() !== inviterId.toString()) {
        throw new Error('Only organization owners can invite members');
      }

      // Check inviter's plan limits
      const invitationValidation =
        await PlanValidationService.validateInvitationSending(inviterId);
      if (!invitationValidation.isValid) {
        throw new Error(invitationValidation.message);
      }

      // Check organization capacity
      const capacityValidation =
        await PlanValidationService.validateOrganizationCapacity(
          organizationId
        );
      if (!capacityValidation.isValid) {
        throw new Error(capacityValidation.message);
      }

      for (const invitation of invitations) {
        try {
          const { email, role = 'member', message = '' } = invitation;

          // Validate email format
          if (!email || !email.includes('@')) {
            results.failed.push({
              email,
              error: 'Invalid email format',
            });
            continue;
          }

          // Check if user is already a member
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

          // Check if there's already a pending invitation
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

          // Create invitation
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

          // Send invitation email
          try {
            await sendOrganizationInviteEmail(
              email,
              organization.name,
              inviteToken,
              message
            );
          } catch (emailError) {
            console.error('Email sending error:', emailError);
            // Don't fail the invitation if email fails
          }

          results.successful.push({
            email,
            role,
            inviteToken: newInvitation.inviteToken,
          });
        } catch (error) {
          console.error(`Error inviting ${invitation.email}:`, error);
          results.failed.push({
            email: invitation.email,
            error: error.message,
          });
        }
      }

      // Update inviter's invitation usage
      if (results.successful.length > 0) {
        await PlanValidationService.updateInvitationUsage(
          inviterId,
          results.successful.length
        );
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
  static async bulkRemoveMembers(organizationId, removerId, memberIds) {
    try {
      const results = {
        successful: [],
        failed: [],
      };

      // Validate organization exists and user has permission
      const organization = await models.Organization.findById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      if (organization.ownerId.toString() !== removerId.toString()) {
        throw new Error('Only organization owners can remove members');
      }

      for (const memberId of memberIds) {
        try {
          // Prevent owner from removing themselves
          if (memberId === removerId.toString()) {
            results.failed.push({
              memberId,
              error: 'Cannot remove yourself',
            });
            continue;
          }

          // Find member
          const member = await models.User.findById(memberId);
          if (!member) {
            results.failed.push({
              memberId,
              error: 'Member not found',
            });
            continue;
          }

          // Check if member is actually in this organization
          const membership = member.memberships.find(
            (m) =>
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

          // Remove member
          await MultiOrganizationService.removeUserFromOrganization(
            memberId,
            organizationId
          );

          // Update organization member count
          await models.Organization.findByIdAndUpdate(organizationId, {
            $inc: { 'stats.totalMembers': -1 },
          });

          results.successful.push({
            memberId,
            memberName: member.name,
            memberEmail: member.email,
          });
        } catch (error) {
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
  static async bulkUpdateRoles(organizationId, updaterId, roleUpdates) {
    try {
      const results = {
        successful: [],
        failed: [],
      };

      // Validate organization exists and user has permission
      const organization = await models.Organization.findById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      if (organization.ownerId.toString() !== updaterId.toString()) {
        throw new Error('Only organization owners can update member roles');
      }

      for (const update of roleUpdates) {
        try {
          const { memberId, newRole } = update;

          // Validate role
          if (!['owner', 'member'].includes(newRole)) {
            results.failed.push({
              memberId,
              error: 'Invalid role. Must be "owner" or "member"',
            });
            continue;
          }

          // Prevent owner from changing their own role
          if (memberId === updaterId.toString()) {
            results.failed.push({
              memberId,
              error: 'Cannot change your own role',
            });
            continue;
          }

          // Find member
          const member = await models.User.findById(memberId);
          if (!member) {
            results.failed.push({
              memberId,
              error: 'Member not found',
            });
            continue;
          }

          // Check if member is actually in this organization
          const membership = member.memberships.find(
            (m) =>
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

          // Update role
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
        } catch (error) {
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
    organizationId,
    page = 1,
    limit = 20,
    search = ''
  ) {
    try {
      const skip = (page - 1) * limit;

      // Build search query
      const searchQuery = search
        ? {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } },
            ],
          }
        : {};

      // Find users who are members of this organization
      const members = await models.User.find({
        'memberships.organizationId': organizationId,
        'memberships.status': 'active',
        ...searchQuery,
      })
        .select('name email memberships')
        .skip(skip)
        .limit(limit)
        .sort({ name: 1 });

      // Get total count
      const totalCount = await models.User.countDocuments({
        'memberships.organizationId': organizationId,
        'memberships.status': 'active',
        ...searchQuery,
      });

      // Format members data
      const formattedMembers = members.map((member) => {
        const membership = member.memberships.find(
          (m) => m.organizationId.toString() === organizationId.toString()
        );

        return {
          id: member._id,
          name: member.name,
          email: member.email,
          role: membership.role,
          joinedAt: membership.joinedAt,
        };
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

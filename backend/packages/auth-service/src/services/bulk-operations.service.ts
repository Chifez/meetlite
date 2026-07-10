import { v4 as uuidv4 } from 'uuid';
import { PlanValidationService, prisma } from '@minimeet/shared';
import { MultiOrganizationService } from './multi-organization.service.js';
import { sendOrganizationInviteEmail } from './email-service.js';

export class BulkOperationsService {
  /**
   * Bulk invite members to organization
   */
  static async bulkInviteMembers(organizationId: string, inviterId: string, invitations: any[]) {
    try {
      const results: any = {
        successful: [],
        failed: [],
        skipped: [],
      };

      const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        throw new Error('Organization not found');
      }

      const inviter = await prisma.user.findUnique({
        where: { id: inviterId },
        include: { memberships: true }
      });
      if (!inviter) {
        throw new Error('Inviter not found');
      }

      const inviterMembership = inviter.memberships?.find(
        (m: any) =>
          m.organizationId === organizationId &&
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
          prisma
        );
      if (!invitationValidation.isValid) {
        throw new Error(invitationValidation.message);
      }

      const capacityValidation =
        await PlanValidationService.validateOrganizationCapacity(
          organizationId,
          prisma
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

          const existingMember = await prisma.user.findFirst({
            where: {
              email: email.toLowerCase(),
              memberships: {
                some: {
                  organizationId,
                  status: 'active'
                }
              }
            }
          });

          if (existingMember) {
            results.skipped.push({
              email,
              reason: 'User is already a member',
            });
            continue;
          }

          const existingInvitation = await prisma.organizationInvitation.findFirst({
            where: {
              organizationId,
              email: email.toLowerCase(),
              status: 'pending'
            }
          });

          if (existingInvitation) {
            results.skipped.push({
              email,
              reason: 'Invitation already pending',
            });
            continue;
          }

          const inviteToken = uuidv4();
          const newInvitation = await prisma.organizationInvitation.create({
            data: {
              organizationId,
              invitedBy: inviterId,
              email: email.toLowerCase(),
              role,
              inviteToken,
              message: message.trim(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            }
          });

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
          await PlanValidationService.updateInvitationUsage(inviterId, prisma);
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
  static async bulkRemoveMembers(organizationId: string, removerId: string, memberIds: string[]) {
    try {
      const results: any = {
        successful: [],
        failed: [],
      };

      const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        throw new Error('Organization not found');
      }

      const remover = await prisma.user.findUnique({
        where: { id: removerId },
        include: { memberships: true }
      });
      if (!remover) {
        throw new Error('Remover not found');
      }

      const removerMembership = remover.memberships?.find(
        (m: any) =>
          m.organizationId === organizationId &&
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
          if (memberId === removerId) {
            results.failed.push({
              memberId,
              error: 'Cannot remove yourself',
            });
            continue;
          }

          const member = await prisma.user.findUnique({
            where: { id: memberId },
            include: { memberships: true }
          });
          if (!member) {
            results.failed.push({
              memberId,
              error: 'Member not found',
            });
            continue;
          }

          const membership = member.memberships.find(
            (m: any) =>
              m.organizationId === organizationId &&
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

          await prisma.organization.update({
            where: { id: organizationId },
            data: {
              statsTotalMembers: { decrement: 1 }
            }
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
   * Bulk change member roles
   */
  static async bulkChangeRoles(organizationId: string, updaterId: string, updates: Array<{ memberId: string, role: string }>) {
    try {
      const results: any = {
        successful: [],
        failed: [],
      };

      const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        throw new Error('Organization not found');
      }

      const updater = await prisma.user.findUnique({
        where: { id: updaterId },
        include: { memberships: true }
      });
      if (!updater) {
        throw new Error('Updater not found');
      }

      const updaterMembership = updater.memberships?.find(
        (m: any) =>
          m.organizationId === organizationId &&
          m.status === 'active'
      );

      if (
        !updaterMembership ||
        (updaterMembership.role !== 'owner' &&
          updaterMembership.role !== 'admin')
      ) {
        throw new Error(
          'Only organization owners and admins can change roles'
        );
      }

      for (const update of updates) {
        const { memberId, role } = update;

        try {
          if (memberId === updaterId) {
            results.failed.push({
              memberId,
              error: 'Cannot change your own role',
            });
            continue;
          }

          if (memberId === organization.ownerId) {
            results.failed.push({
              memberId,
              error: 'Cannot change the owner\'s role',
            });
            continue;
          }

          if (updaterMembership.role === 'admin' && role === 'owner') {
            results.failed.push({
              memberId,
              error: 'Admins cannot make others owners',
            });
            continue;
          }

          const member = await prisma.user.findUnique({
            where: { id: memberId },
            include: { memberships: true }
          });
          if (!member) {
            results.failed.push({
              memberId,
              error: 'Member not found',
            });
            continue;
          }

          const membership = member.memberships.find(
            (m: any) =>
              m.organizationId === organizationId &&
              m.status === 'active'
          );

          if (!membership) {
            results.failed.push({
              memberId,
              error: 'Member is not in this organization',
            });
            continue;
          }

          if (updaterMembership.role === 'admin' && membership.role === 'owner') {
            results.failed.push({
              memberId,
              error: 'Admins cannot change owner roles',
            });
            continue;
          }

          await MultiOrganizationService.updateUserRole(
            memberId,
            organizationId,
            role
          );

          results.successful.push({
            memberId,
            memberName: member.name,
            memberEmail: member.email,
            newRole: role,
          });
        } catch (error: any) {
          console.error(`Error changing role for member ${memberId}:`, error);
          results.failed.push({
            memberId,
            error: error.message,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Bulk change roles error:', error);
      throw error;
    }
  }

  /**
   * Search users for invitation
   */
  static async searchUsersForInvitation(organizationId: string, query: string, limit = 10) {
    try {
      if (!query || query.trim().length < 2) {
        return [];
      }

      const searchQuery = query.trim();

      const members = await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: searchQuery, mode: 'insensitive' } },
            { name: { contains: searchQuery, mode: 'insensitive' } },
          ],
          NOT: {
            memberships: {
              some: {
                organizationId,
                status: 'active'
              }
            }
          }
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
        take: limit
      });

      return members;
    } catch (error) {
      console.error('Search users error:', error);
      throw error;
    }
  }

  /**
   * Get organization members with pagination
   */
  static async getOrganizationMembers(organizationId: string, page = 1, limit = 20, search = '') {
    try {
      const skip = (page - 1) * limit;
      
      const whereClause: any = {
        organizationId,
      };

      if (search) {
        whereClause.user = {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        };
      }

      const [totalCount, memberships] = await Promise.all([
        prisma.userOrganizationMembership.count({ where: whereClause }),
        prisma.userOrganizationMembership.findMany({
          where: whereClause,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            }
          },
          skip,
          take: limit,
          orderBy: { joinedAt: 'desc' }
        })
      ]);

      const members = memberships.map((m: any) => ({
        ...m.user,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
      }));

      return {
        members,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      console.error('Get organization members error:', error);
      throw error;
    }
  }
}

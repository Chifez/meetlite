import { prisma } from '@minimeet/shared';
import { generateJWTToken } from '../utils/generate-token.js';

export class MultiOrganizationService {
  /**
   * Add user to an organization
   */
  static async addUserToOrganization(
    userId: string,
    organizationId: string,
    role = 'member',
    invitedBy: string | null = null
  ) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { memberships: true },
      });
      if (!user) {
        throw new Error('User not found');
      }

      const existingMembership = user.memberships.find(
        (m: any) =>
          m.organizationId === organizationId && m.status === 'active'
      );

      if (existingMembership) {
        throw new Error('User is already a member of this organization');
      }

      const isFirstOrg = !user.organizationId;
      const updateData: any = {
        memberships: {
          create: {
            organizationId,
            role,
            status: 'active',
            invitedBy,
            joinedAt: new Date(),
          },
        },
      };

      if (isFirstOrg) {
        updateData.organizationId = organizationId;
        updateData.role = role;
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: { memberships: true },
      });

      return updatedUser;
    } catch (error) {
      console.error('Error adding user to organization:', error);
      throw error;
    }
  }

  /**
   * Remove user from an organization
   */
  static async removeUserFromOrganization(userId: string, organizationId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { memberships: true },
      });
      if (!user) {
        throw new Error('User not found');
      }

      const membership = user.memberships.find(
        (m: any) => m.organizationId === organizationId
      );

      if (!membership) {
        throw new Error('User is not a member of this organization');
      }

      const updateData: any = {
        memberships: {
          update: {
            where: { id: membership.id },
            data: { status: 'inactive' },
          },
        },
      };

      if (user.organizationId === organizationId) {
        const activeMemberships = user.memberships.filter(
          (m: any) => m.status === 'active' && m.id !== membership.id
        );

        if (activeMemberships.length > 0) {
          const nextMembership = activeMemberships[0];
          updateData.organizationId = nextMembership.organizationId;
          updateData.role = nextMembership.role;
        } else {
          updateData.organizationId = null;
          updateData.role = 'owner';
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: { memberships: true },
      });

      return updatedUser;
    } catch (error) {
      console.error('Error removing user from organization:', error);
      throw error;
    }
  }

  /**
   * Switch user's active organization
   */
  static async switchActiveOrganization(userId: string, organizationId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { memberships: true },
      });
      if (!user) {
        throw new Error('User not found');
      }

      const membership = user.memberships.find(
        (m: any) =>
          m.organizationId === organizationId && m.status === 'active'
      );

      if (!membership) {
        throw new Error('User is not an active member of this organization');
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          organizationId,
          role: membership.role,
          tokenVersion: { increment: 1 },
        },
        include: { memberships: true },
      });

      const newToken = generateJWTToken(updatedUser);

      return { user: updatedUser, token: newToken };
    } catch (error) {
      console.error('Error switching active organization:', error);
      throw error;
    }
  }

  /**
   * Get user's organizations
   */
  static async getUserOrganizations(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          memberships: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  logo: true,
                  description: true,
                  industry: true,
                  size: true,
                  planType: true,
                  planStatus: true,
                  planStartDate: true,
                  planEndDate: true,
                  billingSubscriptionId: true,
                  billingCustomerId: true,
                  statsTotalMembers: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const organizations = user.memberships
        .filter((m: any) => m.status === 'active')
        .map((membership: any) => {
          const org = membership.organization;
          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            logo: org.logo,
            description: org.description,
            industry: org.industry,
            size: org.size,
            plan: {
              type: org.planType,
              status: org.planStatus,
              startDate: org.planStartDate,
              endDate: org.planEndDate,
              stripeSubscriptionId: org.billingSubscriptionId,
              stripeSessionId: org.billingCustomerId,
            },
            memberCount: org.statsTotalMembers || 0,
            role: membership.role,
            joinedAt: membership.joinedAt,
            invitedBy: membership.invitedBy,
            isActive: user.organizationId === org.id,
          };
        });

      return organizations;
    } catch (error) {
      console.error('Error getting user organizations:', error);
      throw error;
    }
  }

  /**
   * Transfer organization ownership
   */
  static async transferOwnership(organizationId: string, currentOwnerId: string, newOwnerId: string) {
    try {
      return await prisma.$transaction(async (tx: any) => {
        const organization = await tx.organization.findUnique({
          where: { id: organizationId },
        });
        if (!organization) {
          throw new Error('Organization not found');
        }

        if (organization.ownerId !== currentOwnerId) {
          throw new Error('Only the organization owner can transfer ownership');
        }

        if (currentOwnerId === newOwnerId) {
          throw new Error('Cannot transfer ownership to yourself');
        }

        const newOwner = await tx.user.findUnique({
          where: { id: newOwnerId },
          include: { memberships: true },
        });
        if (!newOwner) {
          throw new Error('New owner not found');
        }

        const newOwnerMembership = newOwner.memberships.find(
          (m: any) =>
            m.organizationId === organizationId && m.status === 'active'
        );

        if (!newOwnerMembership) {
          throw new Error('New owner must be a member of the organization');
        }

        const updatedOrg = await tx.organization.update({
          where: { id: organizationId },
          data: { ownerId: newOwnerId },
        });

        const currentOwner = await tx.user.findUnique({
          where: { id: currentOwnerId },
          include: { memberships: true },
        });

        const currentOwnerMembership = currentOwner.memberships.find(
          (m: any) => m.organizationId === organizationId
        );

        if (currentOwnerMembership) {
          await tx.organizationMember.update({
            where: { id: currentOwnerMembership.id },
            data: { role: 'member' },
          });
        }

        await tx.organizationMember.update({
          where: { id: newOwnerMembership.id },
          data: { role: 'owner' },
        });

        let updatedCurrentOwner = currentOwner;
        if (currentOwner.organizationId === organizationId) {
          updatedCurrentOwner = await tx.user.update({
            where: { id: currentOwnerId },
            data: { role: 'member', tokenVersion: { increment: 1 } },
          });
        }

        let updatedNewOwner = newOwner;
        if (newOwner.organizationId === organizationId) {
          updatedNewOwner = await tx.user.update({
            where: { id: newOwnerId },
            data: { role: 'owner', tokenVersion: { increment: 1 } },
          });
        }

        const currentOwnerToken = generateJWTToken(updatedCurrentOwner);
        const newOwnerToken = generateJWTToken(updatedNewOwner);

        return {
          organization: updatedOrg,
          currentOwner: { user: updatedCurrentOwner, token: currentOwnerToken },
          newOwner: { user: updatedNewOwner, token: newOwnerToken },
        };
      });
    } catch (error) {
      console.error('Error transferring ownership:', error);
      throw error;
    }
  }

  /**
   * Update user's role in an organization
   */
  static async updateUserRole(userId: string, organizationId: string, newRole: string) {
    try {
      return await prisma.$transaction(async (tx: any) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          include: { memberships: true },
        });
        if (!user) {
          throw new Error('User not found');
        }

        const membership = user.memberships.find(
          (m: any) =>
            m.organizationId === organizationId && m.status === 'active'
        );

        if (!membership) {
          throw new Error('User is not an active member of this organization');
        }

        await tx.organizationMember.update({
          where: { id: membership.id },
          data: { role: newRole as any },
        });

        let updatedUser = user;
        if (user.organizationId === organizationId) {
          updatedUser = await tx.user.update({
            where: { id: userId },
            data: { role: newRole as any, tokenVersion: { increment: 1 } },
          });
        }

        let newToken: string | null = null;
        if (updatedUser.organizationId === organizationId) {
          newToken = generateJWTToken(updatedUser);
        }

        return { user: updatedUser, token: newToken };
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }
}

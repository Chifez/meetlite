import { models } from '../index.js';
import { generateJWTToken } from '../utils/generate-token.js';

export class MultiOrganizationService {
  /**
   * Add user to an organization
   */
  static async addUserToOrganization(
    userId: any,
    organizationId: any,
    role = 'member',
    invitedBy: any = null
  ) {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const existingMembership = user.memberships.find(
        (m: any) =>
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      if (existingMembership) {
        throw new Error('User is already a member of this organization');
      }

      user.memberships.push({
        organizationId,
        role,
        status: 'active',
        invitedBy,
        joinedAt: new Date(),
      });

      if (!user.organizationId) {
        user.organizationId = organizationId;
        user.role = role;
      }

      await user.save();
      return user;
    } catch (error) {
      console.error('Error adding user to organization:', error);
      throw error;
    }
  }

  /**
   * Remove user from an organization
   */
  static async removeUserFromOrganization(userId: any, organizationId: any) {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const membership = user.memberships.find(
        (m: any) => m.organizationId.toString() === organizationId.toString()
      );

      if (!membership) {
        throw new Error('User is not a member of this organization');
      }

      membership.status = 'inactive';

      if (user.organizationId?.toString() === organizationId.toString()) {
        const activeMemberships = user.memberships.filter(
          (m: any) => m.status === 'active'
        );

        if (activeMemberships.length > 0) {
          const nextMembership = activeMemberships[0];
          user.organizationId = nextMembership.organizationId;
          user.role = nextMembership.role;
        } else {
          user.organizationId = null;
          user.role = 'owner';
        }
      }

      await user.save();
      return user;
    } catch (error) {
      console.error('Error removing user from organization:', error);
      throw error;
    }
  }

  /**
   * Switch user's active organization
   */
  static async switchActiveOrganization(userId: any, organizationId: any) {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const membership = user.memberships.find(
        (m: any) =>
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      if (!membership) {
        throw new Error('User is not an active member of this organization');
      }

      user.organizationId = organizationId;
      user.role = membership.role;
      user.tokenVersion = (user.tokenVersion || 1) + 1;

      await user.save();

      const newToken = generateJWTToken(user);

      return { user, token: newToken };
    } catch (error) {
      console.error('Error switching active organization:', error);
      throw error;
    }
  }

  /**
   * Get user's organizations
   */
  static async getUserOrganizations(userId: any) {
    try {
      const user = await models.User.findById(userId)
        .populate(
          'memberships.organizationId',
          'name slug logo description industry size plan stats'
        )
        .populate('memberships.invitedBy', 'name email');

      if (!user) {
        throw new Error('User not found');
      }

      const organizations = user.memberships
        .filter((m: any) => m.status === 'active')
        .map((membership: any) => ({
          id: membership.organizationId._id,
          name: membership.organizationId.name,
          slug: membership.organizationId.slug,
          logo: membership.organizationId.logo,
          description: membership.organizationId.description,
          industry: membership.organizationId.industry,
          size: membership.organizationId.size,
          plan: membership.organizationId.plan,
          memberCount: membership.organizationId.stats?.totalMembers || 0,
          role: membership.role,
          joinedAt: membership.joinedAt,
          invitedBy: membership.invitedBy,
          isActive:
            user.organizationId?.toString() ===
            membership.organizationId._id.toString(),
        }));

      return organizations;
    } catch (error) {
      console.error('Error getting user organizations:', error);
      throw error;
    }
  }

  /**
   * Transfer organization ownership
   */
  static async transferOwnership(organizationId: any, currentOwnerId: any, newOwnerId: any) {
    try {
      const organization = await models.Organization.findById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      if (organization.ownerId.toString() !== currentOwnerId.toString()) {
        throw new Error('Only the organization owner can transfer ownership');
      }

      if (currentOwnerId.toString() === newOwnerId.toString()) {
        throw new Error('Cannot transfer ownership to yourself');
      }

      const newOwner = await models.User.findById(newOwnerId);
      if (!newOwner) {
        throw new Error('New owner not found');
      }

      const membership = newOwner.memberships.find(
        (m: any) =>
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      if (!membership) {
        throw new Error('New owner must be a member of the organization');
      }

      organization.ownerId = newOwnerId;
      await organization.save();

      const currentOwner = await models.User.findById(currentOwnerId);
      const currentOwnerMembership = currentOwner.memberships.find(
        (m: any) => m.organizationId.toString() === organizationId.toString()
      );
      if (currentOwnerMembership) {
        currentOwnerMembership.role = 'member';
      }

      const newOwnerMembership = newOwner.memberships.find(
        (m: any) => m.organizationId.toString() === organizationId.toString()
      );
      if (newOwnerMembership) {
        newOwnerMembership.role = 'owner';
      }

      if (
        currentOwner.organizationId?.toString() === organizationId.toString()
      ) {
        currentOwner.role = 'member';
        currentOwner.tokenVersion = (currentOwner.tokenVersion || 1) + 1;
      }

      if (newOwner.organizationId?.toString() === organizationId.toString()) {
        newOwner.role = 'owner';
        newOwner.tokenVersion = (newOwner.tokenVersion || 1) + 1;
      }

      await currentOwner.save();
      await newOwner.save();

      const currentOwnerToken = generateJWTToken(currentOwner);
      const newOwnerToken = generateJWTToken(newOwner);

      return {
        organization,
        currentOwner: { user: currentOwner, token: currentOwnerToken },
        newOwner: { user: newOwner, token: newOwnerToken },
      };
    } catch (error) {
      console.error('Error transferring ownership:', error);
      throw error;
    }
  }

  /**
   * Update user's role in an organization
   */
  static async updateUserRole(userId: any, organizationId: any, newRole: string) {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const membership = user.memberships.find(
        (m: any) =>
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      if (!membership) {
        throw new Error('User is not an active member of this organization');
      }

      membership.role = newRole;

      if (user.organizationId?.toString() === organizationId.toString()) {
        user.role = newRole;
        user.tokenVersion = (user.tokenVersion || 1) + 1;
      }

      await user.save();

      let newToken: string | null = null;
      if (user.organizationId?.toString() === organizationId.toString()) {
        newToken = generateJWTToken(user);
      }

      return { user, token: newToken };
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }
}

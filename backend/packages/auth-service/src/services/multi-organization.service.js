import { models } from '../index.js';
import { generateJWTToken } from '../utils/generate-token.js';

export class MultiOrganizationService {
  /**
   * Add user to an organization
   */
  static async addUserToOrganization(
    userId,
    organizationId,
    role = 'member',
    invitedBy = null
  ) {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user is already a member
      const existingMembership = user.memberships.find(
        (m) =>
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      if (existingMembership) {
        throw new Error('User is already a member of this organization');
      }

      // Add membership
      user.memberships.push({
        organizationId,
        role,
        status: 'active',
        invitedBy,
        joinedAt: new Date(),
      });

      // If this is the first organization or user is not in any organization, set as active
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
  static async removeUserFromOrganization(userId, organizationId) {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Find and update membership status
      const membership = user.memberships.find(
        (m) => m.organizationId.toString() === organizationId.toString()
      );

      if (!membership) {
        throw new Error('User is not a member of this organization');
      }

      // Mark membership as inactive
      membership.status = 'inactive';

      // If this was the active organization, switch to another or personal
      if (user.organizationId?.toString() === organizationId.toString()) {
        const activeMemberships = user.memberships.filter(
          (m) => m.status === 'active'
        );

        if (activeMemberships.length > 0) {
          // Switch to another organization
          const nextMembership = activeMemberships[0];
          user.organizationId = nextMembership.organizationId;
          user.role = nextMembership.role;
        } else {
          // Switch to personal workspace
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
  static async switchActiveOrganization(userId, organizationId) {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Find the membership
      const membership = user.memberships.find(
        (m) =>
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      if (!membership) {
        throw new Error('User is not an active member of this organization');
      }

      // Update active organization
      user.organizationId = organizationId;
      user.role = membership.role;
      user.tokenVersion = (user.tokenVersion || 1) + 1; // Invalidate old tokens

      await user.save();

      // Generate new token
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
  static async getUserOrganizations(userId) {
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
        .filter((m) => m.status === 'active')
        .map((membership) => ({
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
  static async transferOwnership(organizationId, currentOwnerId, newOwnerId) {
    try {
      const organization = await models.Organization.findById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Verify current owner
      if (organization.ownerId.toString() !== currentOwnerId.toString()) {
        throw new Error('Only the organization owner can transfer ownership');
      }

      // Prevent self-transfer
      if (currentOwnerId.toString() === newOwnerId.toString()) {
        throw new Error('Cannot transfer ownership to yourself');
      }

      // Find new owner
      const newOwner = await models.User.findById(newOwnerId);
      if (!newOwner) {
        throw new Error('New owner not found');
      }

      // Check if new owner is a member of the organization
      const membership = newOwner.memberships.find(
        (m) =>
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      if (!membership) {
        throw new Error('New owner must be a member of the organization');
      }

      // Update organization ownership
      organization.ownerId = newOwnerId;
      await organization.save();

      // Update memberships
      const currentOwner = await models.User.findById(currentOwnerId);
      const currentOwnerMembership = currentOwner.memberships.find(
        (m) => m.organizationId.toString() === organizationId.toString()
      );
      if (currentOwnerMembership) {
        currentOwnerMembership.role = 'member';
      }

      const newOwnerMembership = newOwner.memberships.find(
        (m) => m.organizationId.toString() === organizationId.toString()
      );
      if (newOwnerMembership) {
        newOwnerMembership.role = 'owner';
      }

      // If current owner has this as active organization, update their role
      if (
        currentOwner.organizationId?.toString() === organizationId.toString()
      ) {
        currentOwner.role = 'member';
        currentOwner.tokenVersion = (currentOwner.tokenVersion || 1) + 1;
      }

      // If new owner has this as active organization, update their role
      if (newOwner.organizationId?.toString() === organizationId.toString()) {
        newOwner.role = 'owner';
        newOwner.tokenVersion = (newOwner.tokenVersion || 1) + 1;
      }

      await currentOwner.save();
      await newOwner.save();

      // Generate new tokens for both users
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
  static async updateUserRole(userId, organizationId, newRole) {
    try {
      const user = await models.User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const membership = user.memberships.find(
        (m) =>
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      if (!membership) {
        throw new Error('User is not an active member of this organization');
      }

      // Update membership role
      membership.role = newRole;

      // If this is the active organization, update the user's role
      if (user.organizationId?.toString() === organizationId.toString()) {
        user.role = newRole;
        user.tokenVersion = (user.tokenVersion || 1) + 1;
      }

      await user.save();

      // Generate new token if this was the active organization
      let newToken = null;
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

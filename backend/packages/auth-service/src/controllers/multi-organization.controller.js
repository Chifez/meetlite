import { models } from '../index.js';
import { MultiOrganizationService } from '../services/multi-organization.service.js';
import { generateJWTToken } from '../utils/generate-token.js';

export class MultiOrganizationController {
  /**
   * GET /multi-org/organizations - Get user's organizations
   */
  async getUserOrganizations(req, res) {
    try {
      const userId = req.user._id;
      const organizations = await MultiOrganizationService.getUserOrganizations(
        userId
      );

      res.json({
        success: true,
        data: organizations,
      });
    } catch (error) {
      console.error('Get user organizations error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * POST /multi-org/switch - Switch active organization
   */
  async switchActiveOrganization(req, res) {
    try {
      const { organizationId } = req.body;
      const userId = req.user._id;

      if (!organizationId) {
        return res.status(400).json({
          message: 'organizationId is required',
        });
      }

      const result = await MultiOrganizationService.switchActiveOrganization(
        userId,
        organizationId
      );

      res.json({
        message: 'Active organization switched successfully',
        organization: {
          id: organizationId,
          role: result.user.role,
        },
        token: result.token,
      });
    } catch (error) {
      console.error('Switch active organization error:', error);

      if (
        error.message.includes('not found') ||
        error.message.includes('not an active member')
      ) {
        return res.status(404).json({ message: error.message });
      }

      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * POST /multi-org/transfer-ownership - Transfer organization ownership
   */
  async transferOwnership(req, res) {
    try {
      const { organizationId, newOwnerId } = req.body;
      const currentOwnerId = req.user._id;

      if (!organizationId || !newOwnerId) {
        return res.status(400).json({
          message: 'organizationId and newOwnerId are required',
        });
      }

      const result = await MultiOrganizationService.transferOwnership(
        organizationId,
        currentOwnerId,
        newOwnerId
      );

      res.json({
        message: 'Ownership transferred successfully',
        organization: {
          id: result.organization._id,
          name: result.organization.name,
          ownerId: result.organization.ownerId,
        },
        newOwner: {
          id: result.newOwner.user._id,
          name: result.newOwner.user.name,
          email: result.newOwner.user.email,
        },
        // Return token for new owner if they're the current user
        token: result.newOwner.token,
      });
    } catch (error) {
      console.error('Transfer ownership error:', error);

      if (
        error.message.includes('not found') ||
        error.message.includes('Only the organization owner') ||
        error.message.includes('Cannot transfer ownership') ||
        error.message.includes('must be a member')
      ) {
        return res.status(400).json({ message: error.message });
      }

      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * PUT /multi-org/update-role - Update user's role in organization
   */
  async updateUserRole(req, res) {
    try {
      const { userId, organizationId, newRole } = req.body;
      const currentUserId = req.user._id;

      if (!userId || !organizationId || !newRole) {
        return res.status(400).json({
          message: 'userId, organizationId, and newRole are required',
        });
      }

      if (!['owner', 'member'].includes(newRole)) {
        return res.status(400).json({
          message: 'newRole must be either "owner" or "member"',
        });
      }

      // Check if current user is organization owner
      const organization = await models.Organization.findById(organizationId);
      if (!organization) {
        return res.status(404).json({ message: 'Organization not found' });
      }

      if (organization.ownerId.toString() !== currentUserId.toString()) {
        return res.status(403).json({
          message: 'Only organization owners can update member roles',
        });
      }

      // Prevent owner from changing their own role
      if (userId === currentUserId.toString()) {
        return res.status(400).json({
          message: 'Organization owners cannot change their own role',
        });
      }

      const result = await MultiOrganizationService.updateUserRole(
        userId,
        organizationId,
        newRole
      );

      res.json({
        message: 'User role updated successfully',
        user: {
          id: result.user._id,
          name: result.user.name,
          email: result.user.email,
          role: newRole,
        },
        // Return token if this was the active organization
        token: result.token,
      });
    } catch (error) {
      console.error('Update user role error:', error);

      if (
        error.message.includes('not found') ||
        error.message.includes('not an active member')
      ) {
        return res.status(404).json({ message: error.message });
      }

      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * DELETE /multi-org/leave - Leave organization
   */
  async leaveOrganization(req, res) {
    try {
      const { organizationId } = req.body;
      const userId = req.user._id;

      if (!organizationId) {
        return res.status(400).json({
          message: 'organizationId is required',
        });
      }

      // Check if user is organization owner
      const organization = await models.Organization.findById(organizationId);
      if (!organization) {
        return res.status(404).json({ message: 'Organization not found' });
      }

      if (organization.ownerId.toString() === userId.toString()) {
        return res.status(400).json({
          message:
            'Organization owners cannot leave. Transfer ownership first or delete the organization.',
        });
      }

      const updatedUser =
        await MultiOrganizationService.removeUserFromOrganization(
          userId,
          organizationId
        );

      // Generate new token
      const newToken = generateJWTToken(updatedUser);

      res.json({
        message: 'Successfully left organization',
        token: newToken,
      });
    } catch (error) {
      console.error('Leave organization error:', error);

      if (
        error.message.includes('not found') ||
        error.message.includes('not a member')
      ) {
        return res.status(404).json({ message: error.message });
      }

      res.status(500).json({ message: 'Server error' });
    }
  }
}

export default MultiOrganizationController;

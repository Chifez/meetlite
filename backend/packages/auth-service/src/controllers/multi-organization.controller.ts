import { Response } from 'express';
import { prisma } from '@minimeet/shared';
// @ts-ignore
import { MultiOrganizationService } from '../services/multi-organization.service.js';
import { generateJWTToken } from '../utils/generate-token.js';

export class MultiOrganizationController {
  /**
   * GET /multi-org/organizations - Get user's organizations
   */
  async getUserOrganizations(req: any, res: Response) {
    try {
      const userId = req.user.id || req.user._id;
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
  async switchActiveOrganization(req: any, res: Response) {
    try {
      const { organizationId } = req.body;
      const userId = req.user.id || req.user._id;

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
    } catch (error: any) {
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
  async transferOwnership(req: any, res: Response) {
    try {
      const { organizationId, newOwnerId } = req.body;
      const currentOwnerId = req.user.id || req.user._id;

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
        token: result.newOwner.token,
      });
    } catch (error: any) {
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
  async updateUserRole(req: any, res: Response) {
    try {
      const { userId, organizationId, newRole } = req.body;
      const currentUserId = req.user.id || req.user._id;

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

      const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        return res.status(404).json({ message: 'Organization not found' });
      }

      if (organization.ownerId.toString() !== currentUserId.toString()) {
        return res.status(403).json({
          message: 'Only organization owners can update member roles',
        });
      }

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
        token: result.token,
      });
    } catch (error: any) {
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
  async leaveOrganization(req: any, res: Response) {
    try {
      const { organizationId } = req.body;
      const userId = req.user.id || req.user._id;

      if (!organizationId) {
        return res.status(400).json({
          message: 'organizationId is required',
        });
      }

      const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
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

      const newToken = generateJWTToken(updatedUser);

      res.json({
        message: 'Successfully left organization',
        token: newToken,
      });
    } catch (error: any) {
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

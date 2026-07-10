import { Response } from 'express';
import { prisma } from '@minimeet/shared';
// @ts-ignore
import { BulkOperationsService } from '../services/bulk-operations.service.js';

export class BulkOperationsController {
  /**
   * POST /bulk/invite - Bulk invite members
   */
  async bulkInviteMembers(req: any, res: Response) {
    try {
      const { organizationId, invitations } = req.body;
      const inviterId = req.user.id || req.user._id;

      if (!organizationId || !invitations || !Array.isArray(invitations)) {
        return res.status(400).json({
          message: 'organizationId and invitations array are required',
        });
      }

      if (invitations.length === 0) {
        return res.status(400).json({
          message: 'At least one invitation is required',
        });
      }

      if (invitations.length > 50) {
        return res.status(400).json({
          message: 'Cannot send more than 50 invitations at once',
        });
      }

      const results = await BulkOperationsService.bulkInviteMembers(
        organizationId,
        inviterId,
        invitations
      );

      res.json({
        message: 'Bulk invitation completed',
        results: {
          total: invitations.length,
          successful: results.successful.length,
          failed: results.failed.length,
          skipped: results.skipped.length,
        },
        details: results,
      });
    } catch (error: any) {
      console.error('Bulk invite error:', error);

      if (
        error.message.includes('not found') ||
        error.message.includes('Only organization owners') ||
        error.message.includes('Usage limit exceeded') ||
        error.message.includes('Organization can accept')
      ) {
        return res.status(400).json({ message: error.message });
      }

      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * DELETE /bulk/remove - Bulk remove members
   */
  async bulkRemoveMembers(req: any, res: Response) {
    try {
      const { organizationId, memberIds } = req.body;
      const removerId = req.user.id || req.user._id;

      if (!organizationId || !memberIds || !Array.isArray(memberIds)) {
        return res.status(400).json({
          message: 'organizationId and memberIds array are required',
        });
      }

      if (memberIds.length === 0) {
        return res.status(400).json({
          message: 'At least one member ID is required',
        });
      }

      if (memberIds.length > 100) {
        return res.status(400).json({
          message: 'Cannot remove more than 100 members at once',
        });
      }

      const results = await BulkOperationsService.bulkRemoveMembers(
        organizationId,
        removerId,
        memberIds
      );

      res.json({
        message: 'Bulk removal completed',
        results: {
          total: memberIds.length,
          successful: results.successful.length,
          failed: results.failed.length,
        },
        details: results,
      });
    } catch (error: any) {
      console.error('Bulk remove error:', error);

      if (
        error.message.includes('not found') ||
        error.message.includes('Only organization owners')
      ) {
        return res.status(400).json({ message: error.message });
      }

      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * PUT /bulk/update-roles - Bulk update member roles
   */
  async bulkUpdateRoles(req: any, res: Response) {
    try {
      const { organizationId, roleUpdates } = req.body;
      const updaterId = req.user.id || req.user._id;

      if (!organizationId || !roleUpdates || !Array.isArray(roleUpdates)) {
        return res.status(400).json({
          message: 'organizationId and roleUpdates array are required',
        });
      }

      if (roleUpdates.length === 0) {
        return res.status(400).json({
          message: 'At least one role update is required',
        });
      }

      if (roleUpdates.length > 100) {
        return res.status(400).json({
          message: 'Cannot update more than 100 members at once',
        });
      }

      const results = await BulkOperationsService.bulkChangeRoles(
        organizationId,
        updaterId,
        roleUpdates
      );

      res.json({
        message: 'Bulk role update completed',
        results: {
          total: roleUpdates.length,
          successful: results.successful.length,
          failed: results.failed.length,
        },
        details: results,
      });
    } catch (error: any) {
      console.error('Bulk update roles error:', error);

      if (
        error.message.includes('not found') ||
        error.message.includes('Only organization owners')
      ) {
        return res.status(400).json({ message: error.message });
      }

      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * GET /bulk/members - Get organization members with pagination
   */
  async getOrganizationMembers(req: any, res: Response) {
    try {
      const { organizationId } = req.params;
      const { page = '1', limit = '20', search = '' } = req.query;
      const userId = req.user.id || req.user._id;

      const organization = await prisma.organization.findUnique({
        where: { id: organizationId }
      });
      if (!organization) {
        return res.status(404).json({ message: 'Organization not found' });
      }

      const isOwner = organization.ownerId === userId;
      let userMembership;

      if (!isOwner) {
        userMembership = await prisma.userOrganizationMembership.findUnique({
          where: {
            userId_organizationId: {
              userId,
              organizationId,
            }
          }
        });
        
        if (!userMembership || userMembership.status !== 'active') {
          return res.status(403).json({
            message: 'Access denied. You are not a member of this organization',
          });
        }
      }

      const result = await BulkOperationsService.getOrganizationMembers(
        organizationId,
        parseInt(page as string),
        parseInt(limit as string),
        search as string
      );

      console.log('[BACKEND CONTROLLER] Sending response:', {
        membersCount: result.members?.length,
        firstMemberKeys: result.members?.[0]
          ? Object.keys(result.members[0])
          : [],
        firstMember: result.members?.[0],
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Get organization members error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

export default BulkOperationsController;

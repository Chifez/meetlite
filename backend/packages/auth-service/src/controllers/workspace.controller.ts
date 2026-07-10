import { Response } from 'express';
import { prisma } from '@minimeet/shared';
import { generateJWTToken } from '../utils/generate-token.js';

export class WorkspaceController {
  // POST /workspace/switch - Unified workspace switching endpoint
  async switchWorkspace(req: any, res: Response) {
    try {
      const { type, organizationId } = req.body;
      const userId = req.user.id || req.user._id;

      if (!type || !['personal', 'organization'].includes(type)) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid workspace type. Must be "personal" or "organization"',
        });
      }

      if (type === 'organization' && !organizationId) {
        return res.status(400).json({
          success: false,
          message: 'organizationId is required for organization workspace',
        });
      }

      let updatedUser: any;
      let newWorkspace: any = null;

      if (type === 'personal') {
        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            organizationId: null,
            role: 'owner',
            tokenVersion: { increment: 1 },
          }
        });

        newWorkspace = {
          type: 'personal',
          role: 'owner',
        };
      } else {
        const organization = await prisma.organization.findFirst({
          where: {
            id: organizationId,
            status: 'active',
          }
        });

        if (!organization) {
          return res.status(404).json({
            success: false,
            message: 'Organization not found',
          });
        }

        const isOwner = organization.ownerId === userId;
        const isMember = req.user.organizationId === organizationId;

        if (!isOwner && !isMember) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to organization',
            debug: { orgId: organizationId, isOwner, isMember }
          });
        }

        const userRole = isOwner ? 'owner' : 'member';
        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            organizationId,
            role: userRole,
            tokenVersion: { increment: 1 },
          }
        });

        newWorkspace = {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          type: 'organization',
          role: userRole,
          plan: {
            type: organization.planType,
            status: organization.planStatus,
            startDate: organization.planStartDate,
            endDate: organization.planEndDate,
          },
          memberCount: organization.statsTotalMembers,
          settings: {
            allowPublicMeetings: organization.allowPublicMeetings,
            requireMeetingApproval: organization.requireMeetingApproval,
            maxMeetingDuration: organization.maxMeetingDuration,
            allowExternalParticipants: organization.allowExternalParticipants,
            defaultMeetingPrivacy: organization.defaultMeetingPrivacy,
          },
        };
      }

      const newToken = generateJWTToken(updatedUser);

      res.json({
        success: true,
        message: `Switched to ${type} workspace successfully`,
        workspace: newWorkspace,
        token: newToken,
      });
    } catch (error: any) {
      console.error('Workspace switch error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message || error.toString(),
      });
    }
  }

  // GET /workspace/current - Get current workspace information
  async getCurrentWorkspace(req: any, res: Response) {
    try {
      const user = req.user;

      if (!user.organizationId) {
        return res.json({
          success: true,
          workspace: {
            type: 'personal',
            role: 'owner',
          },
        });
      }

      const organization = await prisma.organization.findFirst({
        where: {
          id: user.organizationId,
          status: 'active',
        }
      });

      if (!organization) {
        await prisma.user.update({
          where: { id: user.id || user._id },
          data: {
            organizationId: null,
            role: 'owner',
            tokenVersion: { increment: 1 },
          }
        });

        return res.json({
          success: true,
          workspace: {
            type: 'personal',
            role: 'owner',
          },
          warning:
            'Organization no longer exists, switched to personal workspace',
        });
      }

      const isOwner = organization.ownerId === (user.id || user._id);

      res.json({
        success: true,
        workspace: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          type: 'organization',
          role: isOwner ? 'owner' : 'member',
          plan: {
            type: organization.planType,
            status: organization.planStatus,
            startDate: organization.planStartDate,
            endDate: organization.planEndDate,
          },
          memberCount: organization.statsTotalMembers,
          settings: {
            allowPublicMeetings: organization.allowPublicMeetings,
            requireMeetingApproval: organization.requireMeetingApproval,
            maxMeetingDuration: organization.maxMeetingDuration,
            allowExternalParticipants: organization.allowExternalParticipants,
            defaultMeetingPrivacy: organization.defaultMeetingPrivacy,
          },
        },
      });
    } catch (error) {
      console.error('Get current workspace error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
      });
    }
  }
}

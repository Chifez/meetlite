import { Response } from 'express';
import { models } from '../index.js';
import { generateJWTToken } from '../utils/generate-token.js';

export class WorkspaceController {
  // POST /workspace/switch - Unified workspace switching endpoint
  async switchWorkspace(req: any, res: Response) {
    try {
      const { type, organizationId } = req.body;
      const userId = req.user._id;

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
        updatedUser = await models.User.findByIdAndUpdate(
          userId,
          {
            $unset: { organizationId: 1 },
            role: 'owner',
            $inc: { tokenVersion: 1 },
          },
          { new: true }
        );

        newWorkspace = {
          type: 'personal',
          role: 'owner',
        };
      } else {
        const organization = await models.Organization.findOne({
          _id: organizationId,
          status: 'active',
        });

        if (!organization) {
          return res.status(404).json({
            success: false,
            message: 'Organization not found',
          });
        }

        const isOwner = organization.ownerId.toString() === userId.toString();
        const isMember = req.user.organizationId?.toString() === organizationId;

        if (!isOwner && !isMember) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to organization',
          });
        }

        const userRole = isOwner ? 'owner' : 'member';
        updatedUser = await models.User.findByIdAndUpdate(
          userId,
          {
            organizationId,
            role: userRole,
            $inc: { tokenVersion: 1 },
          },
          { new: true }
        );

        newWorkspace = {
          id: organization._id,
          name: organization.name,
          slug: organization.slug,
          type: 'organization',
          role: userRole,
          plan: organization.plan,
          memberCount: organization.stats.totalMembers,
          settings: organization.settings,
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
        error:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
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

      const organization = await models.Organization.findOne({
        _id: user.organizationId,
        status: 'active',
      });

      if (!organization) {
        await models.User.findByIdAndUpdate(user._id, {
          $unset: { organizationId: 1 },
          role: 'owner',
          $inc: { tokenVersion: 1 },
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

      const isOwner = organization.ownerId.toString() === user._id.toString();

      res.json({
        success: true,
        workspace: {
          id: organization._id,
          name: organization.name,
          slug: organization.slug,
          type: 'organization',
          role: isOwner ? 'owner' : 'member',
          plan: organization.plan,
          memberCount: organization.stats.totalMembers,
          settings: organization.settings,
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

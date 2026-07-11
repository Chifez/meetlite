import { Response, NextFunction } from 'express';
import { prisma } from '@minimeet/shared';
import { AuthenticatedRequest } from './authenticate-token.js';
import { WORKSPACE_ROLES } from '@minimeet/shared';


/**
 * Middleware to check if user can access team-specific data
 */
export const requireTeamAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const teamId = req.params.teamId || req.query.teamId || req.body.teamId;

    if (!teamId) {
      return next();
    }

    const organizationId =
      req.params.organizationId ||
      req.query.organizationId ||
      req.body.organizationId ||
      user.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        message: 'Organization context required for team access',
      });
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        memberships: {
          where: { organizationId, status: 'active' }
        },
        teamMemberships: {
          where: { teamId, status: 'active' }
        }
      }
    });

    if (!fullUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const orgMembership = fullUser.memberships[0];

    if (
      orgMembership &&
      (orgMembership.role === WORKSPACE_ROLES.OWNER || orgMembership.role === WORKSPACE_ROLES.ADMIN)
    ) {
      return next();
    }

    const isTeamMember = fullUser.teamMemberships.length > 0;

    if (isTeamMember) {
      return next();
    }

    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId: organizationId,
        NOT: { status: 'deleted' },
      }
    });

    if (!team) {
      return res.status(404).json({
        message: 'Team not found or does not belong to this organization',
      });
    }

    return res.status(403).json({
      message:
        'Access denied. You must be a team member or organization owner/admin to access this resource.',
      teamId,
      organizationId,
    });
  } catch (error) {
    console.error('Team access validation error:', error);
    res.status(500).json({ message: 'Server error during access validation' });
  }
};

/**
 * Middleware to check if user can manage a team (create, update, delete)
 */
export const requireTeamManagement = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const teamId = req.params.teamId || req.query.teamId || req.body.teamId;
    const organizationId =
      req.params.organizationId ||
      req.query.organizationId ||
      req.body.organizationId ||
      user.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        message: 'Organization context required',
      });
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        memberships: {
          where: { organizationId, status: 'active' }
        }
      }
    });

    if (!fullUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const orgMembership = fullUser.memberships[0];

    if (
      orgMembership &&
      (orgMembership.role === WORKSPACE_ROLES.OWNER || orgMembership.role === WORKSPACE_ROLES.ADMIN)
    ) {
      return next();
    }

    if (teamId) {
      const team = await prisma.team.findFirst({
        where: {
          id: teamId,
          organizationId: organizationId,
          NOT: { status: 'deleted' },
        },
        include: {
          members: {
            where: { userId: user.id, status: 'active' }
          }
        }
      });

      if (!team) {
        return res.status(404).json({ message: 'Team not found' });
      }

      const isTeamOwnerOrAdmin =
        team.ownerId === user.id ||
        (team.members.length > 0 && (team.members[0].role === WORKSPACE_ROLES.OWNER || team.members[0].role === WORKSPACE_ROLES.ADMIN));

      if (isTeamOwnerOrAdmin) {
        return next();
      }

      return res.status(403).json({
        message:
          'Access denied. Only team owners/admins and organization owners/admins can manage teams.',
      });
    }

    return next();
  } catch (error) {
    console.error('Team management validation error:', error);
    res.status(500).json({ message: 'Server error during access validation' });
  }
};

import { Response, NextFunction } from 'express';
import { models } from '../index.js';
import { AuthenticatedRequest } from './auth.js';

/**
 * Middleware to check if user can access team-specific data
 */
export const requireTeamAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    if (!user || !user.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const teamId = req.params.teamId || req.query.teamId || req.body.teamId;

    if (!teamId) {
      return next();
    }

    if (!teamId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid team ID format' });
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

    const userDoc = await models.User.findById(user.userId);
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    const orgMembership = userDoc.memberships?.find(
      (m: any) =>
        m.organizationId.toString() === organizationId.toString() &&
        m.status === 'active'
    );

    if (
      orgMembership &&
      (orgMembership.role === 'owner' || orgMembership.role === 'admin')
    ) {
      return next();
    }

    const isTeamMember = userDoc.teamMemberships?.some(
      (m: any) =>
        m.teamId.toString() === teamId.toString() &&
        m.organizationId.toString() === organizationId.toString() &&
        m.status === 'active'
    );

    if (isTeamMember) {
      return next();
    }

    const team = await models.Team.findOne({
      _id: teamId,
      organizationId: organizationId,
      status: { $ne: 'deleted' },
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

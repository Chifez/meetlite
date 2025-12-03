import { models } from '../index.js';

/**
 * Middleware to check if user can access team-specific data
 * Access is granted if:
 * 1. User is organization owner/admin
 * 2. User is a member of the team
 *
 * If no teamId is present, access is allowed (organization-level access)
 */
export const requireTeamAccess = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Get teamId from params, query, or body
    const teamId = req.params.teamId || req.query.teamId || req.body.teamId;

    // If no teamId, allow access (organization-level)
    if (!teamId) {
      return next();
    }

    // Validate teamId format
    if (!teamId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid team ID format' });
    }

    // Get organizationId from params, query, body, or user's active organization
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

    // Check if user is organization owner
    // Check in user's current active organization role
    const isOrgOwner =
      user.organizationId?.toString() === organizationId.toString() &&
      user.role === 'owner';

    // Also check in memberships array
    const orgMembership = user.memberships?.find(
      (m) =>
        m.organizationId.toString() === organizationId.toString() &&
        m.status === 'active'
    );

    if (orgMembership && orgMembership.role === 'owner') {
      // User is organization owner, grant access
      return next();
    }

    // Check if user is a team member
    const isTeamMember = user.teamMemberships?.some(
      (m) =>
        m.teamId.toString() === teamId.toString() &&
        m.organizationId.toString() === organizationId.toString() &&
        m.status === 'active'
    );

    if (isTeamMember) {
      // User is team member, grant access
      return next();
    }

    // Verify team exists and belongs to the organization
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

    // User is neither org owner nor team member, deny access
    return res.status(403).json({
      message:
        'Access denied. You must be a team member or organization owner to access this resource.',
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
 * Only team owners and organization owners can manage teams
 */
export const requireTeamManagement = async (req, res, next) => {
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

    // Check if user is organization owner
    const orgMembership = user.memberships?.find(
      (m) =>
        m.organizationId.toString() === organizationId.toString() &&
        m.status === 'active'
    );

    if (orgMembership && orgMembership.role === 'owner') {
      // Organization owners can manage all teams
      return next();
    }

    // If teamId is provided, check if user is team owner
    if (teamId) {
      const team = await models.Team.findOne({
        _id: teamId,
        organizationId: organizationId,
        status: { $ne: 'deleted' },
      });

      if (!team) {
        return res.status(404).json({ message: 'Team not found' });
      }

      // Check if user is team owner
      const isTeamOwner =
        team.ownerId.toString() === user._id.toString() ||
        team.members.some(
          (m) =>
            m.userId.toString() === user._id.toString() &&
            m.role === 'owner' &&
            m.status === 'active'
        );

      if (isTeamOwner) {
        return next();
      }

      return res.status(403).json({
        message:
          'Access denied. Only team owners and organization owners can manage teams.',
      });
    }

    // For creating new teams, only organization owners can do it
    // (This will be enforced by plan validation separately)
    return next();
  } catch (error) {
    console.error('Team management validation error:', error);
    res.status(500).json({ message: 'Server error during access validation' });
  }
};

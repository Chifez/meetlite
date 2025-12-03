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

    if (!user || !user.userId) {
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

    // Fetch full user document to check teamMemberships
    const userDoc = await models.User.findById(user.userId);
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is organization owner
    const orgMembership = userDoc.memberships?.find(
      (m) =>
        m.organizationId.toString() === organizationId.toString() &&
        m.status === 'active'
    );

    if (orgMembership && orgMembership.role === 'owner') {
      // User is organization owner, grant access
      return next();
    }

    // Check if user is a team member
    const isTeamMember = userDoc.teamMemberships?.some(
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

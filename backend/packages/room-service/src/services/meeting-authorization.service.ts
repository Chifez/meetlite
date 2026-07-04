import { models } from '../index.js';

export class MeetingAuthorizationService {
  /**
   * Check if user can modify (update/delete) a meeting
   */
  static async canModify(meeting: any, userId: string, organizationId: string): Promise<boolean> {
    if (meeting.createdBy === userId) {
      return true;
    }

    const userDoc = await models.User.findById(userId);
    if (!userDoc) {
      return false;
    }

    const orgMembership = userDoc.memberships?.find(
      (m: any) =>
        m.organizationId.toString() === organizationId.toString() &&
        m.status === 'active'
    );

    const isOrgOwnerOrAdmin =
      orgMembership &&
      (orgMembership.role === 'owner' || orgMembership.role === 'admin');

    if (isOrgOwnerOrAdmin) {
      return true;
    }

    if (meeting.teamId && organizationId) {
      const team = await models.Team.findOne({
        _id: meeting.teamId,
        organizationId: organizationId,
        status: { $ne: 'deleted' },
      });

      if (team) {
        if (team.ownerId.toString() === userId.toString()) {
          return true;
        }

        const isTeamAdmin = userDoc.teamMemberships?.some(
          (m: any) =>
            m.teamId.toString() === meeting.teamId.toString() &&
            m.organizationId.toString() === organizationId.toString() &&
            m.role === 'admin' &&
            m.status === 'active'
        );

        if (isTeamAdmin) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if user can access (view/get) a meeting
   */
  static async canAccess(meeting: any, userId: string, userEmail: string, organizationId: string): Promise<boolean> {
    if (meeting.createdBy === userId) {
      return true;
    }

    const userDoc = await models.User.findById(userId);
    if (!userDoc) {
      return false;
    }

    const userInvite = meeting.invites?.find(
      (invite: any) => invite.email === userEmail && invite.status !== 'declined'
    );
    if (userInvite) {
      return true;
    }

    const orgMembership = userDoc.memberships?.find(
      (m: any) =>
        m.organizationId.toString() === organizationId.toString() &&
        m.status === 'active'
    );

    const isOrgOwnerOrAdmin =
      orgMembership &&
      (orgMembership.role === 'owner' || orgMembership.role === 'admin');

    if (isOrgOwnerOrAdmin) {
      return true;
    }

    if (meeting.teamId && organizationId) {
      const isTeamMember = userDoc.teamMemberships?.some(
        (m: any) =>
          m.teamId.toString() === meeting.teamId.toString() &&
          m.organizationId.toString() === organizationId.toString() &&
          m.status === 'active'
      );

      if (isTeamMember) {
        const isParticipant =
          meeting.invites?.some(
            (invite: any) => invite.email === userEmail && invite.status !== 'declined'
          ) || meeting.participants?.includes(userId);

        return isParticipant;
      }
    }

    if (meeting.privacy === 'public') {
      return true;
    }

    return false;
  }
}
export default MeetingAuthorizationService;

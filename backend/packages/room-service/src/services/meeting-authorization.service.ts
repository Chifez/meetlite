import { prisma } from '@minimeet/shared';
import { WORKSPACE_ROLES } from '@minimeet/shared';


export class MeetingAuthorizationService {
  /**
   * Check if user can modify (update/delete) a meeting
   */
  static async canModify(meeting: any, userId: string, organizationId: string): Promise<boolean> {
    if (meeting.createdBy === userId) {
      return true;
    }

    const userDoc = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: true,
        teamMemberships: true,
      }
    });
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
      (orgMembership.role === WORKSPACE_ROLES.OWNER || orgMembership.role === WORKSPACE_ROLES.ADMIN);

    if (isOrgOwnerOrAdmin) {
      return true;
    }

    if (meeting.teamId && organizationId) {
      const team = await prisma.team.findFirst({
        where: {
          id: meeting.teamId,
          organizationId: organizationId,
          status: { not: 'deleted' },
        }
      });

      if (team) {
        if (team.ownerId.toString() === userId.toString()) {
          return true;
        }

        const isTeamAdmin = userDoc.teamMemberships?.some(
          (m: any) =>
            m.teamId.toString() === meeting.teamId.toString() &&
            m.organizationId.toString() === organizationId.toString() &&
            m.role === WORKSPACE_ROLES.ADMIN &&
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

    const userDoc = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: true,
        teamMemberships: true,
      }
    });
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
      (orgMembership.role === WORKSPACE_ROLES.OWNER || orgMembership.role === WORKSPACE_ROLES.ADMIN);

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
          ) || meeting.participants?.some((p: any) => p.userId === userId);

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

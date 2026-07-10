import { prisma } from '@minimeet/shared';

export class OrganizationMemberService {
  async checkOrganizationOwner(userId: any, organizationId: any) {
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        ownerId: userId,
        status: 'active',
      }
    });
    return organization;
  }
}

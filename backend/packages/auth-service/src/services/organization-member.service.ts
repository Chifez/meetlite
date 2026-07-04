import { models } from '../index.js';

export class OrganizationMemberService {
  async checkOrganizationOwner(userId: any, organizationId: any) {
    const organization = await models.Organization.findOne({
      _id: organizationId,
      ownerId: userId,
      status: 'active',
    });
    return organization;
  }
}

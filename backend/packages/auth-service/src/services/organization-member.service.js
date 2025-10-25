import { models } from '../index.js';

export class OrganizationMemberService {
  // Helper function to check if user is organization owner
  async checkOrganizationOwner(userId, organizationId) {
    const organization = await models.Organization.findOne({
      _id: organizationId,
      ownerId: userId,
      status: 'active',
    });
    return organization;
  }
}

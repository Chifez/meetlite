import { models } from '../index.js';
import { generateJWTToken } from '../utils/generate-token.js';
import { ResponseHelpers, AppError } from '@minimeet/shared';

export class OrganizationController {
  // GET /organizations - List user's organizations (owned + member)
  async listOrganizations(req, res) {
    const userId = req.user._id;

    // Get the user's memberships to find all organizations they belong to
    const user = await models.User.findById(userId).lean();
    const membershipOrgIds = (user?.memberships || [])
      .filter((m) => m.status !== 'inactive' && m.status !== 'removed')
      .map((m) => m.organizationId);

    // Get organizations where user is owner
    const ownedOrgs = await models.Organization.find({
      ownerId: userId,
      status: 'active',
    }).sort({ createdAt: -1 });

    // Get organizations where user is a member (from memberships array)
    // Exclude organizations the user already owns to avoid duplicates
    const ownedOrgIds = ownedOrgs.map((org) => org._id.toString());
    const memberOnlyOrgIds = membershipOrgIds.filter(
      (orgId) => !ownedOrgIds.includes(orgId.toString())
    );

    const memberOrgs = await models.Organization.find({
      _id: { $in: memberOnlyOrgIds },
      status: 'active',
    }).sort({ createdAt: -1 });

    // Create a map of membership roles for quick lookup
    const membershipRoleMap = new Map(
      (user?.memberships || []).map((m) => [m.organizationId.toString(), m.role])
    );

    // Combine and format organizations
    const organizations = [...ownedOrgs, ...memberOrgs].map((org) => {
      const isOwner = org.ownerId.toString() === userId.toString();
      const membershipRole = membershipRoleMap.get(org._id.toString());
      
      return {
        id: org._id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
        industry: org.industry,
        size: org.size,
        plan: org.plan,
        role: isOwner ? 'owner' : membershipRole || 'member',
        memberCount: org.stats.totalMembers,
        settings: org.settings,
        createdAt: org.createdAt,
      };
    });

    return ResponseHelpers.ok(res, { organizations });
  }

  // POST /organizations - Create new organization
  async createOrganization(req, res) {
    const { name, description, industry, size } = req.body;
    const userId = req.user._id;

    // Validation
    if (!name || name.trim().length < 2) {
      throw AppError.validation(
        'Organization name must be at least 2 characters'
      );
    }

    if (name.length > 100) {
      throw AppError.validation(
        'Organization name must be less than 100 characters'
      );
    }

    // Prevent free plan users from creating organizations
    if (req.user.plan.type === 'free') {
      const forbiddenError = AppError.forbidden(
        'Organization creation is not available on the free plan. Please upgrade to create organizations.'
      );
      forbiddenError.upgradeRequired = true;
      forbiddenError.currentPlan = 'free';
      throw forbiddenError;
    }

    // Check if user already owns the maximum number of organizations
    const ownedOrgsCount = await models.Organization.countDocuments({
      ownerId: userId,
      status: 'active',
    });

    const maxOrgsAllowed = 10; // Paid users can own up to 10 orgs
    if (ownedOrgsCount >= maxOrgsAllowed) {
      throw AppError.validation(
        `You can only create ${maxOrgsAllowed} organizations on your current plan`
      );
    }

    // Create organization with owner's plan
    const organization = new models.Organization({
      name: name.trim(),
      description: description?.trim(),
      industry: industry?.trim(),
      size,
      ownerId: userId,
      plan: {
        type: req.user.plan.type, // Inherit owner's plan
        startDate: req.user.plan.startDate || new Date(),
        endDate: req.user.plan.endDate || null,
        status: req.user.plan.status || 'active',
      },
      stats: {
        totalMembers: 1, // Owner is the first member
      },
    });

    await organization.save();

    // Update user to be part of this organization and increment token version
    const updatedUser = await models.User.findByIdAndUpdate(
      userId,
      {
        organizationId: organization._id,
        role: 'owner',
        onboardingCompleted: true, // Mark onboarding as completed
        $inc: { tokenVersion: 1 }, // Invalidate old tokens
      },
      { new: true }
    );

    // Generate new token with organization context
    const newToken = generateJWTToken(updatedUser);

    res.status(201).json({
      organization: {
        id: organization._id,
        name: organization.name,
        slug: organization.slug,
        description: organization.description,
        logo: organization.logo,
        industry: organization.industry,
        size: organization.size,
        plan: organization.plan,
        role: 'owner',
        memberCount: 1,
        settings: organization.settings,
        createdAt: organization.createdAt,
      },
      token: newToken, // Return new token
    });
  }

  // GET /organizations/:orgId - Get organization details
  async getOrganization(req, res) {
    const { orgId } = req.params;
    const userId = req.user._id;

    const organization = await models.Organization.findOne({
      _id: orgId,
      status: 'active',
    });

    if (!organization) {
      throw AppError.notFound('Organization');
    }

    // Check if user has access (owner or member)
    const isOwner = organization.ownerId.toString() === userId.toString();
    const isMember = req.user.organizationId?.toString() === orgId;

    if (!isOwner && !isMember) {
      throw AppError.forbidden('Access denied to this organization');
    }

    // Get member list if user is owner
    let members = [];
    if (isOwner) {
      members = await models.User.find({
        organizationId: orgId,
      })
        .select('_id name email role createdAt')
        .sort({ createdAt: -1 });
    }

    res.json({
      organization: {
        id: organization._id,
        name: organization.name,
        slug: organization.slug,
        description: organization.description,
        logo: organization.logo,
        industry: organization.industry,
        size: organization.size,
        plan: organization.plan,
        role: isOwner ? 'owner' : 'member',
        memberCount: organization.stats.totalMembers,
        settings: organization.settings,
        limits: organization.limits,
        stats: organization.stats,
        members: isOwner ? members : undefined,
        createdAt: organization.createdAt,
      },
    });
  }

  // PUT /organizations/:orgId - Update organization (owner only)
  async updateOrganization(req, res) {
    const { orgId } = req.params;
    const { name, description, industry, size, settings } = req.body;
    const userId = req.user._id;

    const organization = await models.Organization.findOne({
      _id: orgId,
      ownerId: userId,
      status: 'active',
    });

    if (!organization) {
      throw AppError.notFound('Organization');
    }

    // Update fields
    if (name && name.trim().length >= 2) {
      organization.name = name.trim();
    }
    if (description !== undefined) {
      organization.description = description?.trim();
    }
    if (industry) {
      organization.industry = industry.trim();
    }
    if (size) {
      organization.size = size;
    }
    if (settings) {
      organization.settings = { ...organization.settings, ...settings };
    }

    await organization.save();

    res.json({
      organization: {
        id: organization._id,
        name: organization.name,
        slug: organization.slug,
        description: organization.description,
        logo: organization.logo,
        industry: organization.industry,
        size: organization.size,
        plan: organization.plan,
        role: 'owner',
        memberCount: organization.stats.totalMembers,
        settings: organization.settings,
        createdAt: organization.createdAt,
      },
    });
  }

  // POST /organizations/:orgId/leave - Leave organization (members only)
  async leaveOrganization(req, res) {
    const { orgId } = req.params;
    const userId = req.user._id;

    const organization = await models.Organization.findOne({
      _id: orgId,
      status: 'active',
    });

    if (!organization) {
      throw AppError.notFound('Organization');
    }

    // Check if user is owner (owners cannot leave, they must transfer ownership first)
    if (organization.ownerId.toString() === userId.toString()) {
      throw AppError.validation(
        'Organization owners cannot leave. Transfer ownership first or delete the organization.'
      );
    }

    // Check if user is actually a member
    if (req.user.organizationId?.toString() !== orgId) {
      throw AppError.validation('You are not a member of this organization');
    }

    // Remove user from organization and increment token version
    const updatedUser = await models.User.findByIdAndUpdate(
      userId,
      {
        $unset: { organizationId: 1 },
        role: 'owner', // Reset to default personal account role
        $inc: { tokenVersion: 1 }, // Invalidate old tokens
      },
      { new: true }
    );

    // Update organization member count
    await models.Organization.findByIdAndUpdate(orgId, {
      $inc: { 'stats.totalMembers': -1 },
    });

    // Generate new token for personal account
    const newToken = generateJWTToken(updatedUser);

    res.json({
      message: 'Successfully left organization',
      token: newToken, // Return new token for personal account
    });
  }

  // DELETE /organizations/:orgId - Delete organization (owner only)
  async deleteOrganization(req, res) {
    const { orgId } = req.params;
    const userId = req.user._id;

    const organization = await models.Organization.findOne({
      _id: orgId,
      ownerId: userId,
      status: 'active',
    });

    if (!organization) {
      throw AppError.notFound('Organization');
    }

    // Get all members and switch them to personal accounts
    const members = await models.User.find({
      organizationId: orgId,
    });

    // Remove all members from organization and increment their token versions
    for (const member of members) {
      await models.User.findByIdAndUpdate(member._id, {
        $unset: { organizationId: 1 },
        role: 'owner', // Reset to personal account role
        $inc: { tokenVersion: 1 }, // Invalidate tokens
      });
    }

    // Soft delete the organization
    await models.Organization.findByIdAndUpdate(orgId, {
      status: 'deleted',
      deletedAt: new Date(),
    });

    // TODO: In a production app, you'd also need to:
    // - Delete or archive all organization data (meetings, recordings, etc.)
    // - Handle billing and subscriptions
    // - Send notifications to members

    // Get updated user for token generation
    const updatedOwner = await models.User.findById(userId);
    const newToken = generateJWTToken(updatedOwner);

    res.json({
      message: 'Organization deleted successfully',
      token: newToken, // Return new token for personal account
    });
  }
}

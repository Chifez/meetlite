import { Request, Response } from 'express';
import { models } from '../index.js';
import { generateJWTToken } from '../utils/generate-token.js';
import { ResponseHelpers, AppError } from '@minimeet/shared';

export class OrganizationController {
  // GET /organizations - List user's organizations (owned + member)
  async listOrganizations(req: any, res: Response) {
    const userId = req.user._id;

    // Get the user's memberships to find all organizations they belong to
    const user = await models.User.findById(userId).lean();
    const membershipOrgIds = (user?.memberships || [])
      .filter((m: any) => m.status !== 'inactive' && m.status !== 'removed')
      .map((m: any) => m.organizationId);

    // Get organizations where user is owner
    const ownedOrgs = await models.Organization.find({
      ownerId: userId,
      status: 'active',
    }).sort({ createdAt: -1 });

    // Get organizations where user is a member (from memberships array)
    const ownedOrgIds = ownedOrgs.map((org: any) => org._id.toString());
    const memberOnlyOrgIds = membershipOrgIds.filter(
      (orgId: any) => !ownedOrgIds.includes(orgId.toString())
    );

    const memberOrgs = await models.Organization.find({
      _id: { $in: memberOnlyOrgIds },
      status: 'active',
    }).sort({ createdAt: -1 });

    // Create a map of membership roles for quick lookup
    const membershipRoleMap = new Map(
      (user?.memberships || []).map((m: any) => [m.organizationId.toString(), m.role])
    );

    // Combine and format organizations
    const organizations = [...ownedOrgs, ...memberOrgs].map((org: any) => {
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
  async createOrganization(req: any, res: Response) {
    const { name, description, industry, size } = req.body;
    const userId = req.user._id;

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

    if (req.user.plan.type === 'free') {
      const forbiddenError = AppError.forbidden(
        'Organization creation is not available on the free plan. Please upgrade to create organizations.'
      );
      (forbiddenError as any).upgradeRequired = true;
      (forbiddenError as any).currentPlan = 'free';
      throw forbiddenError;
    }

    const ownedOrgsCount = await models.Organization.countDocuments({
      ownerId: userId,
      status: 'active',
    });

    const maxOrgsAllowed = 10;
    if (ownedOrgsCount >= maxOrgsAllowed) {
      throw AppError.validation(
        `You can only create ${maxOrgsAllowed} organizations on your current plan`
      );
    }

    const organization = new models.Organization({
      name: name.trim(),
      description: description?.trim(),
      industry: industry?.trim(),
      size,
      ownerId: userId,
      plan: {
        type: req.user.plan.type,
        startDate: req.user.plan.startDate || new Date(),
        endDate: req.user.plan.endDate || null,
        status: req.user.plan.status || 'active',
      },
      stats: {
        totalMembers: 1,
      },
    });

    await organization.save();

    const updatedUser = await models.User.findByIdAndUpdate(
      userId,
      {
        organizationId: organization._id,
        role: 'owner',
        onboardingCompleted: true,
        $inc: { tokenVersion: 1 },
      },
      { new: true }
    );

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
      token: newToken,
    });
  }

  // GET /organizations/:orgId - Get organization details
  async getOrganization(req: any, res: Response) {
    const { orgId } = req.params;
    const userId = req.user._id;

    const organization = await models.Organization.findOne({
      _id: orgId,
      status: 'active',
    });

    if (!organization) {
      throw AppError.notFound('Organization');
    }

    const isOwner = organization.ownerId.toString() === userId.toString();
    const isMember = req.user.organizationId?.toString() === orgId;

    if (!isOwner && !isMember) {
      throw AppError.forbidden('Access denied to this organization');
    }

    let members: any[] = [];
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
  async updateOrganization(req: any, res: Response) {
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
  async leaveOrganization(req: any, res: Response) {
    const { orgId } = req.params;
    const userId = req.user._id;

    const organization = await models.Organization.findOne({
      _id: orgId,
      status: 'active',
    });

    if (!organization) {
      throw AppError.notFound('Organization');
    }

    if (organization.ownerId.toString() === userId.toString()) {
      throw AppError.validation(
        'Organization owners cannot leave. Transfer ownership first or delete the organization.'
      );
    }

    if (req.user.organizationId?.toString() !== orgId) {
      throw AppError.validation('You are not a member of this organization');
    }

    const updatedUser = await models.User.findByIdAndUpdate(
      userId,
      {
        $unset: { organizationId: 1 },
        role: 'owner',
        $inc: { tokenVersion: 1 },
      },
      { new: true }
    );

    await models.Organization.findByIdAndUpdate(orgId, {
      $inc: { 'stats.totalMembers': -1 },
    });

    const newToken = generateJWTToken(updatedUser);

    res.json({
      message: 'Successfully left organization',
      token: newToken,
    });
  }

  // DELETE /organizations/:orgId - Delete organization (owner only)
  async deleteOrganization(req: any, res: Response) {
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

    const members = await models.User.find({
      organizationId: orgId,
    });

    for (const member of members) {
      await models.User.findByIdAndUpdate(member._id, {
        $unset: { organizationId: 1 },
        role: 'owner',
        $inc: { tokenVersion: 1 },
      });
    }

    await models.Organization.findByIdAndUpdate(orgId, {
      status: 'deleted',
      deletedAt: new Date(),
    });

    const updatedOwner = await models.User.findById(userId);
    const newToken = generateJWTToken(updatedOwner);

    res.json({
      message: 'Organization deleted successfully',
      token: newToken,
    });
  }
}

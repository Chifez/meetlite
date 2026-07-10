import { Request, Response } from 'express';
import { prisma } from '@minimeet/shared';
import { generateJWTToken } from '../utils/generate-token.js';
import { ResponseHelpers, AppError, StorageService } from '@minimeet/shared';

export class OrganizationController {
  // GET /organizations - List user's organizations (owned + member)
  async listOrganizations(req: any, res: Response) {
    const userId = req.user.id || req.user._id;

    // Get the user's memberships to find all organizations they belong to
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: true }
    });
    const membershipOrgIds = (user?.memberships || [])
      .filter((m: any) => m.status !== 'inactive' && m.status !== 'removed')
      .map((m: any) => m.organizationId);

    // Get organizations where user is owner
    const ownedOrgs = await prisma.organization.findMany({
      where: {
        ownerId: userId,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get organizations where user is a member (from memberships array)
    const ownedOrgIds = ownedOrgs.map((org: any) => org.id);
    const memberOnlyOrgIds = membershipOrgIds.filter(
      (orgId: any) => !ownedOrgIds.includes(orgId)
    );

    const memberOrgs = await prisma.organization.findMany({
      where: {
        id: { in: memberOnlyOrgIds },
        status: 'active',
      },
      orderBy: { createdAt: 'desc' }
    });

    // Create a map of membership roles for quick lookup
    const membershipRoleMap = new Map(
      (user?.memberships || []).map((m: any) => [m.organizationId, m.role])
    );

    // Combine and format organizations
    const organizations = [...ownedOrgs, ...memberOrgs].map((org: any) => {
      const isOwner = org.ownerId === userId;
      const membershipRole = membershipRoleMap.get(org.id);
      
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
        industry: org.industry,
        size: org.size,
        plan: {
          type: org.planType,
          status: org.planStatus,
          startDate: org.planStartDate,
          endDate: org.planEndDate,
        },
        role: isOwner ? 'owner' : membershipRole || 'member',
        memberCount: org.statsTotalMembers,
        settings: {
          allowPublicMeetings: org.allowPublicMeetings,
          requireMeetingApproval: org.requireMeetingApproval,
          maxMeetingDuration: org.maxMeetingDuration,
          allowExternalParticipants: org.allowExternalParticipants,
          defaultMeetingPrivacy: org.defaultMeetingPrivacy,
        },
        createdAt: org.createdAt,
      };
    });

    return ResponseHelpers.ok(res, { organizations });
  }

  // POST /organizations - Create new organization
  async createOrganization(req: any, res: Response) {
    const { name, description, industry, size } = req.body;
    const userId = req.user.id || req.user._id;

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

    if (req.user.plan?.type === 'free' || req.user.planType === 'free') {
      const forbiddenError = AppError.forbidden(
        'Organization creation is not available on the free plan. Please upgrade to create organizations.'
      );
      (forbiddenError as any).upgradeRequired = true;
      (forbiddenError as any).currentPlan = 'free';
      throw forbiddenError;
    }

    const ownedOrgsCount = await prisma.organization.count({
      where: {
        ownerId: userId,
        status: 'active',
      }
    });

    const maxOrgsAllowed = 10;
    if (ownedOrgsCount >= maxOrgsAllowed) {
      throw AppError.validation(
        `You can only create ${maxOrgsAllowed} organizations on your current plan`
      );
    }

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 8);

    const organization = await prisma.organization.create({
      data: {
        name: name.trim(),
        slug,
        description: description?.trim(),
        industry: industry?.trim(),
        size,
        ownerId: userId,
        planType: req.user.plan?.type || req.user.planType || 'free',
        planStartDate: req.user.plan?.startDate || req.user.planStartDate || new Date(),
        planEndDate: req.user.plan?.endDate || req.user.planEndDate || null,
        planStatus: req.user.plan?.status || req.user.planStatus || 'active',
        statsTotalMembers: 1,
      }
    });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: organization.id,
        role: 'owner',
        onboardingCompleted: true,
        tokenVersion: { increment: 1 },
      }
    });

    const newToken = generateJWTToken(updatedUser);

    res.status(201).json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        description: organization.description,
        logo: organization.logo,
        industry: organization.industry,
        size: organization.size,
        plan: {
          type: organization.planType,
          status: organization.planStatus,
          startDate: organization.planStartDate,
          endDate: organization.planEndDate,
        },
        role: 'owner',
        memberCount: 1,
        settings: {
          allowPublicMeetings: organization.allowPublicMeetings,
          requireMeetingApproval: organization.requireMeetingApproval,
          maxMeetingDuration: organization.maxMeetingDuration,
          allowExternalParticipants: organization.allowExternalParticipants,
          defaultMeetingPrivacy: organization.defaultMeetingPrivacy,
        },
        createdAt: organization.createdAt,
      },
      token: newToken,
    });
  }

  // GET /organizations/:orgId - Get organization details
  async getOrganization(req: any, res: Response) {
    const { orgId } = req.params;
    const userId = req.user.id || req.user._id;

    const organization = await prisma.organization.findFirst({
      where: {
        id: orgId,
        status: 'active',
      }
    });

    if (!organization) {
      throw AppError.notFound('Organization');
    }

    const isOwner = organization.ownerId === userId;
    const isMember = req.user.organizationId === orgId;

    if (!isOwner && !isMember) {
      throw AppError.forbidden('Access denied to this organization');
    }

    let members: any[] = [];
    if (isOwner) {
      members = await prisma.user.findMany({
        where: {
          organizationId: orgId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    res.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        description: organization.description,
        logo: organization.logo,
        industry: organization.industry,
        size: organization.size,
        plan: {
          type: organization.planType,
          status: organization.planStatus,
          startDate: organization.planStartDate,
          endDate: organization.planEndDate,
        },
        role: isOwner ? 'owner' : 'member',
        memberCount: organization.statsTotalMembers,
        settings: {
          allowPublicMeetings: organization.allowPublicMeetings,
          requireMeetingApproval: organization.requireMeetingApproval,
          maxMeetingDuration: organization.maxMeetingDuration,
          allowExternalParticipants: organization.allowExternalParticipants,
          defaultMeetingPrivacy: organization.defaultMeetingPrivacy,
        },
        limits: {
          maxMembers: organization.limitMaxMembers,
          maxMeetingsMonth: organization.limitMaxMeetingsMonth,
          maxStorageGb: organization.limitMaxStorageGb,
        },
        stats: {
          totalMembers: organization.statsTotalMembers,
          totalMeetings: organization.statsTotalMeetings,
          totalHours: organization.statsTotalHours,
        },
        members: isOwner ? members.map((m: any) => ({ ...m, _id: m.id })) : undefined,
        createdAt: organization.createdAt,
      },
    });
  }
  // GET /organizations/:orgId/upload-url - Generate a presigned URL for logo upload
  async getUploadUrl(req: any, res: Response) {
    const { orgId } = req.params;
    const userId = req.user.id || req.user._id;
    const { contentType, fileExtension } = req.query;

    if (!contentType || !fileExtension) {
      throw AppError.validation('Content type and file extension are required');
    }

    const organization = await prisma.organization.findFirst({
      where: {
        id: orgId,
        ownerId: userId,
        status: 'active',
      }
    });

    if (!organization) {
      throw AppError.forbidden('Only the organization owner can upload a logo');
    }

    if (!StorageService.isConfigured()) {
      throw AppError.internal('Storage service is not configured');
    }

    const bucket = process.env.LOGO_UPLOAD_BUCKET || 'minimeet-recordings';
    const key = `organizations/${orgId}/logo-${Date.now()}.${fileExtension}`;
    
    const uploadUrl = await StorageService.generatePresignedUploadUrl(
      bucket,
      key,
      contentType as string
    );

    const publicUrl = StorageService.getPublicUrl(bucket, key);

    res.json({
      uploadUrl,
      publicUrl,
      key,
    });
  }


  // PUT /organizations/:orgId - Update organization (owner only)
  async updateOrganization(req: any, res: Response) {
    const { orgId } = req.params;
    const { name, description, industry, size, settings } = req.body;
    const userId = req.user.id || req.user._id;

    const organization = await prisma.organization.findFirst({
      where: {
        id: orgId,
        ownerId: userId,
        status: 'active',
      }
    });

    if (!organization) {
      throw AppError.notFound('Organization');
    }

    const updateData: any = {};
    if (name && name.trim().length >= 2) {
      updateData.name = name.trim();
    }
    if (description !== undefined) {
      updateData.description = description?.trim();
    }
    if (industry) {
      updateData.industry = industry.trim();
    }
    if (size) {
      updateData.size = size;
    }
    if (settings) {
      if (settings.allowPublicMeetings !== undefined) updateData.allowPublicMeetings = settings.allowPublicMeetings;
      if (settings.requireMeetingApproval !== undefined) updateData.requireMeetingApproval = settings.requireMeetingApproval;
      if (settings.maxMeetingDuration !== undefined) updateData.maxMeetingDuration = settings.maxMeetingDuration;
      if (settings.allowExternalParticipants !== undefined) updateData.allowExternalParticipants = settings.allowExternalParticipants;
      if (settings.defaultMeetingPrivacy !== undefined) updateData.defaultMeetingPrivacy = settings.defaultMeetingPrivacy;
    }

    const updatedOrganization = await prisma.organization.update({
      where: { id: orgId },
      data: updateData
    });

    res.json({
      organization: {
        id: updatedOrganization.id,
        name: updatedOrganization.name,
        slug: updatedOrganization.slug,
        description: updatedOrganization.description,
        logo: updatedOrganization.logo,
        industry: updatedOrganization.industry,
        size: updatedOrganization.size,
        plan: {
          type: updatedOrganization.planType,
          status: updatedOrganization.planStatus,
          startDate: updatedOrganization.planStartDate,
          endDate: updatedOrganization.planEndDate,
        },
        role: 'owner',
        memberCount: updatedOrganization.statsTotalMembers,
        settings: {
          allowPublicMeetings: updatedOrganization.allowPublicMeetings,
          requireMeetingApproval: updatedOrganization.requireMeetingApproval,
          maxMeetingDuration: updatedOrganization.maxMeetingDuration,
          allowExternalParticipants: updatedOrganization.allowExternalParticipants,
          defaultMeetingPrivacy: updatedOrganization.defaultMeetingPrivacy,
        },
        createdAt: updatedOrganization.createdAt,
      },
    });
  }

  // POST /organizations/:orgId/leave - Leave organization (members only)
  async leaveOrganization(req: any, res: Response) {
    const { orgId } = req.params;
    const userId = req.user.id || req.user._id;

    const organization = await prisma.organization.findFirst({
      where: {
        id: orgId,
        status: 'active',
      }
    });

    if (!organization) {
      throw AppError.notFound('Organization');
    }

    if (organization.ownerId === userId) {
      throw AppError.validation(
        'Organization owners cannot leave. Transfer ownership first or delete the organization.'
      );
    }

    if (req.user.organizationId !== orgId) {
      throw AppError.validation('You are not a member of this organization');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: null,
        role: 'owner',
        tokenVersion: { increment: 1 },
      }
    });

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        statsTotalMembers: { decrement: 1 },
      }
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
    const userId = req.user.id || req.user._id;

    const organization = await prisma.organization.findFirst({
      where: {
        id: orgId,
        ownerId: userId,
        status: 'active',
      }
    });

    if (!organization) {
      throw AppError.notFound('Organization');
    }

    await prisma.user.updateMany({
      where: { organizationId: orgId },
      data: {
        organizationId: null,
        role: 'owner',
        tokenVersion: { increment: 1 },
      }
    });

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        status: 'deleted',
        // deletedAt is not standard in prisma, just status is fine
      }
    });

    const updatedOwner = await prisma.user.findUnique({ where: { id: userId } });
    const newToken = generateJWTToken(updatedOwner);

    res.json({
      message: 'Organization deleted successfully',
      token: newToken,
    });
  }
}

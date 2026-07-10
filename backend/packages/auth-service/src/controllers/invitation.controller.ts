import { Request, Response } from 'express';
// @ts-ignore
import jwt from 'jsonwebtoken';
import { prisma } from '@minimeet/shared';
import { generateJWTToken } from '../utils/generate-token.js';
import {
  PlanValidationService,
  ResponseHelpers,
  AppError,
} from '@minimeet/shared';
// @ts-ignore
import { MultiOrganizationService } from '../services/multi-organization.service.js';

export class InvitationController {
  // GET /invitations/:token - Get invitation details (public route)
  async getInvitationDetails(req: Request, res: Response) {
    const { token } = req.params;

    const invitation = await prisma.organizationInvitation.findUnique({
      where: { inviteToken: token },
      include: {
        organization: true,
        inviter: true,
      }
    });

    if (!invitation) {
      throw AppError.notFound('Invitation');
    }

    const canBeAccepted = invitation.status === 'pending' && invitation.expiresAt > new Date();

    // Return invitation details without sensitive information
    return ResponseHelpers.ok(res, {
      invitation: {
        id: invitation.id,
        organizationName: invitation.organization.name,
        organizationLogo: invitation.organization.logo,
        inviterName: invitation.inviter.name || invitation.inviter.email,
        role: invitation.role,
        message: invitation.message,
        expiresAt: invitation.expiresAt,
      },
      isValid: canBeAccepted,
    });
  }

  // POST /invitations/:token/accept - Accept invitation (requires auth)
  async acceptInvitation(req: Request, res: Response) {
    const { token } = req.params;
    const authHeader = req.headers['authorization'];
    const authToken = authHeader && authHeader.split(' ')[1];

    if (!authToken) {
      throw AppError.unauthorized('Authentication required');
    }

    // Verify JWT token
    let userId: any;
    try {
      const decoded: any = jwt.verify(authToken, process.env.JWT_SECRET!);
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) {
        throw AppError.notFound('User');
      }
      userId = user.id;
    } catch (jwtError) {
      throw AppError.unauthorized('Invalid authentication token');
    }

    // Find invitation by token
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { inviteToken: token },
      include: {
        organization: true,
      }
    });
    if (!invitation) {
      throw AppError.notFound('Invitation');
    }

    // Get user for email check
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw AppError.notFound('User');
    }

    // Check if invitation email matches user email
    if (invitation.email !== user.email.toLowerCase()) {
      throw AppError.forbidden('This invitation is for a different email address');
    }

    // Check if invitation can be accepted
    const canBeAccepted = invitation.status === 'pending' && invitation.expiresAt > new Date();
    if (!canBeAccepted) {
      throw AppError.validation('Invitation cannot be accepted (expired or already processed)');
    }

    // 1. Validate plan constraints for invitation acceptance
    const acceptanceValidation =
      await PlanValidationService.validateInvitationAcceptance(
        userId,
        invitation.organizationId,
        invitation.role,
        prisma
      );
    if (!acceptanceValidation.isValid) {
      const forbiddenError = AppError.forbidden(acceptanceValidation.message);
      (forbiddenError as any).upgradeRequired = acceptanceValidation.upgradeRequired;
      (forbiddenError as any).currentPlan = acceptanceValidation.currentPlan;
      (forbiddenError as any).currentUsage = acceptanceValidation.currentUsage;
      (forbiddenError as any).limit = acceptanceValidation.limit;
      throw forbiddenError;
    }

    // 2. Validate organization capacity based on owner's plan
    const capacityValidation =
      await PlanValidationService.validateOrganizationCapacity(
        invitation.organizationId,
        prisma
      );
    if (!capacityValidation.isValid) {
      const forbiddenError = AppError.forbidden(capacityValidation.message);
      (forbiddenError as any).upgradeRequired = capacityValidation.upgradeRequired;
      (forbiddenError as any).organizationPlan = capacityValidation.organizationPlan;
      (forbiddenError as any).currentMembers = capacityValidation.currentMembers;
      (forbiddenError as any).maxMembers = capacityValidation.maxMembers;
      throw forbiddenError;
    }

    // Accept invitation
    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'accepted',
        acceptedBy: userId,
        acceptedAt: new Date()
      }
    });

    // Add user to organization using multi-organization service
    const updatedUser: any =
      await MultiOrganizationService.addUserToOrganization(
        userId,
        invitation.organizationId,
        invitation.role,
        invitation.invitedBy
      );

    // Increment token version for security
    await prisma.user.update({
      where: { id: userId },
      data: {
        tokenVersion: { increment: 1 }
      }
    });
    updatedUser.tokenVersion = (updatedUser.tokenVersion || 1) + 1;

    // Update organization member count
    await prisma.organization.update({
      where: { id: invitation.organizationId },
      data: {
        statsTotalMembers: { increment: 1 }
      }
    });

    // 3. Update user's membership usage after successful acceptance
    await PlanValidationService.updateMembershipUsage(
      userId,
      invitation.role,
      prisma
    );

    // Generate new token with organization context
    const newToken = generateJWTToken(updatedUser);

    return ResponseHelpers.ok(
      res,
      {
        organization: {
          id: invitation.organizationId,
          name: invitation.organization.name,
          role: invitation.role,
        },
        token: newToken,
      },
      'Invitation accepted successfully'
    );
  }

  // POST /invitations/:token/decline - Decline invitation (public route)
  async declineInvitation(req: Request, res: Response) {
    const { token } = req.params;

    const invitation = await prisma.organizationInvitation.findUnique({
      where: { inviteToken: token }
    });

    if (!invitation) {
      throw AppError.notFound('Invitation');
    }

    // Check if invitation can be declined
    if (invitation.status !== 'pending') {
      throw AppError.validation('Invitation cannot be declined (already processed)');
    }

    // Decline invitation
    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: 'declined' }
    });

    return ResponseHelpers.ok(res, null, 'Invitation declined successfully');
  }
}

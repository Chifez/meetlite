import jwt from 'jsonwebtoken';
import { models } from '../index.js';
import { generateJWTToken } from '../utils/generate-token.js';
import {
  PlanValidationService,
  ResponseHelpers,
  AppError,
} from '@minimeet/shared';

import { MultiOrganizationService } from '../services/multi-organization.service.js';

export class InvitationController {
  // GET /invitations/:token - Get invitation details (public route)
  async getInvitationDetails(req, res) {
    const { token } = req.params;

    // Find invitation by token
    const invitation = await models.OrganizationInvitation.findByToken(token);

    if (!invitation) {
      throw AppError.notFound('Invitation');
    }

    // Return invitation details without sensitive information
    return ResponseHelpers.ok(res, {
      invitation: {
        id: invitation._id,
        organizationName: invitation.organizationId.name,
        organizationLogo: invitation.organizationId.logo,
        inviterName: invitation.invitedBy.name || invitation.invitedBy.email,
        role: invitation.role,
        message: invitation.message,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
      isValid: invitation.canBeAccepted(),
    });
  }

  // POST /invitations/:token/accept - Accept invitation (requires auth)
  async acceptInvitation(req, res) {
    const { token } = req.params;
    const authHeader = req.headers['authorization'];
    const authToken = authHeader && authHeader.split(' ')[1];

    if (!authToken) {
      throw AppError.unauthorized('Authentication required');
    }

    // Verify JWT token
    let userId;
    try {
      const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
      const user = await models.User.findById(decoded.userId);
      if (!user) {
        throw AppError.notFound('User');
      }
      userId = user._id;
    } catch (jwtError) {
      throw AppError.unauthorized('Invalid authentication token');
    }

    // Find invitation by token
    const invitation = await models.OrganizationInvitation.findByToken(token);
    if (!invitation) {
      throw AppError.notFound('Invitation');
    }

    // Get user for email check
    const user = await models.User.findById(userId);
    if (!user) {
      throw AppError.notFound('User');
    }

    // Check if invitation email matches user email
    if (invitation.email !== user.email.toLowerCase()) {
      throw AppError.forbidden('This invitation is for a different email address');
    }

    // Check if invitation can be accepted
    if (!invitation.canBeAccepted()) {
      throw AppError.validation('Invitation cannot be accepted (expired or already processed)');
    }

    // 1. Validate plan constraints for invitation acceptance
    const acceptanceValidation =
      await PlanValidationService.validateInvitationAcceptance(
        userId,
        invitation.organizationId,
        invitation.role,
        models
      );
    if (!acceptanceValidation.isValid) {
      const forbiddenError = AppError.forbidden(acceptanceValidation.message);
      forbiddenError.upgradeRequired = acceptanceValidation.upgradeRequired;
      forbiddenError.currentPlan = acceptanceValidation.currentPlan;
      forbiddenError.currentUsage = acceptanceValidation.currentUsage;
      forbiddenError.limit = acceptanceValidation.limit;
      throw forbiddenError;
    }

    // 2. Validate organization capacity based on owner's plan
    const capacityValidation =
      await PlanValidationService.validateOrganizationCapacity(
        invitation.organizationId,
        models
      );
    if (!capacityValidation.isValid) {
      const forbiddenError = AppError.forbidden(capacityValidation.message);
      forbiddenError.upgradeRequired = capacityValidation.upgradeRequired;
      forbiddenError.organizationPlan = capacityValidation.organizationPlan;
      forbiddenError.currentMembers = capacityValidation.currentMembers;
      forbiddenError.maxMembers = capacityValidation.maxMembers;
      throw forbiddenError;
    }

    // Accept invitation
    await invitation.accept(userId);

    // Add user to organization using multi-organization service
    const updatedUser =
      await MultiOrganizationService.addUserToOrganization(
        userId,
        invitation.organizationId._id,
        invitation.role,
        invitation.invitedBy
      );

    // Increment token version for security
    updatedUser.tokenVersion = (updatedUser.tokenVersion || 1) + 1;
    await updatedUser.save();

    // Update organization member count
    await models.Organization.findByIdAndUpdate(
      invitation.organizationId._id,
      {
        $inc: { 'stats.totalMembers': 1 },
      }
    );

    // 3. Update user's membership usage after successful acceptance
    await PlanValidationService.updateMembershipUsage(
      userId,
      invitation.role,
      models
    );

    // Generate new token with organization context
    const newToken = generateJWTToken(updatedUser);

    return ResponseHelpers.ok(
      res,
      {
        organization: {
          id: invitation.organizationId._id,
          name: invitation.organizationId.name,
          role: invitation.role,
        },
        token: newToken, // Return new token
      },
      'Invitation accepted successfully'
    );
  }

  // POST /invitations/:token/decline - Decline invitation (public route)
  async declineInvitation(req, res) {
    const { token } = req.params;

    // Find invitation by token
    const invitation = await models.OrganizationInvitation.findByToken(token);

    if (!invitation) {
      throw AppError.notFound('Invitation');
    }

    // Check if invitation can be declined
    if (invitation.status !== 'pending') {
      throw AppError.validation('Invitation cannot be declined (already processed)');
    }

    // Decline invitation
    await invitation.decline();

    return ResponseHelpers.ok(res, null, 'Invitation declined successfully');
  }
}

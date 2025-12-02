import jwt from 'jsonwebtoken';
import { models } from '../index.js';
import { generateJWTToken } from '../utils/generate-token.js';
import {
  PlanValidationService,
  ResponseHelpers,
} from '@minimeet/shared-models';

import { MultiOrganizationService } from '../services/multi-organization.service.js';

export class InvitationController {
  // GET /invitations/:token - Get invitation details (public route)
  async getInvitationDetails(req, res) {
    try {
      const { token } = req.params;

      // Find invitation by token
      const invitation = await models.OrganizationInvitation.findByToken(token);

      if (!invitation) {
        return ResponseHelpers.notFound(res, 'Invitation not found or expired');
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
    } catch (error) {
      console.error('Get invitation error:', error);
      return ResponseHelpers.serverError(
        res,
        'Failed to retrieve invitation details'
      );
    }
  }

  // POST /invitations/:token/accept - Accept invitation (requires auth)
  async acceptInvitation(req, res) {
    try {
      const { token } = req.params;
      const authHeader = req.headers['authorization'];
      const authToken = authHeader && authHeader.split(' ')[1];

      if (!authToken) {
        return ResponseHelpers.unauthorized(res, 'Authentication required');
      }

      // Verify JWT token
      let userId;
      try {
        const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
        const user = await models.User.findById(decoded.userId);
        if (!user) {
          return ResponseHelpers.notFound(res, 'User not found');
        }
        userId = user._id;

        // Find invitation by token
        const invitation = await models.OrganizationInvitation.findByToken(
          token
        );
        if (!invitation) {
          return ResponseHelpers.notFound(
            res,
            'Invitation not found or expired'
          );
        }

        // Check if invitation email matches user email
        if (invitation.email !== user.email.toLowerCase()) {
          return ResponseHelpers.forbidden(
            res,
            'This invitation is for a different email address'
          );
        }

        // Check if invitation can be accepted
        if (!invitation.canBeAccepted()) {
          return ResponseHelpers.badRequest(
            res,
            'Invitation cannot be accepted (expired or already processed)'
          );
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
          return ResponseHelpers.forbidden(res, acceptanceValidation.message, {
            upgradeRequired: acceptanceValidation.upgradeRequired,
            currentPlan: acceptanceValidation.currentPlan,
            currentUsage: acceptanceValidation.currentUsage,
            limit: acceptanceValidation.limit,
          });
        }

        // 2. Validate organization capacity based on owner's plan
        const capacityValidation =
          await PlanValidationService.validateOrganizationCapacity(
            invitation.organizationId,
            models
          );
        if (!capacityValidation.isValid) {
          return ResponseHelpers.forbidden(res, capacityValidation.message, {
            upgradeRequired: capacityValidation.upgradeRequired,
            organizationPlan: capacityValidation.organizationPlan,
            currentMembers: capacityValidation.currentMembers,
            maxMembers: capacityValidation.maxMembers,
          });
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
      } catch (jwtError) {
        return ResponseHelpers.unauthorized(
          res,
          'Invalid authentication token'
        );
      }
    } catch (error) {
      console.error('Accept invitation error:', error);
      return ResponseHelpers.serverError(res, 'Failed to accept invitation');
    }
  }

  // POST /invitations/:token/decline - Decline invitation (public route)
  async declineInvitation(req, res) {
    try {
      const { token } = req.params;

      // Find invitation by token
      const invitation = await models.OrganizationInvitation.findByToken(token);

      if (!invitation) {
        return ResponseHelpers.notFound(res, 'Invitation not found or expired');
      }

      // Check if invitation can be declined
      if (invitation.status !== 'pending') {
        return ResponseHelpers.badRequest(
          res,
          'Invitation cannot be declined (already processed)'
        );
      }

      // Decline invitation
      await invitation.decline();

      return ResponseHelpers.ok(res, null, 'Invitation declined successfully');
    } catch (error) {
      console.error('Decline invitation error:', error);
      return ResponseHelpers.serverError(res, 'Failed to decline invitation');
    }
  }
}

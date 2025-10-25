import jwt from 'jsonwebtoken';
import { models } from '../index.js';
import { generateJWTToken } from '../utils/generate-token.js';
import { PlanValidationService } from '../services/plan-validation.service.js';
import { MultiOrganizationService } from '../services/multi-organization.service.js';

export class InvitationController {
  // GET /invitations/:token - Get invitation details (public route)
  async getInvitationDetails(req, res) {
    try {
      const { token } = req.params;

      // Find invitation by token
      const invitation = await models.OrganizationInvitation.findByToken(token);

      if (!invitation) {
        return res.status(404).json({
          message: 'Invitation not found or expired',
        });
      }

      // Return invitation details without sensitive information
      res.json({
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
      res.status(500).json({ message: 'Server error' });
    }
  }

  // POST /invitations/:token/accept - Accept invitation (requires auth)
  async acceptInvitation(req, res) {
    try {
      const { token } = req.params;
      const authHeader = req.headers['authorization'];
      const authToken = authHeader && authHeader.split(' ')[1];

      if (!authToken) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Verify JWT token
      let userId;
      try {
        const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
        const user = await models.User.findById(decoded.userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        userId = user._id;

        // Find invitation by token
        const invitation = await models.OrganizationInvitation.findByToken(
          token
        );
        if (!invitation) {
          return res.status(404).json({
            message: 'Invitation not found or expired',
          });
        }

        // Check if invitation email matches user email
        if (invitation.email !== user.email.toLowerCase()) {
          return res.status(403).json({
            message: 'This invitation is for a different email address',
          });
        }

        // Check if invitation can be accepted
        if (!invitation.canBeAccepted()) {
          return res.status(400).json({
            message:
              'Invitation cannot be accepted (expired or already processed)',
          });
        }

        // 1. Validate plan constraints for invitation acceptance
        const acceptanceValidation =
          await PlanValidationService.validateInvitationAcceptance(
            userId,
            invitation.organizationId,
            invitation.role
          );
        if (!acceptanceValidation.isValid) {
          return res.status(403).json({
            message: acceptanceValidation.message,
            upgradeRequired: acceptanceValidation.upgradeRequired,
            currentPlan: acceptanceValidation.currentPlan,
            currentUsage: acceptanceValidation.currentUsage,
            limit: acceptanceValidation.limit,
          });
        }

        // 2. Validate organization capacity based on owner's plan
        const capacityValidation =
          await PlanValidationService.validateOrganizationCapacity(
            invitation.organizationId
          );
        if (!capacityValidation.isValid) {
          return res.status(403).json({
            message: capacityValidation.message,
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
          invitation.role
        );

        // Generate new token with organization context
        const newToken = generateJWTToken(updatedUser);

        res.json({
          message: 'Invitation accepted successfully',
          organization: {
            id: invitation.organizationId._id,
            name: invitation.organizationId.name,
            role: invitation.role,
          },
          token: newToken, // Return new token
        });
      } catch (jwtError) {
        return res
          .status(401)
          .json({ message: 'Invalid authentication token' });
      }
    } catch (error) {
      console.error('Accept invitation error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // POST /invitations/:token/decline - Decline invitation (public route)
  async declineInvitation(req, res) {
    try {
      const { token } = req.params;

      // Find invitation by token
      const invitation = await models.OrganizationInvitation.findByToken(token);

      if (!invitation) {
        return res.status(404).json({
          message: 'Invitation not found or expired',
        });
      }

      // Check if invitation can be declined
      if (invitation.status !== 'pending') {
        return res.status(400).json({
          message: 'Invitation cannot be declined (already processed)',
        });
      }

      // Decline invitation
      await invitation.decline();

      res.json({
        message: 'Invitation declined successfully',
      });
    } catch (error) {
      console.error('Decline invitation error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

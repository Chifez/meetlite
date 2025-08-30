import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { models } from '../index.js';
import { sendOrganizationInviteEmail } from '../services/emailService.js';
import { authenticateToken } from '../middleware/authenticate-token.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Helper function to check if user is organization owner
const checkOrganizationOwner = async (userId, organizationId) => {
  const organization = await models.Organization.findOne({
    _id: organizationId,
    ownerId: userId,
    status: 'active',
  });
  return organization;
};

// POST /members/invite - Invite a member to organization
router.post('/invite', async (req, res) => {
  try {
    const { organizationId, email, role = 'member', message = '' } = req.body;
    const userId = req.user._id;

    // Validation
    if (!organizationId || !email) {
      return res.status(400).json({
        message: 'Organization ID and email are required',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (!['member', 'owner'].includes(role)) {
      return res
        .status(400)
        .json({ message: 'Invalid role. Must be member or owner' });
    }

    // Check if user is organization owner
    const organization = await checkOrganizationOwner(userId, organizationId);
    if (!organization) {
      return res.status(403).json({
        message: 'Only organization owners can invite members',
      });
    }

    // Check if email is already a member
    const existingMember = await models.User.findOne({
      email: email.toLowerCase(),
      organizationId: organizationId,
    });

    if (existingMember) {
      return res.status(400).json({
        message: 'User is already a member of this organization',
      });
    }

    // Check if there's already a pending invitation
    const existingInvitation =
      await models.OrganizationInvitation.findPendingInvitation(
        organizationId,
        email
      );

    if (existingInvitation) {
      return res.status(400).json({
        message: 'There is already a pending invitation for this email',
      });
    }

    // Check organization member limits based on plan
    const currentMemberCount = organization.stats.totalMembers || 0;
    const maxMembers = organization.limits.maxMembers;

    if (maxMembers !== -1 && currentMemberCount >= maxMembers) {
      return res.status(400).json({
        message: `Organization has reached its member limit (${maxMembers} members)`,
      });
    }

    // Create invitation
    const inviteToken = uuidv4();
    const invitation = new models.OrganizationInvitation({
      organizationId,
      invitedBy: userId,
      email: email.toLowerCase(),
      role,
      inviteToken,
      message: message.trim(),
    });

    await invitation.save();

    // Send invitation email
    try {
      await sendOrganizationInviteEmail({
        email: email.toLowerCase(),
        organizationName: organization.name,
        inviterName: req.user.name || req.user.email,
        inviterEmail: req.user.email,
        inviteToken,
        message: message.trim(),
        role,
      });
    } catch (emailError) {
      // If email fails, remove the invitation
      await models.OrganizationInvitation.findByIdAndDelete(invitation._id);
      console.error('Failed to send invitation email:', emailError);
      return res.status(500).json({
        message: 'Failed to send invitation email',
      });
    }

    res.status(201).json({
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
    });
  } catch (error) {
    console.error('Invite member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /members/:organizationId - List organization members and pending invitations
router.get('/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user._id;

    // Check if user has access to this organization
    const organization = await models.Organization.findOne({
      _id: organizationId,
      status: 'active',
    });

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check if user is member or owner of this organization
    const isOwner = organization.ownerId.toString() === userId.toString();
    const isMember = req.user.organizationId?.toString() === organizationId;

    if (!isOwner && !isMember) {
      return res.status(403).json({
        message: 'Access denied to this organization',
      });
    }

    // Get members
    const members = await models.User.find({
      organizationId: organizationId,
    })
      .select('_id name email role createdAt')
      .sort({ createdAt: -1 });

    // Get pending invitations (only for owners)
    let pendingInvitations = [];
    if (isOwner) {
      pendingInvitations = await models.OrganizationInvitation.find({
        organizationId: organizationId,
        status: 'pending',
        expiresAt: { $gt: new Date() },
      })
        .populate('invitedBy', 'name email')
        .sort({ createdAt: -1 });
    }

    res.json({
      organization: {
        id: organization._id,
        name: organization.name,
        memberCount: organization.stats.totalMembers,
        maxMembers: organization.limits.maxMembers,
      },
      members: members.map((member) => ({
        id: member._id,
        name: member.name,
        email: member.email,
        role: member.role,
        joinedAt: member.createdAt,
        isOwner: member._id.toString() === organization.ownerId.toString(),
      })),
      pendingInvitations: pendingInvitations.map((inv) => ({
        id: inv._id,
        email: inv.email,
        role: inv.role,
        invitedBy: inv.invitedBy,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
      })),
      userRole: isOwner ? 'owner' : 'member',
    });
  } catch (error) {
    console.error('List members error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /members/:organizationId/:memberId - Remove member from organization
router.delete('/:organizationId/:memberId', async (req, res) => {
  try {
    const { organizationId, memberId } = req.params;
    const userId = req.user._id;

    // Check if user is organization owner
    const organization = await checkOrganizationOwner(userId, organizationId);
    if (!organization) {
      return res.status(403).json({
        message: 'Only organization owners can remove members',
      });
    }

    // Prevent owner from removing themselves
    if (memberId === userId.toString()) {
      return res.status(400).json({
        message: 'Organization owners cannot remove themselves',
      });
    }

    // Find and remove member
    const member = await models.User.findOne({
      _id: memberId,
      organizationId: organizationId,
    });

    if (!member) {
      return res.status(404).json({
        message: 'Member not found in this organization',
      });
    }

    // Remove user from organization
    await models.User.findByIdAndUpdate(memberId, {
      $unset: { organizationId: 1 },
      role: 'owner', // Reset to default role
    });

    // Update organization member count
    await models.Organization.findByIdAndUpdate(organizationId, {
      $inc: { 'stats.totalMembers': -1 },
    });

    res.json({
      message: 'Member removed successfully',
      removedMember: {
        id: member._id,
        name: member.name,
        email: member.email,
      },
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /invitations/:invitationId - Cancel pending invitation
router.delete('/invitations/:invitationId', async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user._id;

    // Find invitation
    const invitation = await models.OrganizationInvitation.findById(
      invitationId
    ).populate('organizationId');

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    // Check if user is organization owner
    const isOwner =
      invitation.organizationId.ownerId.toString() === userId.toString();
    if (!isOwner) {
      return res.status(403).json({
        message: 'Only organization owners can cancel invitations',
      });
    }

    // Only allow canceling pending invitations
    if (invitation.status !== 'pending') {
      return res.status(400).json({
        message: 'Only pending invitations can be canceled',
      });
    }

    // Cancel invitation
    invitation.status = 'expired';
    await invitation.save();

    res.json({
      message: 'Invitation canceled successfully',
      invitation: {
        id: invitation._id,
        email: invitation.email,
        status: invitation.status,
      },
    });
  } catch (error) {
    console.error('Cancel invitation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

import express from 'express';
import { models } from '../index.js';
import { generateJWTToken } from '../utils/generate-token.js';
import { authenticateToken } from '../middleware/authenticate-token.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /organizations - List user's organizations (owned + member)
router.get('/', async (req, res) => {
  try {
    const userId = req.user._id;

    // Get organizations where user is owner
    const ownedOrgs = await models.Organization.find({
      ownerId: userId,
      status: 'active',
    }).sort({ createdAt: -1 });

    // Get organizations where user is a member
    const memberOrgs = await models.Organization.find({
      _id: req.user.organizationId,
      status: 'active',
      ownerId: { $ne: userId }, // Not owned by user
    }).sort({ createdAt: -1 });

    // Combine and format organizations
    const organizations = [...ownedOrgs, ...memberOrgs].map((org) => ({
      id: org._id,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      industry: org.industry,
      size: org.size,
      plan: org.plan,
      role: org.ownerId.toString() === userId.toString() ? 'owner' : 'member',
      memberCount: org.stats.totalMembers,
      settings: org.settings,
      createdAt: org.createdAt,
    }));

    res.json({ organizations });
  } catch (error) {
    console.error('List organizations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /organizations - Create new organization
router.post('/', async (req, res) => {
  try {
    const { name, description, industry, size } = req.body;
    const userId = req.user._id;

    // Validation
    if (!name || name.trim().length < 2) {
      return res
        .status(400)
        .json({ message: 'Organization name must be at least 2 characters' });
    }

    if (name.length > 100) {
      return res.status(400).json({
        message: 'Organization name must be less than 100 characters',
      });
    }

    // Check if user already owns the maximum number of organizations (for free plan)
    const ownedOrgsCount = await models.Organization.countDocuments({
      ownerId: userId,
      status: 'active',
    });

    const maxOrgsAllowed = req.user.plan === 'free' ? 1 : 10; // Free users can own 1 org
    if (ownedOrgsCount >= maxOrgsAllowed) {
      return res.status(400).json({
        message: `You can only create ${maxOrgsAllowed} organization${
          maxOrgsAllowed > 1 ? 's' : ''
        } on your current plan`,
      });
    }

    // Create organization
    const organization = new models.Organization({
      name: name.trim(),
      description: description?.trim(),
      industry: industry?.trim(),
      size,
      ownerId: userId,
      plan: 'free', // Default plan
      stats: {
        totalMembers: 1, // Owner is the first member
      },
    });

    console.log('Organization before save:', {
      name: organization.name,
      slug: organization.slug,
      hasSlug: !!organization.slug,
    });

    await organization.save();

    console.log('Organization after save:', {
      id: organization._id,
      name: organization.name,
      slug: organization.slug,
      hasSlug: !!organization.slug,
    });

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
  } catch (error) {
    console.error('Create organization error:', error);

    if (error.code === 11000) {
      // Duplicate key error
      return res
        .status(400)
        .json({ message: 'An organization with this name already exists' });
    }

    res.status(500).json({ message: 'Server error' });
  }
});

// GET /organizations/:orgId - Get organization details
router.get('/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params;
    const userId = req.user._id;

    const organization = await models.Organization.findOne({
      _id: orgId,
      status: 'active',
    });

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check if user has access (owner or member)
    const isOwner = organization.ownerId.toString() === userId.toString();
    const isMember = req.user.organizationId?.toString() === orgId;

    if (!isOwner && !isMember) {
      return res
        .status(403)
        .json({ message: 'Access denied to this organization' });
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
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /organizations/:orgId - Update organization (owner only)
router.put('/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params;
    const { name, description, industry, size, settings } = req.body;
    const userId = req.user._id;

    const organization = await models.Organization.findOne({
      _id: orgId,
      ownerId: userId,
      status: 'active',
    });

    if (!organization) {
      return res
        .status(404)
        .json({ message: 'Organization not found or access denied' });
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
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /organizations/:orgId/leave - Leave organization (members only)
router.post('/:orgId/leave', async (req, res) => {
  try {
    const { orgId } = req.params;
    const userId = req.user._id;

    const organization = await models.Organization.findOne({
      _id: orgId,
      status: 'active',
    });

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check if user is owner (owners cannot leave, they must transfer ownership first)
    if (organization.ownerId.toString() === userId.toString()) {
      return res.status(400).json({
        message:
          'Organization owners cannot leave. Transfer ownership first or delete the organization.',
      });
    }

    // Check if user is actually a member
    if (req.user.organizationId?.toString() !== orgId) {
      return res
        .status(400)
        .json({ message: 'You are not a member of this organization' });
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
  } catch (error) {
    console.error('Leave organization error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /organizations/:orgId - Delete organization (owner only)
router.delete('/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params;
    const userId = req.user._id;

    const organization = await models.Organization.findOne({
      _id: orgId,
      ownerId: userId,
      status: 'active',
    });

    if (!organization) {
      return res
        .status(404)
        .json({ message: 'Organization not found or access denied' });
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
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

import express from 'express';
import jwt from 'jsonwebtoken';
import { models } from '../index.js';

const router = express.Router();

// Middleware to authenticate requests
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    // Get user info and attach to request
    try {
      const user = await models.User.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      req.user = user;
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({ message: 'Authentication failed' });
    }
  });
};

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

    // Update user to be part of this organization
    await models.User.findByIdAndUpdate(userId, {
      organizationId: organization._id,
      role: 'owner',
      onboardingCompleted: true, // Mark onboarding as completed
    });

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

// POST /organizations/:orgId/switch - Switch user's active organization
router.post('/:orgId/switch', async (req, res) => {
  try {
    const { orgId } = req.params;
    const userId = req.user._id;

    // Validate organization exists and user has access
    const organization = await models.Organization.findOne({
      _id: orgId,
      status: 'active',
    });

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check if user has access (owner or is already a member)
    const isOwner = organization.ownerId.toString() === userId.toString();
    const isMember = req.user.organizationId?.toString() === orgId;

    if (!isOwner && !isMember) {
      return res
        .status(403)
        .json({ message: 'Access denied to this organization' });
    }

    // Update user's active organization
    const userRole = isOwner ? 'owner' : 'member';
    await models.User.findByIdAndUpdate(userId, {
      organizationId: orgId,
      role: userRole,
    });

    res.json({
      message: 'Organization switched successfully',
      organization: {
        id: organization._id,
        name: organization.name,
        role: userRole,
      },
    });
  } catch (error) {
    console.error('Switch organization error:', error);
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

    // Remove user from organization
    await models.User.findByIdAndUpdate(userId, {
      $unset: { organizationId: 1 },
      role: 'owner', // Reset to default personal account role
    });

    // Update organization member count
    await models.Organization.findByIdAndUpdate(orgId, {
      $inc: { 'stats.totalMembers': -1 },
    });

    res.json({ message: 'Successfully left organization' });
  } catch (error) {
    console.error('Leave organization error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

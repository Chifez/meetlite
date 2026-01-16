import { AdminService } from '../services/admin.service.js';
import { AppError } from '@minimeet/shared';
import { models } from '../index.js';

export class AdminController {
  /**
   * GET /admin/metrics - Get overview metrics
   */
  async getOverviewMetrics(req, res) {
    try {
      const metrics = await AdminService.getOverviewMetrics();
      res.json({ success: true, data: metrics });
    } catch (error) {
      console.error('Get overview metrics error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch overview metrics',
      });
    }
  }

  /**
   * GET /admin/metrics/user-growth - Get user growth chart data
   */
  async getUserGrowthData(req, res) {
    try {
      const { period = '30d' } = req.query;
      const data = await AdminService.getUserGrowthData(period);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Get user growth data error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch user growth data',
      });
    }
  }

  /**
   * GET /admin/metrics/plan-distribution - Get plan distribution
   */
  async getPlanDistribution(req, res) {
    try {
      const data = await AdminService.getPlanDistribution();
      res.json({ success: true, data });
    } catch (error) {
      console.error('Get plan distribution error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch plan distribution',
      });
    }
  }

  /**
   * GET /admin/users - Get users list with pagination
   */
  async getUsersList(req, res) {
    try {
      const {
        page = 1,
        limit = 25,
        search = '',
        plan = '',
        status = '',
        sort = 'createdAt',
        order = 'desc',
      } = req.query;

      const result = await AdminService.getUsersList({
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        plan,
        status,
        sort,
        order,
      });

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Get users list error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch users list',
      });
    }
  }

  /**
   * GET /admin/users/:userId - Get user details
   */
  async getUserDetails(req, res) {
    try {
      const { userId } = req.params;
      const user = await models.User.findById(userId)
        .select('-password -resetToken -resetTokenExpiry')
        .lean();

      if (!user) {
        throw AppError.notFound('User not found');
      }

      const orgsCount = await models.Organization.countDocuments({
        $or: [{ ownerId: user._id }, { 'members.userId': user._id.toString() }],
      });

      res.json({
        success: true,
        data: {
          ...user,
          id: user._id.toString(),
          orgsCount,
        },
      });
    } catch (error) {
      console.error('Get user details error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to fetch user details',
      });
    }
  }

  /**
   * PATCH /admin/users/:userId - Update user
   */
  async updateUser(req, res) {
    try {
      const { userId } = req.params;
      const { name, email, plan, isSystemAdmin } = req.body;

      const user = await models.User.findById(userId);
      if (!user) {
        throw AppError.notFound('User not found');
      }

      if (name !== undefined) user.name = name;
      if (email !== undefined) user.email = email;
      if (isSystemAdmin !== undefined) user.isSystemAdmin = isSystemAdmin;
      if (plan?.type !== undefined) user.plan.type = plan.type;
      if (plan?.status !== undefined) user.plan.status = plan.status;

      await user.save();

      res.json({
        success: true,
        message: 'User updated successfully',
        data: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          plan: user.plan,
          isSystemAdmin: user.isSystemAdmin,
        },
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update user',
      });
    }
  }

  /**
   * DELETE /admin/users/:userId - Delete user
   */
  async deleteUser(req, res) {
    try {
      const { userId } = req.params;
      const user = await models.User.findById(userId);

      if (!user) {
        throw AppError.notFound('User not found');
      }

      await models.User.deleteOne({ _id: userId });

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to delete user',
      });
    }
  }

  /**
   * POST /admin/users/:userId/suspend - Suspend user
   */
  async suspendUser(req, res) {
    try {
      const { userId } = req.params;
      // Add suspended field to user model if needed
      // For now, we'll update plan status
      const user = await models.User.findById(userId);
      if (!user) {
        throw AppError.notFound('User not found');
      }

      // You might want to add a suspended field instead
      user.plan.status = 'cancelled';
      await user.save();

      res.json({
        success: true,
        message: 'User suspended successfully',
      });
    } catch (error) {
      console.error('Suspend user error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to suspend user',
      });
    }
  }

  /**
   * POST /admin/users/:userId/unsuspend - Unsuspend user
   */
  async unsuspendUser(req, res) {
    try {
      const { userId } = req.params;
      const user = await models.User.findById(userId);
      if (!user) {
        throw AppError.notFound('User not found');
      }

      user.plan.status = 'active';
      await user.save();

      res.json({
        success: true,
        message: 'User unsuspended successfully',
      });
    } catch (error) {
      console.error('Unsuspend user error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to unsuspend user',
      });
    }
  }

  /**
   * POST /admin/users/:userId/reset-password - Reset user password
   */
  async resetUserPassword(req, res) {
    try {
      const { userId } = req.params;
      const user = await models.User.findById(userId);
      if (!user) {
        throw AppError.notFound('User not found');
      }

      // Generate temporary password or send reset email
      // For now, just return success - implement actual reset logic
      res.json({
        success: true,
        message: 'Password reset initiated',
      });
    } catch (error) {
      console.error('Reset user password error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to reset password',
      });
    }
  }

  /**
   * GET /admin/organizations - Get organizations list
   */
  async getOrganizationsList(req, res) {
    try {
      const {
        page = 1,
        limit = 25,
        search = '',
        plan = '',
        sort = 'createdAt',
        order = 'desc',
      } = req.query;

      const result = await AdminService.getOrganizationsList({
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        plan,
        sort,
        order,
      });

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Get organizations list error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch organizations list',
      });
    }
  }

  /**
   * GET /admin/meetings - Get meetings list
   */
  async getMeetingsList(req, res) {
    try {
      const {
        page = 1,
        limit = 25,
        search = '',
        status = '',
        dateFrom = '',
        dateTo = '',
        sort = 'scheduledTime',
        order = 'desc',
      } = req.query;

      const result = await AdminService.getMeetingsList({
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        status,
        dateFrom,
        dateTo,
        sort,
        order,
      });

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Get meetings list error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch meetings list',
      });
    }
  }

  /**
   * DELETE /admin/meetings/:meetingId - Delete meeting
   */
  async deleteMeeting(req, res) {
    try {
      const { meetingId } = req.params;
      const Meeting = models.Meeting;

      const meeting = await Meeting.findById(meetingId);
      if (!meeting) {
        throw AppError.notFound('Meeting not found');
      }

      await Meeting.deleteOne({ _id: meetingId });

      res.json({
        success: true,
        message: 'Meeting deleted successfully',
      });
    } catch (error) {
      console.error('Delete meeting error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to delete meeting',
      });
    }
  }

  /**
   * GET /admin/revenue/metrics - Get revenue metrics
   */
  async getRevenueMetrics(req, res) {
    try {
      const metrics = await AdminService.getRevenueMetrics();
      res.json({ success: true, data: metrics });
    } catch (error) {
      console.error('Get revenue metrics error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch revenue metrics',
      });
    }
  }

  /**
   * GET /admin/revenue/chart - Get revenue chart data
   */
  async getRevenueChartData(req, res) {
    try {
      const { type = 'overTime', period = '12m' } = req.query;
      const data = await AdminService.getRevenueChartData(type, period);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Get revenue chart data error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch revenue chart data',
      });
    }
  }

  /**
   * GET /admin/system/health - Get system health
   */
  async getSystemHealth(req, res) {
    try {
      const health = await AdminService.getSystemHealth();
      res.json({ success: true, data: health });
    } catch (error) {
      console.error('Get system health error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch system health',
      });
    }
  }
}

export default new AdminController();

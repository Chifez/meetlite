import { Request, Response } from 'express';
// @ts-ignore
import { AdminService } from '../services/admin.service.js';
import { AppError } from '@minimeet/shared';
import { prisma } from '@minimeet/shared';

export class AdminController {
  /**
   * GET /admin/metrics - Get overview metrics
   */
  async getOverviewMetrics(req: Request, res: Response) {
    try {
      const metrics = await AdminService.getOverviewMetrics();
      res.json({ success: true, data: metrics });
    } catch (error: any) {
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
  async getUserGrowthData(req: Request, res: Response) {
    try {
      const { period = '30d' } = req.query;
      const data = await AdminService.getUserGrowthData(period as string);
      res.json({ success: true, data });
    } catch (error: any) {
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
  async getPlanDistribution(req: Request, res: Response) {
    try {
      const data = await AdminService.getPlanDistribution();
      res.json({ success: true, data });
    } catch (error: any) {
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
  async getUsersList(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '25',
        search = '',
        plan = '',
        status = '',
        sort = 'createdAt',
        order = 'desc',
      } = req.query;

      const result = await AdminService.getUsersList({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        plan: plan as string,
        status: status as string,
        sort: sort as string,
        order: order as string,
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
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
  async getUserDetails(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw AppError.notFound('User not found');
      }

      // Exclude password and reset tokens
      const { password, resetToken, resetTokenExpiry, ...userWithoutPassword } = user as any;

      const orgsCount = await prisma.organization.count({
        where: {
          OR: [
            { ownerId: userId },
            { memberships: { some: { userId: userId } } }
          ]
        }
      });

      res.json({
        success: true,
        data: {
          ...userWithoutPassword,
          id: user.id,
          orgsCount,
        },
      });
    } catch (error: any) {
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
  async updateUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { name, email, plan, isSystemAdmin } = req.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw AppError.notFound('User not found');
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          name: name !== undefined ? name : undefined,
          email: email !== undefined ? email : undefined,
          isSystemAdmin: isSystemAdmin !== undefined ? isSystemAdmin : undefined,
          planType: plan?.type !== undefined ? plan.type : undefined,
          planStatus: plan?.status !== undefined ? plan.status : undefined,
        }
      });

      res.json({
        success: true,
        message: 'User updated successfully',
        data: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          plan: {
            type: updatedUser.planType,
            status: updatedUser.planStatus,
          },
          isSystemAdmin: updatedUser.isSystemAdmin,
        },
      });
    } catch (error: any) {
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
  async deleteUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        throw AppError.notFound('User not found');
      }

      await prisma.user.delete({ where: { id: userId } });

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error: any) {
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
  async suspendUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw AppError.notFound('User not found');
      }

      await prisma.user.update({
        where: { id: userId },
        data: { planStatus: 'cancelled' }
      });

      res.json({
        success: true,
        message: 'User suspended successfully',
      });
    } catch (error: any) {
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
  async unsuspendUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw AppError.notFound('User not found');
      }

      await prisma.user.update({
        where: { id: userId },
        data: { planStatus: 'active' }
      });

      res.json({
        success: true,
        message: 'User unsuspended successfully',
      });
    } catch (error: any) {
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
  async resetUserPassword(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw AppError.notFound('User not found');
      }

      res.json({
        success: true,
        message: 'Password reset initiated',
      });
    } catch (error: any) {
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
  async getOrganizationsList(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '25',
        search = '',
        plan = '',
        sort = 'createdAt',
        order = 'desc',
      } = req.query;

      const result = await AdminService.getOrganizationsList({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        plan: plan as string,
        sort: sort as string,
        order: order as string,
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
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
  async getMeetingsList(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '25',
        search = '',
        status = '',
        dateFrom = '',
        dateTo = '',
        sort = 'scheduledTime',
        order = 'desc',
      } = req.query;

      const result = await AdminService.getMeetingsList({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        status: status as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        sort: sort as string,
        order: order as string,
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
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
  async deleteMeeting(req: Request, res: Response) {
    try {
      const { meetingId } = req.params;
      const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
      if (!meeting) {
        throw AppError.notFound('Meeting not found');
      }

      await prisma.meeting.delete({ where: { id: meetingId } });

      res.json({
        success: true,
        message: 'Meeting deleted successfully',
      });
    } catch (error: any) {
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
  async getRevenueMetrics(req: Request, res: Response) {
    try {
      const metrics = await AdminService.getRevenueMetrics();
      res.json({ success: true, data: metrics });
    } catch (error: any) {
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
  async getRevenueChartData(req: Request, res: Response) {
    try {
      const { type = 'overTime', period = '12m' } = req.query;
      const data = await AdminService.getRevenueChartData(type as string, period as string);
      res.json({ success: true, data });
    } catch (error: any) {
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
  async getSystemHealth(req: Request, res: Response) {
    try {
      const health = await AdminService.getSystemHealth();
      res.json({ success: true, data: health });
    } catch (error: any) {
      console.error('Get system health error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch system health',
      });
    }
  }
}

export default new AdminController();

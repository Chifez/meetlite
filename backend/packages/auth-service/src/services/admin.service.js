import { models } from '../index.js';

/**
 * Admin Service - Handles all admin-related data aggregation and operations
 */
export class AdminService {
  /**
   * Get overview metrics
   */
  static async getOverviewMetrics() {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      // Get user counts
      const totalUsers = await models.User.countDocuments({});
      const totalUsers30DaysAgo = await models.User.countDocuments({
        createdAt: { $lt: thirtyDaysAgo },
      });
      const totalUsersGrowth =
        totalUsers30DaysAgo > 0
          ? ((totalUsers - totalUsers30DaysAgo) / totalUsers30DaysAgo) * 100
          : 0;

      // Paid users
      const paidUsers = await models.User.countDocuments({
        'plan.type': { $in: ['pro', 'enterprise'] },
        'plan.status': 'active',
      });
      const paidUsers30DaysAgo = await models.User.countDocuments({
        'plan.type': { $in: ['pro', 'enterprise'] },
        'plan.status': 'active',
        createdAt: { $lt: thirtyDaysAgo },
      });
      const paidUsersGrowth =
        paidUsers30DaysAgo > 0
          ? ((paidUsers - paidUsers30DaysAgo) / paidUsers30DaysAgo) * 100
          : 0;
      const paidUsersPercentage =
        totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0;

      // Active users (last 30 days) - users who have logged in or had activity
      const activeUsers = await models.User.countDocuments({
        $or: [
          { 'usage.lastApiCallDate': { $gte: thirtyDaysAgo } },
          { 'usage.lastMeetingDate': { $gte: thirtyDaysAgo } },
          { lastLogin: { $gte: thirtyDaysAgo } },
        ],
      });
      const activeUsers60DaysAgo = await models.User.countDocuments({
        $or: [
          {
            'usage.lastApiCallDate': { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
          },
          {
            'usage.lastMeetingDate': { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
          },
          { lastLogin: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } },
        ],
      });
      const activeUsersGrowth =
        activeUsers60DaysAgo > 0
          ? ((activeUsers - activeUsers60DaysAgo) / activeUsers60DaysAgo) * 100
          : 0;
      const activeUsersPercentage =
        totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

      // MRR calculation (simplified - sum of active subscriptions)
      const proUsers = await models.User.countDocuments({
        'plan.type': 'pro',
        'plan.status': 'active',
      });
      const enterpriseUsers = await models.User.countDocuments({
        'plan.type': 'enterprise',
        'plan.status': 'active',
      });
      // Assuming $12/month for pro, $49/month for enterprise (adjust based on your pricing)
      const mrr = proUsers * 12 + enterpriseUsers * 49;
      const mrrLastMonth = await this.getMRRForPeriod(
        startOfLastMonth,
        endOfLastMonth
      );
      const mrrGrowth =
        mrrLastMonth > 0 ? ((mrr - mrrLastMonth) / mrrLastMonth) * 100 : 0;

      // Meetings this month
      const Meeting = models.Meeting;
      const meetingsThisMonth = await Meeting.countDocuments({
        createdAt: { $gte: startOfMonth },
      });
      const meetingsLastMonth = await Meeting.countDocuments({
        createdAt: { $gte: startOfLastMonth, $lt: startOfMonth },
      });
      const meetingsGrowth =
        meetingsLastMonth > 0
          ? ((meetingsThisMonth - meetingsLastMonth) / meetingsLastMonth) * 100
          : 0;
      const meetingsPerDay = meetingsThisMonth / now.getDate();

      // Organizations count
      const organizationsCount = await models.Organization.countDocuments({});
      const organizations30DaysAgo = await models.Organization.countDocuments({
        createdAt: { $lt: thirtyDaysAgo },
      });
      const organizationsGrowth =
        organizations30DaysAgo > 0
          ? ((organizationsCount - organizations30DaysAgo) /
              organizations30DaysAgo) *
            100
          : 0;

      // Teams count
      const teamsCount = await models.Team.countDocuments({});
      const avgTeamsPerOrg =
        organizationsCount > 0 ? teamsCount / organizationsCount : 0;

      // Storage used (sum of all users' storage)
      const storageResult = await models.User.aggregate([
        {
          $group: {
            _id: null,
            totalStorage: { $sum: '$usage.storageUsedGB' },
          },
        },
      ]);
      const storageUsed = storageResult[0]?.totalStorage || 0;
      const storageCapacity = 10000; // 10TB default capacity (adjust as needed)

      // Meetings completed today
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const meetingsCompletedToday = await Meeting.countDocuments({
        status: 'completed',
        createdAt: { $gte: today },
      });
      const meetingsCompletedYesterday = await Meeting.countDocuments({
        status: 'completed',
        createdAt: { $gte: yesterday, $lt: today },
      });

      return {
        totalUsers,
        totalUsersGrowth: parseFloat(totalUsersGrowth.toFixed(2)),
        paidUsers,
        paidUsersPercentage: parseFloat(paidUsersPercentage.toFixed(2)),
        paidUsersGrowth: parseFloat(paidUsersGrowth.toFixed(2)),
        mrr: parseFloat(mrr.toFixed(2)),
        mrrGrowth: parseFloat(mrrGrowth.toFixed(2)),
        activeUsers,
        activeUsersPercentage: parseFloat(activeUsersPercentage.toFixed(2)),
        activeUsersGrowth: parseFloat(activeUsersGrowth.toFixed(2)),
        meetingsThisMonth,
        meetingsGrowth: parseFloat(meetingsGrowth.toFixed(2)),
        meetingsPerDay: parseFloat(meetingsPerDay.toFixed(2)),
        organizationsCount,
        organizationsGrowth: parseFloat(organizationsGrowth.toFixed(2)),
        teamsCount,
        avgTeamsPerOrg: parseFloat(avgTeamsPerOrg.toFixed(2)),
        storageUsed: parseFloat(storageUsed.toFixed(2)),
        storageCapacity,
        meetingsCompletedToday,
        meetingsCompletedYesterday,
      };
    } catch (error) {
      console.error('Error getting overview metrics:', error);
      throw error;
    }
  }

  /**
   * Get MRR for a specific period
   */
  static async getMRRForPeriod(startDate, endDate) {
    const proUsers = await models.User.countDocuments({
      'plan.type': 'pro',
      'plan.status': 'active',
      'plan.startDate': { $gte: startDate, $lte: endDate },
    });
    const enterpriseUsers = await models.User.countDocuments({
      'plan.type': 'enterprise',
      'plan.status': 'active',
      'plan.startDate': { $gte: startDate, $lte: endDate },
    });
    return proUsers * 12 + enterpriseUsers * 49;
  }

  /**
   * Get user growth chart data
   */
  static async getUserGrowthData(period = '30d') {
    try {
      let days;
      let intervalHours;

      if (period === '1d' || period === '24h') {
        days = 1;
        intervalHours = 1; // Hourly data for 24 hours
      } else if (period === '7d') {
        days = 7;
        intervalHours = 24; // Daily data for 7 days
      } else if (period === '90d') {
        days = 90;
        intervalHours = 24; // Daily data for 90 days
      } else {
        days = 30;
        intervalHours = 24; // Daily data for 30 days
      }

      const data = [];
      const now = new Date();

      if (period === '1d' || period === '24h') {
        // Hourly data for last 24 hours (accept both '1d' and '24h')
        for (let i = 23; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 60 * 60 * 1000);
          const startOfHour = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            date.getHours()
          );
          const endOfHour = new Date(startOfHour.getTime() + 60 * 60 * 1000);

          const count = await models.User.countDocuments({
            createdAt: { $gte: startOfHour, $lt: endOfHour },
          });

          data.push({
            date: startOfHour.toISOString(),
            count,
          });
        }
      } else {
        // Daily data
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const startOfDay = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
          );
          const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

          const count = await models.User.countDocuments({
            createdAt: { $gte: startOfDay, $lt: endOfDay },
          });

          data.push({
            date: startOfDay.toISOString().split('T')[0],
            count,
          });
        }
      }

      return data;
    } catch (error) {
      console.error('Error getting user growth data:', error);
      throw error;
    }
  }

  /**
   * Get plan distribution
   */
  static async getPlanDistribution() {
    try {
      const free = await models.User.countDocuments({ 'plan.type': 'free' });
      const pro = await models.User.countDocuments({
        'plan.type': 'pro',
        'plan.status': 'active',
      });
      const enterprise = await models.User.countDocuments({
        'plan.type': 'enterprise',
        'plan.status': 'active',
      });

      return { free, pro, enterprise };
    } catch (error) {
      console.error('Error getting plan distribution:', error);
      throw error;
    }
  }

  /**
   * Get users list with pagination
   */
  static async getUsersList({
    page = 1,
    limit = 25,
    search = '',
    plan = '',
    status = '',
    sort = 'createdAt',
    order = 'desc',
  }) {
    try {
      const skip = (page - 1) * limit;
      const query = {};

      // Search filter
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      // Plan filter
      if (plan) {
        query['plan.type'] = plan;
      }

      // Status filter (user status, not plan status)
      if (status) {
        // For now, we'll use a simple approach - you might want to add a user status field
        if (status === 'active') {
          query['plan.status'] = { $in: ['active', 'past_due'] };
        } else if (status === 'suspended') {
          // Add suspended field if needed
        }
      }

      // Sort
      const sortObj = {};
      sortObj[sort] = order === 'desc' ? -1 : 1;

      // Get users
      const users = await models.User.find(query)
        .select('name email plan createdAt')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean();

      // Get organizations count for each user
      const usersWithOrgs = await Promise.all(
        users.map(async (user) => {
          const orgsCount = await models.Organization.countDocuments({
            $or: [
              { ownerId: user._id },
              { 'members.userId': user._id.toString() },
            ],
          });

          // Get last active (simplified - use last API call or meeting date)
          const lastActive =
            user.usage?.lastApiCallDate ||
            user.usage?.lastMeetingDate ||
            user.createdAt;

          return {
            id: user._id.toString(),
            name: user.name || 'N/A',
            email: user.email,
            plan: user.plan?.type || 'free',
            status: user.plan?.status || 'active',
            createdAt: user.createdAt,
            lastActive,
            orgsCount,
          };
        })
      );

      const total = await models.User.countDocuments(query);

      return {
        users: usersWithOrgs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Error getting users list:', error);
      throw error;
    }
  }

  /**
   * Get organizations list with pagination
   */
  static async getOrganizationsList({
    page = 1,
    limit = 25,
    search = '',
    plan = '',
    sort = 'createdAt',
    order = 'desc',
  }) {
    try {
      const skip = (page - 1) * limit;
      const query = {};

      if (search) {
        query.name = { $regex: search, $options: 'i' };
      }

      // Plan filter would need to check owner's plan
      // For simplicity, we'll skip this for now

      const sortObj = {};
      sortObj[sort] = order === 'desc' ? -1 : 1;

      const organizations = await models.Organization.find(query)
        .populate('ownerId', 'email')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean();

      const orgsWithStats = await Promise.all(
        organizations.map(async (org) => {
          const membersCount = await models.OrganizationMember.countDocuments({
            organizationId: org._id,
            status: 'active',
          });
          const teamsCount = await models.Team.countDocuments({
            organizationId: org._id,
          });

          // Get owner's plan
          const owner = await models.User.findById(
            org.ownerId?._id || org.ownerId
          );
          const plan = owner?.plan?.type || 'free';

          return {
            id: org._id.toString(),
            name: org.name,
            ownerEmail: owner?.email || 'N/A',
            membersCount,
            teamsCount,
            plan,
            createdAt: org.createdAt,
            status: 'active', // Add status field if needed
          };
        })
      );

      const total = await models.Organization.countDocuments(query);

      return {
        organizations: orgsWithStats,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Error getting organizations list:', error);
      throw error;
    }
  }

  /**
   * Get meetings list with pagination
   */
  static async getMeetingsList({
    page = 1,
    limit = 25,
    search = '',
    status = '',
    dateFrom = '',
    dateTo = '',
    sort = 'scheduledTime',
    order = 'desc',
  }) {
    try {
      const Meeting = models.Meeting;

      const skip = (page - 1) * limit;
      const query = {};

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      if (status) {
        query.status = status;
      }

      if (dateFrom || dateTo) {
        query.scheduledTime = {};
        if (dateFrom) {
          query.scheduledTime.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          query.scheduledTime.$lte = new Date(dateTo);
        }
      }

      const sortObj = {};
      sortObj[sort] = order === 'desc' ? -1 : 1;

      const meetings = await Meeting.find(query)
        .populate('createdBy', 'email name')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean();

      const meetingsWithDetails = meetings.map((meeting) => {
        const creator = meeting.createdBy;
        return {
          id: meeting._id.toString(),
          title: meeting.title,
          hostEmail: creator?.email || 'N/A',
          scheduledTime: meeting.scheduledTime,
          duration: meeting.duration,
          participantsCount: meeting.participants?.length || 0,
          status: meeting.status,
          privacy: meeting.privacy,
          isRecurring: meeting.isRecurring || false,
        };
      });

      const total = await Meeting.countDocuments(query);

      return {
        meetings: meetingsWithDetails,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Error getting meetings list:', error);
      throw error;
    }
  }

  /**
   * Get revenue metrics
   */
  static async getRevenueMetrics() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const proUsers = await models.User.countDocuments({
        'plan.type': 'pro',
        'plan.status': 'active',
      });
      const enterpriseUsers = await models.User.countDocuments({
        'plan.type': 'enterprise',
        'plan.status': 'active',
      });

      const mrr = proUsers * 12 + enterpriseUsers * 49;
      const arr = mrr * 12;
      const mrrLastMonth = await this.getMRRForPeriod(
        startOfLastMonth,
        endOfLastMonth
      );
      const revenueGrowth =
        mrrLastMonth > 0 ? ((mrr - mrrLastMonth) / mrrLastMonth) * 100 : 0;

      const totalUsers = await models.User.countDocuments({});
      const arpu = totalUsers > 0 ? mrr / totalUsers : 0;

      // Failed payments (users with past_due status)
      const failedPaymentsCount = await models.User.countDocuments({
        'plan.status': 'past_due',
      });

      return {
        mrr: parseFloat(mrr.toFixed(2)),
        arr: parseFloat(arr.toFixed(2)),
        revenueGrowth: parseFloat(revenueGrowth.toFixed(2)),
        arpu: parseFloat(arpu.toFixed(2)),
        failedPaymentsCount,
      };
    } catch (error) {
      console.error('Error getting revenue metrics:', error);
      throw error;
    }
  }

  /**
   * Get revenue chart data
   */
  static async getRevenueChartData(type = 'overTime', period = '12m') {
    try {
      if (type === 'overTime') {
        const months = period === '12m' ? 12 : 6;
        const data = [];
        const now = new Date();

        for (let i = months - 1; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const endDate = new Date(
            now.getFullYear(),
            now.getMonth() - i + 1,
            0
          );

          const proUsers = await models.User.countDocuments({
            'plan.type': 'pro',
            'plan.status': 'active',
            'plan.startDate': { $lte: endDate },
            $or: [{ 'plan.endDate': { $gte: date } }, { 'plan.endDate': null }],
          });
          const enterpriseUsers = await models.User.countDocuments({
            'plan.type': 'enterprise',
            'plan.status': 'active',
            'plan.startDate': { $lte: endDate },
            $or: [{ 'plan.endDate': { $gte: date } }, { 'plan.endDate': null }],
          });

          const revenue = proUsers * 12 + enterpriseUsers * 49;

          data.push({
            period: date.toISOString().split('T')[0].substring(0, 7), // YYYY-MM
            revenue: parseFloat(revenue.toFixed(2)),
          });
        }

        return data;
      } else if (type === 'byPlan') {
        const proUsers = await models.User.countDocuments({
          'plan.type': 'pro',
          'plan.status': 'active',
        });
        const enterpriseUsers = await models.User.countDocuments({
          'plan.type': 'enterprise',
          'plan.status': 'active',
        });

        return [
          {
            period: 'current',
            revenue: parseFloat(
              (proUsers * 12 + enterpriseUsers * 49).toFixed(2)
            ),
            breakdown: {
              free: 0,
              pro: parseFloat((proUsers * 12).toFixed(2)),
              enterprise: parseFloat((enterpriseUsers * 49).toFixed(2)),
            },
          },
        ];
      }

      return [];
    } catch (error) {
      console.error('Error getting revenue chart data:', error);
      throw error;
    }
  }

  /**
   * Get system health metrics
   */
  static async getSystemHealth() {
    try {
      // Simplified system health - you can enhance this with actual monitoring
      return {
        apiResponseTime: 150, // ms (mock - replace with actual metrics)
        errorRate: 0.5, // percentage (mock)
        databaseStatus: 'healthy',
        databaseConnections: {
          used: 5,
          total: 10,
        },
        storageUsed: 0, // Will be calculated from overview metrics
        storageCapacity: 10000,
      };
    } catch (error) {
      console.error('Error getting system health:', error);
      throw error;
    }
  }
}

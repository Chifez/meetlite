import { prisma } from '@minimeet/shared';

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
      const totalUsers = await prisma.user.count();
      const totalUsers30DaysAgo = await prisma.user.count({
        where: { createdAt: { lt: thirtyDaysAgo } },
      });
      const totalUsersGrowth =
        totalUsers30DaysAgo > 0
          ? ((totalUsers - totalUsers30DaysAgo) / totalUsers30DaysAgo) * 100
          : 0;

      // Paid users
      const paidUsers = await prisma.user.count({
        where: {
          planType: { in: ['pro', 'enterprise'] },
          planStatus: 'active',
        }
      });
      const paidUsers30DaysAgo = await prisma.user.count({
        where: {
          planType: { in: ['pro', 'enterprise'] },
          planStatus: 'active',
          createdAt: { lt: thirtyDaysAgo },
        }
      });
      const paidUsersGrowth =
        paidUsers30DaysAgo > 0
          ? ((paidUsers - paidUsers30DaysAgo) / paidUsers30DaysAgo) * 100
          : 0;
      const paidUsersPercentage =
        totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0;

      // Active users (last 30 days)
      const activeUsers = await prisma.user.count({
        where: {
          OR: [
            { usage: { lastApiCallDate: { gte: thirtyDaysAgo } } },
            { usage: { lastMeetingDate: { gte: thirtyDaysAgo } } },
            { lastLogin: { gte: thirtyDaysAgo } },
          ],
        }
      });
      const activeUsers60DaysAgo = await prisma.user.count({
        where: {
          OR: [
            {
              usage: { lastApiCallDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
            },
            {
              usage: { lastMeetingDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
            },
            { lastLogin: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
          ],
        }
      });
      const activeUsersGrowth =
        activeUsers60DaysAgo > 0
          ? ((activeUsers - activeUsers60DaysAgo) / activeUsers60DaysAgo) * 100
          : 0;
      const activeUsersPercentage =
        totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

      // MRR calculation
      const proUsers = await prisma.user.count({
        where: {
          planType: 'pro',
          planStatus: 'active',
        }
      });
      const enterpriseUsers = await prisma.user.count({
        where: {
          planType: 'enterprise',
          planStatus: 'active',
        }
      });
      const mrr = proUsers * 12 + enterpriseUsers * 49;
      const mrrLastMonth = await this.getMRRForPeriod(
        startOfLastMonth,
        endOfLastMonth
      );
      const mrrGrowth =
        mrrLastMonth > 0 ? ((mrr - mrrLastMonth) / mrrLastMonth) * 100 : 0;

      // Meetings this month
      const meetingsThisMonth = await prisma.meeting.count({
        where: {
          createdAt: { gte: startOfMonth },
        }
      });
      const meetingsLastMonth = await prisma.meeting.count({
        where: {
          createdAt: { gte: startOfLastMonth, lt: startOfMonth },
        }
      });
      const meetingsGrowth =
        meetingsLastMonth > 0
          ? ((meetingsThisMonth - meetingsLastMonth) / meetingsLastMonth) * 100
          : 0;
      const meetingsPerDay = meetingsThisMonth / now.getDate();

      // Organizations count
      const organizationsCount = await prisma.organization.count();
      const organizations30DaysAgo = await prisma.organization.count({
        where: { createdAt: { lt: thirtyDaysAgo } },
      });
      const organizationsGrowth =
        organizations30DaysAgo > 0
          ? ((organizationsCount - organizations30DaysAgo) /
              organizations30DaysAgo) *
            100
          : 0;

      // Teams count
      const teamsCount = await prisma.team.count();
      const avgTeamsPerOrg =
        organizationsCount > 0 ? teamsCount / organizationsCount : 0;

      // Storage used
      const storageResult = await prisma.userUsage.aggregate({
        _sum: {
          storageUsedGb: true
        }
      });
      const storageUsed = Number(storageResult._sum.storageUsedGb || 0);
      const storageCapacity = 10000;

      // Meetings completed today
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const meetingsCompletedToday = await prisma.meeting.count({
        where: {
          status: 'completed',
          createdAt: { gte: today },
        }
      });
      const meetingsCompletedYesterday = await prisma.meeting.count({
        where: {
          status: 'completed',
          createdAt: { gte: yesterday, lt: today },
        }
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
  static async getMRRForPeriod(startDate: Date, endDate: Date) {
    const proUsers = await prisma.user.count({
      where: {
        planType: 'pro',
        planStatus: 'active',
        planStartDate: { gte: startDate, lte: endDate },
      }
    });
    const enterpriseUsers = await prisma.user.count({
      where: {
        planType: 'enterprise',
        planStatus: 'active',
        planStartDate: { gte: startDate, lte: endDate },
      }
    });
    return proUsers * 12 + enterpriseUsers * 49;
  }

  /**
   * Get user growth chart data
   */
  static async getUserGrowthData(period = '30d') {
    try {
      let days: number;

      if (period === '1d' || period === '24h') {
        days = 1;
      } else if (period === '7d') {
        days = 7;
      } else if (period === '90d') {
        days = 90;
      } else {
        days = 30;
      }

      const data = [];
      const now = new Date();

      if (period === '1d' || period === '24h') {
        for (let i = 23; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 60 * 60 * 1000);
          const startOfHour = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            date.getHours()
          );
          const endOfHour = new Date(startOfHour.getTime() + 60 * 60 * 1000);

          const count = await prisma.user.count({
            where: {
              createdAt: { gte: startOfHour, lt: endOfHour },
            }
          });

          data.push({
            date: startOfHour.toISOString(),
            count,
          });
        }
      } else {
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const startOfDay = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
          );
          const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

          const count = await prisma.user.count({
            where: {
              createdAt: { gte: startOfDay, lt: endOfDay },
            }
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
      const free = await prisma.user.count({ where: { planType: 'free' } });
      const pro = await prisma.user.count({
        where: {
          planType: 'pro',
          planStatus: 'active',
        }
      });
      const enterprise = await prisma.user.count({
        where: {
          planType: 'enterprise',
          planStatus: 'active',
        }
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
      const whereClause: any = {};

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (plan) {
        whereClause.planType = plan;
      }

      if (status) {
        if (status === 'active') {
          whereClause.planStatus = { in: ['active', 'past_due'] };
        }
      }

      const sortObj: any = {};
      sortObj[sort] = order === 'desc' ? 'desc' : 'asc';

      const users = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          planType: true,
          planStatus: true,
          createdAt: true,
          usage: {
            select: {
              lastApiCallDate: true,
              lastMeetingDate: true
            }
          }
        },
        orderBy: sortObj,
        skip,
        take: limit,
      });

      const usersWithOrgs = await Promise.all(
        users.map(async (user: any) => {
          const orgsCount = await prisma.organization.count({
            where: {
              OR: [
                { ownerId: user.id },
                { memberships: { some: { userId: user.id } } },
              ],
            }
          });

          const lastActive =
            user.usage?.lastApiCallDate ||
            user.usage?.lastMeetingDate ||
            user.createdAt;

          return {
            id: user.id,
            name: user.name || 'N/A',
            email: user.email,
            plan: user.planType || 'free',
            status: user.planStatus || 'active',
            createdAt: user.createdAt,
            lastActive,
            orgsCount,
          };
        })
      );

      const total = await prisma.user.count({ where: whereClause });

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
      const whereClause: any = {};

      if (search) {
        whereClause.name = { contains: search, mode: 'insensitive' };
      }

      const sortObj: any = {};
      sortObj[sort] = order === 'desc' ? 'desc' : 'asc';

      const organizations = await prisma.organization.findMany({
        where: whereClause,
        include: {
          owner: { select: { email: true, planType: true } }
        },
        orderBy: sortObj,
        skip,
        take: limit,
      });

      const orgsWithStats = await Promise.all(
        organizations.map(async (org: any) => {
          const membersCount = await prisma.userOrganizationMembership.count({
            where: {
              organizationId: org.id,
              status: 'active',
            }
          });
          const teamsCount = await prisma.team.count({
            where: {
              organizationId: org.id,
            }
          });

          const planType = org.owner?.planType || 'free';

          return {
            id: org.id,
            name: org.name,
            ownerEmail: org.owner?.email || 'N/A',
            membersCount,
            teamsCount,
            plan: planType,
            createdAt: org.createdAt,
            status: 'active',
          };
        })
      );

      const total = await prisma.organization.count({ where: whereClause });

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
      const skip = (page - 1) * limit;
      const whereClause: any = {};

      if (search) {
        whereClause.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (status) {
        whereClause.status = status;
      }

      if (dateFrom || dateTo) {
        whereClause.scheduledTime = {};
        if (dateFrom) {
          whereClause.scheduledTime.gte = new Date(dateFrom);
        }
        if (dateTo) {
          whereClause.scheduledTime.lte = new Date(dateTo);
        }
      }

      const sortObj: any = {};
      sortObj[sort] = order === 'desc' ? 'desc' : 'asc';

      const meetings = await prisma.meeting.findMany({
        where: whereClause,
        include: { creator: { select: { email: true, name: true } }, participants: true },
        orderBy: sortObj,
        skip,
        take: limit,
      });

      const meetingsWithDetails = meetings.map((meeting: any) => {
        const creator = meeting.createdBy;
        return {
          id: meeting.id,
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

      const total = await prisma.meeting.count({ where: whereClause });

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
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const proUsers = await prisma.user.count({
        where: {
          planType: 'pro',
          planStatus: 'active',
        }
      });
      const enterpriseUsers = await prisma.user.count({
        where: {
          planType: 'enterprise',
          planStatus: 'active',
        }
      });

      const mrr = proUsers * 12 + enterpriseUsers * 49;
      const arr = mrr * 12;
      const mrrLastMonth = await this.getMRRForPeriod(
        startOfLastMonth,
        endOfLastMonth
      );
      const revenueGrowth =
        mrrLastMonth > 0 ? ((mrr - mrrLastMonth) / mrrLastMonth) * 100 : 0;

      const totalUsers = await prisma.user.count();
      const arpu = totalUsers > 0 ? mrr / totalUsers : 0;

      const failedPaymentsCount = await prisma.user.count({
        where: {
          planStatus: 'past_due',
        }
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

          const proUsers = await prisma.user.count({
            where: {
              planType: 'pro',
              planStatus: 'active',
              planStartDate: { lte: endDate },
              OR: [{ planEndDate: { gte: date } }, { planEndDate: null }],
            }
          });
          const enterpriseUsers = await prisma.user.count({
            where: {
              planType: 'enterprise',
              planStatus: 'active',
              planStartDate: { lte: endDate },
              OR: [{ planEndDate: { gte: date } }, { planEndDate: null }],
            }
          });

          const revenue = proUsers * 12 + enterpriseUsers * 49;

          data.push({
            period: date.toISOString().split('T')[0].substring(0, 7), // YYYY-MM
            revenue: parseFloat(revenue.toFixed(2)),
          });
        }

        return data;
      } else if (type === 'byPlan') {
        const proUsers = await prisma.user.count({
          where: {
            planType: 'pro',
            planStatus: 'active',
          }
        });
        const enterpriseUsers = await prisma.user.count({
          where: {
            planType: 'enterprise',
            planStatus: 'active',
          }
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
      return {
        apiResponseTime: 150,
        errorRate: 0.5,
        databaseStatus: 'healthy',
        databaseConnections: {
          used: 5,
          total: 10,
        },
        storageUsed: 0,
        storageCapacity: 10000,
      };
    } catch (error) {
      console.error('Error getting system health:', error);
      throw error;
    }
  }
}

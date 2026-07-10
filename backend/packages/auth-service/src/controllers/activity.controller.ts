import { Request, Response } from 'express';
import { prisma } from '@minimeet/shared';
import { validate as isUuid } from 'uuid';

export const getActivities = async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    if (!organizationId || !isUuid(organizationId)) {
      res.status(400).json({ success: false, message: 'Invalid organization ID' });
      return;
    }

    // Verify user has access to organization
    const userId = (req as any).user.id;
    const isSystemAdmin = (req as any).user.isSystemAdmin;

    if (!isSystemAdmin) {
      const membership = await prisma.userOrganizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
      });

      if (!membership) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
    }

    const activities = await prisma.activity.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const total = await prisma.activity.count({
      where: { organizationId },
    });

    res.json({
      success: true,
      data: {
        activities,
        pagination: {
          total,
          limit: parseInt(limit as string, 10),
          offset: parseInt(offset as string, 10),
        },
      },
    });
  } catch (error) {
    console.error('[Activity Controller] Error fetching activities:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch activities' });
  }
};

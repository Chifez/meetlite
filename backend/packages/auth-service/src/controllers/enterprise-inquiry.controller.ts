import { Request, Response } from 'express';
import { AppError, ResponseHelpers, prisma } from '@minimeet/shared';

/**
 * Enterprise Inquiry Controller
 * Handles admin management of enterprise inquiries
 */

export class EnterpriseInquiryController {
  /**
   * GET /admin/inquiries - List all enterprise inquiries
   */
  async listInquiries(req: Request, res: Response) {
    const {
      page = '1',
      limit = '20',
      status,
      industry,
      isStartup,
      priority,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const where: any = {};

    // Apply filters
    if (status) {
      where.status = status;
    }
    if (industry) {
      where.industry = industry;
    }
    if (isStartup === 'true') {
      where.isStartup = true;
    }
    if (priority) {
      where.priority = priority;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'asc' ? 'asc' : 'desc';

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [inquiries, total] = await Promise.all([
      prisma.enterpriseInquiry.findMany({
        where,
        orderBy: sortOptions,
        skip,
        take: parseInt(limit as string),
      }),
      prisma.enterpriseInquiry.count({ where }),
    ]);

    return ResponseHelpers.ok(res, {
      inquiries,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  }

  /**
   * GET /admin/inquiries/:id - Get single inquiry details
   */
  async getInquiry(req: Request, res: Response) {
    const { id } = req.params;

    const inquiry = await prisma.enterpriseInquiry.findUnique({ where: { id } });

    if (!inquiry) {
      throw AppError.notFound('Inquiry not found');
    }

    return ResponseHelpers.ok(res, { inquiry });
  }

  /**
   * PATCH /admin/inquiries/:id - Update inquiry
   */
  async updateInquiry(req: Request, res: Response) {
    const { id } = req.params;
    const {
      status,
      assignedTo,
      priority,
      followUpDate,
      closedReason,
    } = req.body;

    const inquiry = await prisma.enterpriseInquiry.findUnique({ where: { id } });

    if (!inquiry) {
      throw AppError.notFound('Inquiry not found');
    }

    const dataToUpdate: any = {};

    // Update fields if provided
    if (status) {
      dataToUpdate.status = status;
      if (status === 'closed' || status === 'lost') {
        dataToUpdate.closedAt = new Date();
        if (closedReason) {
          dataToUpdate.closedReason = closedReason;
        }
      }
      if (status === 'contacted') {
        dataToUpdate.lastContactedAt = new Date();
      }
    }
    if (assignedTo !== undefined) {
      dataToUpdate.assignedTo = assignedTo;
    }
    if (priority) {
      dataToUpdate.priority = priority;
    }
    if (followUpDate) {
      dataToUpdate.followUpDate = new Date(followUpDate);
    }

    const updatedInquiry = await prisma.enterpriseInquiry.update({
      where: { id },
      data: dataToUpdate,
    });

    return ResponseHelpers.ok(res, {
      message: 'Inquiry updated successfully',
      inquiry: updatedInquiry,
    });
  }

  /**
   * POST /admin/inquiries/:id/notes - Add note to inquiry
   */
  async addNote(req: any, res: Response) {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      throw AppError.validation('Note content is required');
    }

    const inquiry = await prisma.enterpriseInquiry.findUnique({ where: { id } });

    if (!inquiry) {
      throw AppError.notFound('Inquiry not found');
    }

    // Prisma JSON arrays
    const currentNotes = (inquiry.notes as any[]) || [];
    currentNotes.push({
      content: content.trim(),
      author: req.user?.email || 'Admin',
      createdAt: new Date().toISOString(),
    });

    const updatedInquiry = await prisma.enterpriseInquiry.update({
      where: { id },
      data: { notes: currentNotes },
    });

    return ResponseHelpers.ok(res, {
      message: 'Note added successfully',
      inquiry: updatedInquiry,
    });
  }

  /**
   * GET /admin/inquiries/stats - Get inquiry statistics
   */
  async getStats(req: Request, res: Response) {
    const [
      totalCount,
      newCount,
      contactedCount,
      qualifiedCount,
      closedCount,
      startupCount,
      byIndustry,
      byStatus,
    ] = await Promise.all([
      prisma.enterpriseInquiry.count(),
      prisma.enterpriseInquiry.count({ where: { status: 'new' } }),
      prisma.enterpriseInquiry.count({ where: { status: 'contacted' } }),
      prisma.enterpriseInquiry.count({ where: { status: 'qualified' } }),
      prisma.enterpriseInquiry.count({ where: { status: 'closed' } }),
      prisma.enterpriseInquiry.count({ where: { isStartup: true } }),
      prisma.enterpriseInquiry.groupBy({
        by: ['industry'],
        _count: true,
        where: { industry: { not: '' } },
        orderBy: { _count: { industry: 'desc' } },
        take: 10,
      }),
      prisma.enterpriseInquiry.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    return ResponseHelpers.ok(res, {
      stats: {
        total: totalCount,
        new: newCount,
        contacted: contactedCount,
        qualified: qualifiedCount,
        closed: closedCount,
        startups: startupCount,
        byIndustry: byIndustry.map((item: any) => ({
          industry: item.industry,
          count: item._count,
        })),
        byStatus: byStatus.map((item: any) => ({
          status: item.status,
          count: item._count,
        })),
      },
    });
  }
}

export default EnterpriseInquiryController;

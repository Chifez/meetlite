import { Request, Response } from 'express';
// @ts-ignore
import { AppError, ResponseHelpers, EnterpriseInquiry } from '@minimeet/shared';

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

    const query: any = {};

    // Apply filters
    if (status) {
      query.status = status;
    }
    if (industry) {
      query.industry = industry;
    }
    if (isStartup === 'true') {
      query.isStartup = true;
    }
    if (priority) {
      query.priority = priority;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
      ];
    }

    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [inquiries, total] = await Promise.all([
      EnterpriseInquiry.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit as string))
        .lean(),
      EnterpriseInquiry.countDocuments(query),
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

    const inquiry = await EnterpriseInquiry.findById(id).lean();

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

    const inquiry = await EnterpriseInquiry.findById(id);

    if (!inquiry) {
      throw AppError.notFound('Inquiry not found');
    }

    // Update fields if provided
    if (status) {
      inquiry.status = status;
      if (status === 'closed' || status === 'lost') {
        inquiry.closedAt = new Date();
        if (closedReason) {
          inquiry.closedReason = closedReason;
        }
      }
      if (status === 'contacted') {
        inquiry.lastContactedAt = new Date();
      }
    }
    if (assignedTo !== undefined) {
      inquiry.assignedTo = assignedTo;
    }
    if (priority) {
      inquiry.priority = priority;
    }
    if (followUpDate) {
      inquiry.followUpDate = new Date(followUpDate);
    }

    await inquiry.save();

    return ResponseHelpers.ok(res, {
      message: 'Inquiry updated successfully',
      inquiry,
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

    const inquiry = await EnterpriseInquiry.findById(id);

    if (!inquiry) {
      throw AppError.notFound('Inquiry not found');
    }

    // Add note with author info
    inquiry.notes.push({
      content: content.trim(),
      author: req.user?.email || 'Admin',
      createdAt: new Date(),
    });

    await inquiry.save();

    return ResponseHelpers.ok(res, {
      message: 'Note added successfully',
      inquiry,
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
      EnterpriseInquiry.countDocuments(),
      EnterpriseInquiry.countDocuments({ status: 'new' }),
      EnterpriseInquiry.countDocuments({ status: 'contacted' }),
      EnterpriseInquiry.countDocuments({ status: 'qualified' }),
      EnterpriseInquiry.countDocuments({ status: 'closed' }),
      EnterpriseInquiry.countDocuments({ isStartup: true }),
      EnterpriseInquiry.aggregate([
        { $match: { industry: { $exists: true, $ne: '' } } },
        { $group: { _id: '$industry', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      EnterpriseInquiry.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    return ResponseHelpers.ok(res, {
      stats: {
        total: totalCount,
        new: newCount,
        contacted: contactedCount,
        qualified: qualifiedCount,
        closed: closedCount,
        startups: startupCount,
        byIndustry: byIndustry.map((item) => ({
          industry: item._id,
          count: item.count,
        })),
        byStatus: byStatus.map((item) => ({
          status: item._id,
          count: item.count,
        })),
      },
    });
  }
}

export default EnterpriseInquiryController;

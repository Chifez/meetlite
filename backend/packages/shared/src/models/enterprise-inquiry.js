import mongoose from 'mongoose';

const enterpriseInquirySchema = new mongoose.Schema(
  {
    // Contact Information
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    jobTitle: {
      type: String,
      trim: true,
    },
    linkedIn: {
      type: String,
      trim: true,
    },

    // Company Information
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    companySize: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+', ''],
    },
    industry: {
      type: String,
      enum: [
        'technology',
        'healthcare',
        'finance',
        'education',
        'retail',
        'manufacturing',
        'media',
        'consulting',
        'nonprofit',
        'government',
        'startup',
        'other',
        '',
      ],
    },
    website: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },

    // Use Case Details
    primaryUseCase: {
      type: String,
      enum: [
        'team_meetings',
        'client_calls',
        'webinars',
        'training',
        'remote_work',
        'sales_demos',
        'support',
        'education',
        'other',
        '',
      ],
    },
    expectedUsers: {
      type: String,
      trim: true,
    },
    currentSolution: {
      type: String,
      trim: true,
    },
    timeline: {
      type: String,
      enum: [
        'immediate',
        '1-month',
        '1-3-months',
        '3-6-months',
        '6-months+',
        'just-exploring',
        '',
      ],
    },
    budgetRange: {
      type: String,
      trim: true,
    },

    // Additional Information
    requirements: {
      type: String,
    },
    message: {
      type: String,
    },

    // Startup-specific
    isStartup: {
      type: Boolean,
      default: false,
    },
    fundingStage: {
      type: String,
      enum: [
        'bootstrapped',
        'pre-seed',
        'seed',
        'series-a',
        'series-b',
        'series-c+',
        '',
      ],
    },

    // Tracking
    source: {
      type: String,
      enum: [
        'landing_page',
        'dashboard',
        'settings',
        'pricing_page',
        'unknown',
      ],
      default: 'unknown',
    },
    isAuthenticated: {
      type: Boolean,
      default: false,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // Status and Management
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'negotiating', 'closed', 'lost'],
      default: 'new',
    },
    assignedTo: {
      type: String, // Sales rep name or email
      trim: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    notes: [
      {
        content: {
          type: String,
          required: true,
        },
        author: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    followUpDate: {
      type: Date,
    },
    lastContactedAt: {
      type: Date,
    },
    closedAt: {
      type: Date,
    },
    closedReason: {
      type: String,
      enum: ['won', 'lost', 'no-response', 'not-qualified', 'competitor', ''],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
enterpriseInquirySchema.index({ status: 1, createdAt: -1 });
enterpriseInquirySchema.index({ email: 1 });
enterpriseInquirySchema.index({ companyName: 1 });
enterpriseInquirySchema.index({ industry: 1 });
enterpriseInquirySchema.index({ isStartup: 1 });
enterpriseInquirySchema.index({ assignedTo: 1 });
enterpriseInquirySchema.index({ priority: 1 });

export const EnterpriseInquiry = mongoose.model(
  'EnterpriseInquiry',
  enterpriseInquirySchema
);

export default EnterpriseInquiry;



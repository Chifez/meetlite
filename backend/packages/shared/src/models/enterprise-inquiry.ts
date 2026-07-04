import mongoose, { Schema, Document } from 'mongoose';

export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+' | '';
export type Industry =
  | 'technology'
  | 'healthcare'
  | 'finance'
  | 'education'
  | 'retail'
  | 'manufacturing'
  | 'media'
  | 'consulting'
  | 'nonprofit'
  | 'government'
  | 'startup'
  | 'other'
  | '';

export type PrimaryUseCase =
  | 'team_meetings'
  | 'client_calls'
  | 'webinars'
  | 'training'
  | 'remote_work'
  | 'sales_demos'
  | 'support'
  | 'education'
  | 'other'
  | '';

export type Timeline =
  | 'immediate'
  | '1-month'
  | '1-3-months'
  | '3-6-months'
  | '6-months+'
  | 'just-exploring'
  | '';

export type FundingStage =
  | 'bootstrapped'
  | 'pre-seed'
  | 'seed'
  | 'series-a'
  | 'series-b'
  | 'series-c+'
  | '';

export type InquirySource = 'landing_page' | 'dashboard' | 'settings' | 'pricing_page' | 'unknown';
export type InquiryStatus = 'new' | 'contacted' | 'qualified' | 'negotiating' | 'closed' | 'lost';
export type InquiryPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ClosedReason = 'won' | 'lost' | 'no-response' | 'not-qualified' | 'competitor' | '';

export interface IInquiryNote {
  content: string;
  author: string;
  createdAt: Date;
}

export interface IEnterpriseInquiry {
  name: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  linkedIn?: string;
  companyName: string;
  companySize?: CompanySize;
  industry?: Industry;
  website?: string;
  country?: string;
  primaryUseCase?: PrimaryUseCase;
  expectedUsers?: string;
  currentSolution?: string;
  timeline?: Timeline;
  budgetRange?: string;
  requirements?: string;
  message?: string;
  isStartup: boolean;
  fundingStage?: FundingStage;
  source: InquirySource;
  isAuthenticated: boolean;
  userId?: mongoose.Types.ObjectId;
  status: InquiryStatus;
  assignedTo?: string;
  priority: InquiryPriority;
  notes: IInquiryNote[];
  followUpDate?: Date;
  lastContactedAt?: Date;
  closedAt?: Date;
  closedReason?: ClosedReason;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEnterpriseInquiryDocument extends IEnterpriseInquiry, Document {}

export const enterpriseInquirySchema = new Schema<IEnterpriseInquiryDocument>(
  {
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
    requirements: {
      type: String,
    },
    message: {
      type: String,
    },
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
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'negotiating', 'closed', 'lost'],
      default: 'new',
    },
    assignedTo: {
      type: String,
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

// Indexes
enterpriseInquirySchema.index({ status: 1, createdAt: -1 });
enterpriseInquirySchema.index({ email: 1 });
enterpriseInquirySchema.index({ companyName: 1 });
enterpriseInquirySchema.index({ industry: 1 });
enterpriseInquirySchema.index({ isStartup: 1 });
enterpriseInquirySchema.index({ assignedTo: 1 });
enterpriseInquirySchema.index({ priority: 1 });

export const EnterpriseInquiry = mongoose.model<IEnterpriseInquiryDocument>(
  'EnterpriseInquiry',
  enterpriseInquirySchema
);

export default EnterpriseInquiry;

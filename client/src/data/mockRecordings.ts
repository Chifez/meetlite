import type { MeetingRecording } from '../services/meetingAssetsService';

export const mockRecordings: MeetingRecording[] = [
  {
    id: '1',
    meetingId: 'meeting-1',
    organizationId: 'org-1',
    title: 'Q4 Planning Session',
    description: 'Strategic planning meeting for Q4 objectives and key results',
    recording: {
      fileName: 'q4-planning-session.mp4',
      fileSize: 524288000, // 500MB
      duration: 3600, // 1 hour
      format: 'mp4',
      quality: '1080p',
      downloadUrl: 'https://example.com/recordings/q4-planning-session.mp4',
      streamingUrl: 'https://example.com/stream/q4-planning-session',
      thumbnailUrl:
        'https://via.placeholder.com/640x360/4F46E5/ffffff?text=Q4+Planning',
    },
    transcript: {
      status: 'completed',
      text: "Welcome everyone to our Q4 planning session. Today we'll be discussing our strategic objectives...",
      fileName: 'q4-planning-transcript.pdf',
      fileUrl: 'https://example.com/transcripts/q4-planning-transcript.pdf',
      language: 'en',
      segments: [
        {
          startTime: 0,
          endTime: 15,
          speaker: 'John Smith',
          text: "Welcome everyone to our Q4 planning session. Today we'll be discussing our strategic objectives for the upcoming quarter.",
          confidence: 0.95,
        },
        {
          startTime: 15,
          endTime: 32,
          speaker: 'Sarah Johnson',
          text: "Thank you John. I'd like to start by reviewing our performance metrics from Q3 and how they inform our Q4 strategy.",
          confidence: 0.92,
        },
        {
          startTime: 32,
          endTime: 48,
          speaker: 'Mike Davis',
          text: 'Great point Sarah. Our customer acquisition numbers exceeded expectations by 15%, which gives us a strong foundation for Q4.',
          confidence: 0.89,
        },
      ],
    },
    aiSummary: {
      status: 'completed',
      summary:
        'The Q4 planning session focused on strategic objectives based on strong Q3 performance. The team discussed customer acquisition growth of 15% and set ambitious targets for the final quarter.',
      keyPoints: [
        'Q3 customer acquisition exceeded expectations by 15%',
        'Strong foundation for Q4 strategic initiatives',
        'Focus on scaling successful acquisition channels',
        'Budget allocation for new market expansion',
      ],
      actionItems: [
        {
          task: 'Finalize Q4 budget allocation for marketing campaigns',
          assignee: 'Sarah Johnson',
          dueDate: '2024-01-15',
          priority: 'high',
        },
        {
          task: 'Research new market expansion opportunities',
          assignee: 'Mike Davis',
          dueDate: '2024-01-20',
          priority: 'medium',
        },
      ],
      topics: ['Strategy', 'Planning', 'Budget', 'Marketing', 'Growth'],
      sentiment: {
        overall: 'positive',
        score: 0.8,
      },
    },
    visibility: 'organization',
    participants: [
      {
        userId: 'user-1',
        name: 'John Smith',
        email: 'john@company.com',
        role: 'host',
        speakingTime: 900,
      },
      {
        userId: 'user-2',
        name: 'Sarah Johnson',
        email: 'sarah@company.com',
        role: 'participant',
        speakingTime: 1200,
      },
      {
        userId: 'user-3',
        name: 'Mike Davis',
        email: 'mike@company.com',
        role: 'participant',
        speakingTime: 800,
      },
      {
        userId: 'user-4',
        name: 'Lisa Chen',
        email: 'lisa@company.com',
        role: 'participant',
        speakingTime: 600,
      },
    ],
    processingStatus: 'completed',
    processingProgress: 100,
    tags: ['planning', 'strategy', 'q4', 'meeting'],
    analytics: {
      viewCount: 24,
      downloadCount: 5,
      lastViewed: '2024-01-10T14:30:00Z',
    },
    createdAt: '2024-01-08T09:00:00Z',
    updatedAt: '2024-01-08T11:30:00Z',
  },
  {
    id: '2',
    meetingId: 'meeting-2',
    organizationId: 'org-1',
    title: 'Weekly Team Standup',
    description: 'Regular weekly standup with the development team',
    recording: {
      fileName: 'weekly-standup-jan8.mp4',
      fileSize: 104857600, // 100MB
      duration: 1800, // 30 minutes
      format: 'mp4',
      quality: '720p',
      downloadUrl: 'https://example.com/recordings/weekly-standup-jan8.mp4',
      streamingUrl: 'https://example.com/stream/weekly-standup-jan8',
      thumbnailUrl:
        'https://via.placeholder.com/640x360/10B981/ffffff?text=Team+Standup',
    },
    transcript: {
      status: 'processing',
      language: 'en',
    },
    aiSummary: {
      status: 'pending',
      keyPoints: [],
      actionItems: [],
      topics: [],
    },
    visibility: 'participants',
    participants: [
      {
        userId: 'user-5',
        name: 'Alex Rivera',
        email: 'alex@company.com',
        role: 'host',
        speakingTime: 300,
      },
      {
        userId: 'user-6',
        name: 'Emma Wilson',
        email: 'emma@company.com',
        role: 'participant',
        speakingTime: 450,
      },
      {
        userId: 'user-7',
        name: 'David Kim',
        email: 'david@company.com',
        role: 'participant',
        speakingTime: 380,
      },
    ],
    processingStatus: 'processing',
    processingProgress: 65,
    tags: ['standup', 'development', 'weekly'],
    analytics: {
      viewCount: 8,
      downloadCount: 0,
      lastViewed: '2024-01-09T10:15:00Z',
    },
    createdAt: '2024-01-08T15:00:00Z',
    updatedAt: '2024-01-09T10:15:00Z',
  },
  {
    id: '3',
    meetingId: 'meeting-3',
    organizationId: 'org-1',
    title: 'Product Demo for Enterprise Client',
    description:
      'Demo session showcasing new features to potential enterprise customer',
    recording: {
      fileName: 'enterprise-demo-acme.mp4',
      fileSize: 314572800, // 300MB
      duration: 2700, // 45 minutes
      format: 'mp4',
      quality: '1080p',
      downloadUrl: 'https://example.com/recordings/enterprise-demo-acme.mp4',
      streamingUrl: 'https://example.com/stream/enterprise-demo-acme',
      thumbnailUrl:
        'https://via.placeholder.com/640x360/F59E0B/ffffff?text=Product+Demo',
    },
    transcript: {
      status: 'completed',
      text: 'Thank you for joining us today for this product demonstration...',
      fileName: 'enterprise-demo-transcript.pdf',
      fileUrl: 'https://example.com/transcripts/enterprise-demo-transcript.pdf',
      language: 'en',
      segments: [
        {
          startTime: 0,
          endTime: 20,
          speaker: 'Sales Rep',
          text: "Thank you for joining us today for this product demonstration. We're excited to show you how our platform can transform your workflow.",
          confidence: 0.94,
        },
        {
          startTime: 20,
          endTime: 35,
          speaker: 'Client',
          text: "We're looking forward to seeing how this integrates with our existing systems.",
          confidence: 0.91,
        },
      ],
    },
    aiSummary: {
      status: 'completed',
      summary:
        'Successful product demonstration to enterprise client showcasing key features and integration capabilities. Client showed strong interest in the platform.',
      keyPoints: [
        'Demonstrated core platform features',
        'Showed integration capabilities with existing systems',
        'Client expressed strong interest',
        'Discussed implementation timeline',
      ],
      actionItems: [
        {
          task: 'Send detailed proposal with pricing',
          assignee: 'Sales Team',
          dueDate: '2024-01-12',
          priority: 'high',
        },
        {
          task: 'Schedule technical integration call',
          assignee: 'Technical Team',
          dueDate: '2024-01-15',
          priority: 'medium',
        },
      ],
      topics: ['Demo', 'Sales', 'Integration', 'Enterprise'],
      sentiment: {
        overall: 'positive',
        score: 0.85,
      },
    },
    visibility: 'private',
    participants: [
      {
        userId: 'user-8',
        name: 'Tom Anderson',
        email: 'tom@company.com',
        role: 'host',
        speakingTime: 1600,
      },
      {
        userId: 'user-9',
        name: 'Client Representative',
        email: 'client@acme.com',
        role: 'participant',
        speakingTime: 800,
      },
    ],
    processingStatus: 'completed',
    processingProgress: 100,
    tags: ['demo', 'sales', 'enterprise', 'client'],
    analytics: {
      viewCount: 12,
      downloadCount: 3,
      lastViewed: '2024-01-09T16:45:00Z',
    },
    createdAt: '2024-01-05T14:00:00Z',
    updatedAt: '2024-01-06T09:30:00Z',
  },
  {
    id: '4',
    meetingId: 'meeting-4',
    organizationId: 'org-1',
    title: 'Design Review - Mobile App UI',
    description:
      'Review of new mobile app interface designs and user experience',
    recording: {
      fileName: 'design-review-mobile.mp4',
      fileSize: 157286400, // 150MB
      duration: 2100, // 35 minutes
      format: 'mp4',
      quality: '720p',
      downloadUrl: 'https://example.com/recordings/design-review-mobile.mp4',
      streamingUrl: 'https://example.com/stream/design-review-mobile',
      thumbnailUrl:
        'https://via.placeholder.com/640x360/8B5CF6/ffffff?text=Design+Review',
    },
    transcript: {
      status: 'failed',
      language: 'en',
    },
    aiSummary: {
      status: 'failed',
      keyPoints: [],
      actionItems: [],
      topics: [],
    },
    visibility: 'organization',
    participants: [
      {
        userId: 'user-10',
        name: 'Jessica Park',
        email: 'jessica@company.com',
        role: 'host',
        speakingTime: 800,
      },
      {
        userId: 'user-11',
        name: 'Ryan Martinez',
        email: 'ryan@company.com',
        role: 'participant',
        speakingTime: 600,
      },
      {
        userId: 'user-12',
        name: 'Sophie Taylor',
        email: 'sophie@company.com',
        role: 'participant',
        speakingTime: 700,
      },
    ],
    processingStatus: 'completed',
    processingProgress: 100,
    tags: ['design', 'mobile', 'ui', 'review'],
    analytics: {
      viewCount: 18,
      downloadCount: 2,
      lastViewed: '2024-01-09T11:20:00Z',
    },
    createdAt: '2024-01-04T16:30:00Z',
    updatedAt: '2024-01-04T18:45:00Z',
  },
  {
    id: '5',
    meetingId: 'meeting-5',
    organizationId: 'org-1',
    title: 'Customer Feedback Session',
    description:
      'Gathering feedback from key customers about recent product updates',
    recording: {
      fileName: 'customer-feedback-session.mp4',
      fileSize: 209715200, // 200MB
      duration: 2400, // 40 minutes
      format: 'mp4',
      quality: '1080p',
      downloadUrl:
        'https://example.com/recordings/customer-feedback-session.mp4',
      streamingUrl: 'https://example.com/stream/customer-feedback-session',
      thumbnailUrl:
        'https://via.placeholder.com/640x360/EF4444/ffffff?text=Customer+Feedback',
    },
    transcript: {
      status: 'pending',
      language: 'en',
    },
    aiSummary: {
      status: 'pending',
      keyPoints: [],
      actionItems: [],
      topics: [],
    },
    visibility: 'participants',
    participants: [
      {
        userId: 'user-13',
        name: 'Maria Garcia',
        email: 'maria@company.com',
        role: 'host',
        speakingTime: 600,
      },
      {
        userId: 'user-14',
        name: 'Customer A',
        email: 'customer1@external.com',
        role: 'participant',
        speakingTime: 900,
      },
      {
        userId: 'user-15',
        name: 'Customer B',
        email: 'customer2@external.com',
        role: 'participant',
        speakingTime: 800,
      },
    ],
    processingStatus: 'uploading',
    processingProgress: 25,
    tags: ['feedback', 'customer', 'product'],
    analytics: {
      viewCount: 3,
      downloadCount: 0,
      lastViewed: '2024-01-09T13:10:00Z',
    },
    createdAt: '2024-01-09T13:00:00Z',
    updatedAt: '2024-01-09T13:10:00Z',
  },
  {
    id: '6',
    meetingId: 'meeting-6',
    organizationId: 'org-1',
    title: 'Security Audit Review',
    description: 'Annual security audit findings and remediation planning',
    recording: {
      fileName: 'security-audit-2024.mp4',
      fileSize: 419430400, // 400MB
      duration: 4200, // 70 minutes
      format: 'mp4',
      quality: '720p',
      downloadUrl: 'https://example.com/recordings/security-audit-2024.mp4',
      streamingUrl: 'https://example.com/stream/security-audit-2024',
      thumbnailUrl:
        'https://via.placeholder.com/640x360/374151/ffffff?text=Security+Audit',
    },
    transcript: {
      status: 'completed',
      text: 'Today we are reviewing the findings from our annual security audit...',
      fileName: 'security-audit-transcript.pdf',
      fileUrl: 'https://example.com/transcripts/security-audit-transcript.pdf',
      language: 'en',
    },
    aiSummary: {
      status: 'completed',
      summary:
        'Comprehensive review of security audit findings with priority remediation items identified. Overall security posture is strong with minor improvements needed.',
      keyPoints: [
        'Overall security posture rated as strong',
        'Three medium-priority vulnerabilities identified',
        'Access control procedures need updating',
        'Compliance requirements met for SOC2',
      ],
      actionItems: [
        {
          task: 'Update access control documentation',
          assignee: 'Security Team',
          dueDate: '2024-01-25',
          priority: 'high',
        },
        {
          task: 'Patch identified vulnerabilities',
          assignee: 'DevOps Team',
          dueDate: '2024-01-30',
          priority: 'medium',
        },
      ],
      topics: ['Security', 'Audit', 'Compliance', 'Vulnerabilities'],
      sentiment: {
        overall: 'neutral',
        score: 0.1,
      },
    },
    visibility: 'private',
    participants: [
      {
        userId: 'user-16',
        name: 'James Wilson',
        email: 'james@company.com',
        role: 'host',
        speakingTime: 1800,
      },
      {
        userId: 'user-17',
        name: 'Security Auditor',
        email: 'auditor@securityfirm.com',
        role: 'participant',
        speakingTime: 2000,
      },
    ],
    processingStatus: 'completed',
    processingProgress: 100,
    tags: ['security', 'audit', 'compliance', 'private'],
    analytics: {
      viewCount: 7,
      downloadCount: 4,
      lastViewed: '2024-01-08T17:30:00Z',
    },
    createdAt: '2024-01-03T10:00:00Z',
    updatedAt: '2024-01-03T15:30:00Z',
  },
];

export const mockStats = {
  totalRecordings: mockRecordings.length,
  totalSize: mockRecordings.reduce(
    (sum, recording) => sum + recording.recording.fileSize,
    0
  ),
  totalDuration: mockRecordings.reduce(
    (sum, recording) => sum + recording.recording.duration,
    0
  ),
  completedTranscripts: mockRecordings.filter(
    (r) => r.transcript.status === 'completed'
  ).length,
  completedSummaries: mockRecordings.filter(
    (r) => r.aiSummary.status === 'completed'
  ).length,
};

export const mockPagination = {
  page: 1,
  limit: 20,
  total: mockRecordings.length,
  totalPages: Math.ceil(mockRecordings.length / 20),
};

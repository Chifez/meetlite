import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
  // Organization scope for multi-tenancy
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true,
    default: null, // null means personal workspace
  },
  // Team scope - optional, only present when room belongs to a team
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    index: true,
    default: null, // null means organization-level room
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Enhanced room state for collaboration
  collaborationMode: {
    type: String,
    enum: ['none', 'workflow', 'whiteboard', 'code'],
    default: 'none',
  },
  activeTool: {
    type: String,
    enum: ['none', 'workflow', 'whiteboard', 'code'],
    default: 'none',
  },
  participants: [
    {
      userId: {
        type: String,
        required: true,
      },
      role: {
        type: String,
        enum: ['host', 'presenter', 'viewer'],
        default: 'viewer',
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
      lastActive: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  // Collaboration data storage
  workflowData: {
    nodes: [
      {
        id: String,
        type: String,
        position: {
          x: Number,
          y: Number,
        },
        data: mongoose.Schema.Types.Mixed,
      },
    ],
    edges: [
      {
        id: String,
        source: String,
        target: String,
        type: String,
      },
    ],
    lastModified: Date,
    lastModifiedBy: String,
  },
  whiteboardData: {
    // Tldraw will handle this internally, we just store metadata
    lastModified: Date,
    lastModifiedBy: String,
    version: {
      type: Number,
      default: 0,
    },
  },
  codeData: {
    code: {
      type: String,
      default: '',
    },
    language: {
      type: String,
      default: 'javascript',
    },
    version: {
      type: Number,
      default: 0,
    },
    lastModified: Date,
    lastModifiedBy: String,
  },
  settings: {
    allowCollaboration: {
      type: Boolean,
      default: true,
    },
    requirePermission: {
      type: Boolean,
      default: false,
    },
    maxParticipants: {
      type: Number,
      default: 50,
    },
  },
});

// Indexes for better performance
roomSchema.index({ roomId: 1 }, { unique: true }); // ✅ Ensure unique index
roomSchema.index({ organizationId: 1, createdBy: 1 }); // ✅ Compound index for org queries
roomSchema.index({ organizationId: 1, teamId: 1 }); // ✅ Compound index for team queries
roomSchema.index({ 'participants.userId': 1 }); // ✅ Index for participant lookups
roomSchema.index({ collaborationMode: 1 }); // ✅ Index for collaboration queries
roomSchema.index({ createdAt: -1 }); // ✅ Index for time-based queries (if needed)

// Export the schema for use with the model factory
export { roomSchema };

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
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Enhanced room state for collaboration
  collaborationMode: {
    type: String,
    enum: ['none', 'workflow', 'whiteboard'],
    default: 'none',
  },
  activeTool: {
    type: String,
    enum: ['none', 'workflow', 'whiteboard'],
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
roomSchema.index({ roomId: 1 });
roomSchema.index({ 'participants.userId': 1 });
roomSchema.index({ collaborationMode: 1 });

export default mongoose.model('Room', roomSchema);

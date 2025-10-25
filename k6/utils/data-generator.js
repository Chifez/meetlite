// Simplified data generator for K6 tests
// Only generates room data since we're using single user authentication

export class DataGenerator {
  constructor() {
    this.roomCounter = 0;
  }

  // Generate room data for testing
  generateRoomData() {
    this.roomCounter++;

    return {
      roomId: `test-room-${this.roomCounter}-${Date.now()}`,
      name: `Test Room ${this.roomCounter}`,
      description: `Performance test room ${this.roomCounter}`,
      settings: {
        allowCollaboration: true,
        maxParticipants: 15, // Realistic for P2P architecture
        privacy: 'public',
      },
      createdAt: new Date().toISOString(),
    };
  }

  // Generate random room settings for testing
  generateRoomSettings() {
    return {
      allowCollaboration: Math.random() > 0.5,
      maxParticipants: Math.floor(Math.random() * 8) + 8, // 8-15 participants (realistic for P2P)
      privacy: Math.random() > 0.5 ? 'public' : 'private',
    };
  }

  // Generate collaboration data for testing
  generateCollaborationData() {
    return {
      tool: ['whiteboard', 'document', 'presentation'][
        Math.floor(Math.random() * 3)
      ],
      action: ['create', 'update', 'delete'][Math.floor(Math.random() * 3)],
      timestamp: new Date().toISOString(),
      data: {
        x: Math.random() * 100,
        y: Math.random() * 100,
        value: `Test collaboration data ${Date.now()}`,
      },
    };
  }

  // Generate media state for testing
  generateMediaState() {
    return {
      audio: Math.random() > 0.5,
      video: Math.random() > 0.5,
      screenShare: Math.random() > 0.8,
      timestamp: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const dataGenerator = new DataGenerator();

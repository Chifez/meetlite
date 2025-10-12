import mongoose from 'mongoose';

/**
 * Shared MongoDB Connection Pool
 *
 * This creates a connection pool that can be shared across services
 * while maintaining service independence
 */

class ConnectionPool {
  constructor() {
    this.connections = new Map();
  }

  /**
   * Get or create a connection for a specific service
   * @param {string} serviceName - Name of the service (e.g., 'auth', 'room')
   * @param {string} uri - MongoDB connection URI
   * @returns {Promise<Object>} Mongoose connection
   */
  async getConnection(serviceName, uri) {
    if (!this.connections.has(serviceName)) {
      const connection = await mongoose.createConnection(uri, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        useUnifiedTopology: true,
      });

      // Handle connection events
      connection.on('error', (err) => {
        console.error(`MongoDB connection error for ${serviceName}:`, err);
      });

      connection.on('disconnected', () => {});

      connection.on('reconnected', () => {});

      this.connections.set(serviceName, connection);
    }

    return this.connections.get(serviceName);
  }

  /**
   * Close all connections
   */
  async closeAll() {
    const closePromises = Array.from(this.connections.values()).map((conn) =>
      conn.close()
    );
    await Promise.all(closePromises);
    this.connections.clear();
  }

  /**
   * Get connection status
   */
  getStatus() {
    const status = {};
    for (const [serviceName, connection] of this.connections) {
      status[serviceName] = {
        readyState: connection.readyState,
        host: connection.host,
        port: connection.port,
        name: connection.name,
      };
    }
    return status;
  }
}

// Export singleton instance
const connectionPool = new ConnectionPool();
export default connectionPool;

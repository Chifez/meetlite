/**
 * WebSocket Client for K6 Tests
 * Handles Socket.IO connections for real-time testing
 *
 * Note: k6 doesn't have native WebSocket support for Socket.IO
 * This is a simplified client that works with k6's HTTP capabilities
 * For full Socket.IO testing, consider using k6/browser or external tools
 */

import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { CONFIG } from '../../config/index.js';

// Custom metrics for WebSocket operations
const wsConnectionSuccess = new Rate('ws_connection_success');
const wsConnectionTime = new Trend('ws_connection_time');
const wsMessageSuccess = new Rate('ws_message_success');

/**
 * WebSocket Client Class
 * Simplified WebSocket client using HTTP polling (Socket.IO fallback)
 *
 * Syntax explanation:
 * - Stores connection state in instance
 * - Uses HTTP polling to simulate WebSocket behavior
 * - Maintains session for Socket.IO compatibility
 */
export class WebSocketClient {
  /**
   * Constructor
   * @param {string} baseUrl - WebSocket server URL (MediaSoup service)
   * @param {string} token - JWT authentication token
   *
   * Syntax explanation:
   * - Constructor initializes instance properties
   * - this.sid stores Socket.IO session ID
   * - this.connected tracks connection state
   */
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl || CONFIG.services.mediasoup;
    this.token = token;
    this.sid = null; // Socket.IO session ID
    this.connected = false;
    this.transport = 'polling'; // Start with polling, upgrade to websocket
  }

  /**
   * Connect to WebSocket (Socket.IO handshake)
   * @returns {boolean} - True if connection successful
   *
   * Socket.IO Connection Flow:
   * 1. HTTP GET to /socket.io/?EIO=4&transport=polling (handshake)
   * 2. Server returns session ID (sid)
   * 3. Upgrade to websocket using sid
   *
   * Syntax explanation:
   * - try/catch handles errors gracefully
   * - const { ... } = object destructuring
   * - ?. is optional chaining (safe property access)
   */
  connect() {
    if (this.connected) {
      return true; // Already connected
    }

    const startTime = Date.now();

    try {
      // Step 1: Socket.IO handshake (HTTP polling)
      // EIO=4 means Engine.IO protocol version 4
      const handshakeUrl = `${this.baseUrl}/socket.io/?EIO=4&transport=polling`;

      const handshakeRes = http.get(handshakeUrl, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        timeout: 10000,
      });

      // Check if handshake was successful
      const handshakeOk = check(handshakeRes, {
        'websocket handshake successful': (r) => r.status === 200,
      });

      if (!handshakeOk) {
        wsConnectionSuccess.add(0);
        return false;
      }

      // Step 2: Extract session ID from response
      // Socket.IO returns format like: 0{"sid":"abc123",...}
      // We need to parse this to get the sid
      let sid = null;
      try {
        const body = handshakeRes.body;
        // Socket.IO format: 0{...} where 0 is message type, {...} is JSON
        if (body && body.startsWith('0')) {
          const jsonStr = body.substring(1); // Remove first character '0'
          const data = JSON.parse(jsonStr);
          sid = data.sid; // Extract session ID
        }
      } catch (e) {
        // If parsing fails, connection still might work
        console.log('Could not parse session ID, continuing...');
      }

      if (sid) {
        this.sid = sid;
      }

      // Mark as connected
      this.connected = true;
      const connectionTime = Date.now() - startTime;

      wsConnectionSuccess.add(1);
      wsConnectionTime.add(connectionTime);

      return true;
    } catch (error) {
      wsConnectionSuccess.add(0);
      this.connected = false;
      return false;
    }
  }

  /**
   * Send message via WebSocket (using HTTP POST for Socket.IO)
   * @param {string} event - Event name (e.g., 'join-room', 'chat-message')
   * @param {Object} data - Message data
   * @returns {boolean} - True if message sent successfully
   *
   * Socket.IO Message Format:
   * - Uses HTTP POST to /socket.io/?EIO=4&transport=polling&sid={sid}
   * - Message format: 42["event-name", {data}]
   * - 42 = message type (event), array contains [event, data]
   *
   * Syntax explanation:
   * - JSON.stringify() converts object to JSON string
   * - Template literal constructs message format
   * - Array format [event, data] is Socket.IO standard
   */
  sendMessage(event, data) {
    if (!this.connected) {
      // Try to reconnect if not connected
      if (!this.connect()) {
        return false;
      }
    }

    try {
      // Construct Socket.IO message
      // Format: 42["event-name", {data}]
      // 42 = message type (event)
      // Array contains [event name, event data]
      const message = `42["${event}",${JSON.stringify(data)}]`;

      // Build URL with session ID
      const url = `${this.baseUrl}/socket.io/?EIO=4&transport=polling&sid=${
        this.sid || ''
      }`;

      // Send message via HTTP POST (Socket.IO polling transport)
      const res = http.post(url, message, {
        headers: {
          'Content-Type': 'text/plain',
          Authorization: `Bearer ${this.token}`,
        },
        timeout: 5000,
      });

      const success = check(res, {
        'message sent': (r) => r.status === 200,
      });

      wsMessageSuccess.add(success ? 1 : 0);
      return success;
    } catch (error) {
      wsMessageSuccess.add(0);
      return false;
    }
  }

  /**
   * Join a room via Socket.IO
   * @param {string} roomId - Room ID to join
   * @returns {boolean} - True if join successful
   *
   * Syntax explanation:
   * - Calls sendMessage with specific event and data
   * - Simplified wrapper for common operation
   */
  joinRoom(roomId) {
    return this.sendMessage('join-room', { roomId });
  }

  /**
   * Leave a room via Socket.IO
   * @param {string} roomId - Room ID to leave
   * @returns {boolean} - True if leave successful
   */
  leaveRoom(roomId) {
    return this.sendMessage('leave-room', { roomId });
  }

  /**
   * Send chat message
   * @param {string} roomId - Room ID
   * @param {string} message - Chat message text
   * @returns {boolean} - True if message sent
   */
  sendChatMessage(roomId, message) {
    return this.sendMessage('chat-message', {
      roomId,
      message,
    });
  }

  /**
   * Disconnect from WebSocket
   * @returns {boolean} - True if disconnect successful
   *
   * Syntax explanation:
   * - Resets connection state
   * - Clears session ID
   */
  disconnect() {
    try {
      // Send disconnect message if connected
      if (this.connected && this.sid) {
        // Socket.IO disconnect format: 1 (message type 1 = disconnect)
        const url = `${this.baseUrl}/socket.io/?EIO=4&transport=polling&sid=${this.sid}`;
        http.post(url, '1', {
          headers: {
            'Content-Type': 'text/plain',
            Authorization: `Bearer ${this.token}`,
          },
          timeout: 2000,
        });
      }

      // Reset connection state
      this.connected = false;
      this.sid = null;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if connected
   * @returns {boolean} - Connection status
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get connection statistics
   * @returns {Object} - Connection stats
   */
  getStats() {
    return {
      connected: this.connected,
      sid: this.sid,
      connectionSuccessRate: wsConnectionSuccess.value,
      connectionTime: wsConnectionTime.value,
      messageSuccessRate: wsMessageSuccess.value,
    };
  }
}

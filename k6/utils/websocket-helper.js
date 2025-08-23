import { check } from 'k6';
import ws from 'k6/ws';
import { Rate, Trend } from 'k6/metrics';
import http from 'k6/http'; // Added for HTTP upgrade

// Custom metrics for WebSocket operations
const wsConnectionRate = new Rate('ws_connection_success');
const wsJoinRoomRate = new Rate('ws_join_room_success');
const wsMessageRate = new Rate('ws_message_success');
const wsConnectionTime = new Trend('ws_connection_time');
const wsJoinRoomTime = new Trend('ws_join_room_time');

export class WebSocketHelper {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.connections = new Map(); // token -> socket
  }

  // Connect to Socket.IO with JWT token using K6's WebSocket support
  connectWebSocket(token) {
    const startTime = Date.now();

    try {
      // Socket.IO v4 connection - use HTTP upgrade first, then WebSocket
      const url = `${this.baseUrl}/socket.io/?EIO=4&transport=websocket`;

      // For Socket.IO v4, we need to handle the handshake properly
      // First, make an HTTP request to get the session
      const handshakeResponse = http.get(
        `${this.baseUrl}/socket.io/?EIO=4&transport=polling`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (handshakeResponse.status !== 200) {
        console.error(
          `❌ Socket.IO handshake failed: ${handshakeResponse.status}`
        );
        wsConnectionRate.add(0);
        return false;
      }

      // Safely extract session ID from handshake response
      let sessionId;
      try {
        const handshakeData = handshakeResponse.json();
        sessionId = handshakeData.sid;
        if (!sessionId) {
          console.error('❌ No session ID found in handshake response');
          wsConnectionRate.add(0);
          return false;
        }
      } catch (error) {
        console.error('❌ Failed to parse handshake response:', error.message);
        wsConnectionRate.add(0);
        return false;
      }

      // Now connect via WebSocket with the session
      const wsUrl = `${this.baseUrl.replace(
        'http',
        'ws'
      )}/socket.io/?EIO=4&transport=websocket&sid=${sessionId}`;

      const response = ws.connect(
        wsUrl,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        function (socket) {
          console.log(
            `✅ WebSocket connected for token: ${token.substring(0, 20)}...`
          );

          // Store connection by token
          this.connections.set(token, socket);

          // Handle incoming messages
          socket.on('message', function (message) {
            try {
              const data = JSON.parse(message);
              console.log(`📨 Received message: ${data.type || 'unknown'}`);
            } catch (e) {
              console.log(`📨 Raw message: ${message}`);
            }
          });

          // Handle connection close
          socket.on(
            'close',
            function () {
              console.log(
                `🔌 WebSocket disconnected for token: ${token.substring(
                  0,
                  20
                )}...`
              );
              this.connections.delete(token);
            }.bind(this)
          );

          // Handle errors
          socket.on('error', function (error) {
            console.error(`❌ WebSocket error: ${error}`);
          });
        }.bind(this)
      );

      // Validate response object
      if (!response) {
        console.error(
          '❌ WebSocket connection returned null/undefined response'
        );
        wsConnectionRate.add(0);
        return false;
      }

      const connectionTime = Date.now() - startTime;
      wsConnectionTime.add(connectionTime);

      // Check connection success
      const success = check(response, {
        'websocket connection successful': (r) => r && r.status === 101,
        'websocket connection time < 2s': (r) =>
          r && r.timings && r.timings.duration < 2000,
      });

      if (success) {
        wsConnectionRate.add(1);

        // Add a small delay to allow connection to stabilize
        const stabilizeDelay = 100; // 100ms delay
        const endTime = Date.now() + stabilizeDelay;
        while (Date.now() < endTime) {
          // Small delay to stabilize connection
        }

        return true;
      } else {
        wsConnectionRate.add(0);
        console.log(
          `❌ WebSocket connection failed for token: ${token.substring(
            0,
            20
          )}...`
        );
        return false;
      }
    } catch (error) {
      wsConnectionRate.add(0);
      console.error(`❌ WebSocket connection error: ${error.message}`);
      return false;
    }
  }

  // Join Socket.IO room (this is just joining the room, not HTTP API)
  joinRoom(token, roomId) {
    const startTime = Date.now();
    const socket = this.connections.get(token);

    if (!socket) {
      console.error(
        `❌ No WebSocket connection found for token: ${token.substring(
          0,
          20
        )}...`
      );
      wsJoinRoomRate.add(0);
      return false;
    }

    try {
      // In Socket.IO, joining a room is handled by the server when we emit 'join-room'
      // The server will call socket.join(roomId) internally
      socket.send(
        JSON.stringify({
          type: 'join-room',
          roomId: roomId,
        })
      );

      const joinTime = Date.now() - startTime;
      wsJoinRoomTime.add(joinTime);
      wsJoinRoomRate.add(1);

      console.log(`✅ Joined Socket.IO room: ${roomId}`);
      return true;
    } catch (error) {
      wsJoinRoomRate.add(0);
      console.error(`❌ Failed to join room: ${error.message}`);
      return false;
    }
  }

  // Send chat message via WebSocket
  sendChatMessage(token, roomId, message) {
    const socket = this.connections.get(token);

    if (!socket) {
      console.error(
        `❌ No WebSocket connection found for token: ${token.substring(
          0,
          20
        )}...`
      );
      return false;
    }

    try {
      socket.send(
        JSON.stringify({
          type: 'chat-message',
          roomId: roomId,
          message: message,
        })
      );

      wsMessageRate.add(1);
      return true;
    } catch (error) {
      wsMessageRate.add(0);
      console.error(`❌ Failed to send chat message: ${error.message}`);
      return false;
    }
  }

  // Send real-time message (like collaboration events)
  sendMessage(token, roomId, eventType, data) {
    const socket = this.connections.get(token);

    if (!socket) {
      console.error(
        `❌ No WebSocket connection found for token: ${token.substring(
          0,
          20
        )}...`
      );
      return false;
    }

    try {
      socket.send(
        JSON.stringify({
          type: eventType,
          roomId: roomId,
          data: data,
        })
      );

      wsMessageRate.add(1);
      return true;
    } catch (error) {
      wsMessageRate.add(0);
      console.error(`❌ Failed to send message: ${error.message}`);
      return false;
    }
  }

  // Leave Socket.IO room
  leaveRoom(token, roomId) {
    const socket = this.connections.get(token);

    if (!socket) {
      console.error(
        `❌ No WebSocket connection found for token: ${token.substring(
          0,
          20
        )}...`
      );
      return false;
    }

    try {
      socket.send(
        JSON.stringify({
          type: 'leave-room',
          roomId: roomId,
        })
      );

      console.log(`✅ Left Socket.IO room: ${roomId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to leave room: ${error.message}`);
      return false;
    }
  }

  // Disconnect WebSocket
  disconnectWebSocket(token) {
    const socket = this.connections.get(token);

    if (socket) {
      try {
        socket.close();
        this.connections.delete(token);
        console.log(
          `✅ WebSocket disconnected for token: ${token.substring(0, 20)}...`
        );
        return true;
      } catch (error) {
        console.error(`❌ Error disconnecting WebSocket: ${error.message}`);
        return false;
      }
    }

    return false;
  }

  // Get connection stats
  getConnectionStats() {
    return {
      activeConnections: this.connections.size,
      connectionSuccessRate: wsConnectionRate.value,
      joinRoomSuccessRate: wsJoinRoomRate.value,
      messageSuccessRate: wsMessageRate.value,
      avgConnectionTime: wsConnectionTime.value,
      avgJoinRoomTime: wsJoinRoomTime.value,
    };
  }
}

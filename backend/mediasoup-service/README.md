# Mediasoup Service

A scalable media server using mediasoup for MeetLite video conferencing application.

## Overview

This service replaces the peer-to-peer WebRTC architecture with a Selective Forwarding Unit (SFU) approach using mediasoup. This provides better scalability and performance for multi-participant video conferences.

## Features

- **Scalable Architecture**: SFU-based media routing supports many participants
- **Multiple Codecs**: VP8, VP9, H.264 for video; Opus for audio
- **Screen Sharing**: Dedicated producer/consumer handling for screen content
- **Connection Recovery**: Robust error handling and reconnection logic
- **Resource Management**: Worker-based architecture with proper cleanup

## Prerequisites

- Node.js 18+
- mediasoup system requirements:
  - Linux/macOS (Windows supported with limitations)
  - Python 3.6+ for native module compilation
  - Build tools (make, gcc, etc.)

## Installation

1. Install dependencies:

```bash
cd backend/mediasoup-service
npm install
```

2. Copy environment configuration:

```bash
cp .env.example .env
```

3. Configure environment variables:

```env
PORT=3003
JWT_SECRET=your-jwt-secret-key
CORS_ORIGIN=http://localhost:5173
MEDIASOUP_LOG_LEVEL=warn
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=your-public-ip
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=49999
```

## Configuration

### Network Configuration

**For Local Development:**

```env
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=127.0.0.1
```

**For Production:**

```env
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=your-server-public-ip
```

### Port Configuration

The service uses a range of UDP ports for media transmission:

- Default range: 40000-49999
- Ensure these ports are open in your firewall
- For production, consider a smaller range to minimize attack surface

### Worker Configuration

- Workers are automatically scaled based on CPU cores
- Windows is limited to 1 worker due to mediasoup limitations
- Each worker can handle multiple routers and rooms

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

### Testing

Access health endpoint:

```bash
curl http://localhost:3003/health
```

Access stats endpoint:

```bash
curl http://localhost:3003/stats
```

## Architecture

### Components

1. **MediasoupServer**: Main server class managing workers and rooms
2. **Worker**: Manages mediasoup workers and routers
3. **Room**: Handles room-specific logic and participant management
4. **Participant**: Manages individual participant state
5. **ProducerHandler**: Handles media production (sending)
6. **ConsumerHandler**: Handles media consumption (receiving)

### Data Flow

1. Client connects via Socket.io with JWT authentication
2. Client joins room and receives router RTP capabilities
3. Client creates WebRTC transport
4. Client produces media (audio/video) via transport
5. Server creates consumers for other participants
6. Media flows through mediasoup router to all consumers

## API Events

### Client → Server

- `join-room`: Join a media room
- `create-webrtc-transport`: Create WebRTC transport
- `connect-webrtc-transport`: Connect transport with DTLS parameters
- `set-rtp-capabilities`: Set client RTP capabilities
- `create-producer`: Create media producer
- `resume-consumer`: Resume media consumer
- `pause-producer`/`resume-producer`: Control producer state

### Server → Client

- `router-rtp-capabilities`: Router capabilities for client setup
- `webrtc-transport-created`: Transport creation response
- `producer-created`: Producer creation confirmation
- `new-consumer`: New consumer available
- `participant-joined`/`participant-left`: Room participant changes

## Troubleshooting

### Common Issues

**1. Blank Video (Remote streams not playing)**

- Check consumer resume logic
- Verify RTP capabilities compatibility
- Ensure proper event handling

**2. Connection Timeouts**

- Verify network configuration
- Check firewall/NAT settings
- Confirm ANNOUNCED_IP is correct

**3. Audio/Video Quality Issues**

- Adjust bitrate settings in config
- Check network bandwidth
- Monitor CPU usage

### Debug Mode

Enable debug logging:

```env
MEDIASOUP_LOG_LEVEL=debug
LOG_LEVEL=debug
```

Check browser console for client-side errors and network tab for WebRTC connection details.

### Monitoring

Monitor the `/stats` endpoint for:

- Worker resource usage
- Room and participant counts
- Producer/Consumer statistics
- Connection health

## Performance Tuning

### Server-Side

1. **Worker Count**: Adjust based on CPU cores and load
2. **Bitrate Limits**: Configure based on available bandwidth
3. **Port Range**: Use minimal range for better security
4. **Resource Monitoring**: Monitor CPU and memory usage

### Client-Side

1. **Video Resolution**: Adjust based on device capabilities
2. **Frame Rate**: Lower for better performance on weak devices
3. **Codec Selection**: Prefer VP8 for compatibility, VP9 for efficiency

## Security Considerations

1. **JWT Authentication**: Secure token validation
2. **CORS Configuration**: Restrict origins in production
3. **Port Security**: Minimize open port range
4. **Rate Limiting**: Implement connection rate limiting
5. **Input Validation**: Validate all client inputs

## Migration from P2P

The service is designed to be a drop-in replacement for the P2P WebRTC implementation:

1. **Same Interface**: Client hooks maintain same interface
2. **Gradual Migration**: Can run alongside existing P2P system
3. **Fallback Support**: Automatic fallback to P2P if mediasoup fails
4. **Feature Parity**: All existing features supported

## License

This project is part of the MeetLite video conferencing application.

# MeetLite API Gateway

A clean, production-ready API Gateway built from scratch with focus on reliability, performance, and maintainability.

## 🚀 Features

- **Clean Architecture**: Modular, well-organized code structure
- **Production Ready**: Proper error handling, logging, and monitoring
- **Service Routing**: Intelligent routing to auth, room, and signaling services
- **CORS Handling**: Comprehensive CORS configuration
- **Rate Limiting**: Built-in protection against abuse
- **Health Monitoring**: Service health checks and status reporting
- **Error Handling**: Consistent error responses across all services
- **Request Logging**: Detailed request/response logging for debugging

## 📁 Project Structure

```
src/
├── index.js              # Main application entry point
├── config/
│   └── index.js          # Centralized configuration
├── middleware/
│   └── index.js          # Middleware setup and configuration
├── routes/
│   └── service-router.js # Service routing logic
└── package.json          # Dependencies and scripts
```

## 🔧 Configuration

### Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5174

# Service URLs
AUTH_SERVICE_URL=http://localhost:5000
ROOM_SERVICE_URL=http://localhost:5001
SIGNALING_SERVICE_URL=http://localhost:5002
```

### Service Routing

The gateway automatically routes requests based on path patterns:

#### Auth Service (`/api/v1/*`)

- `/api/auth/*` → `/api/v1/auth/*`
- `/api/organizations/*` → `/api/v1/organizations/*`
- `/api/invitations/*` → `/api/v1/invitations/*`
- `/api/workspace/*` → `/api/v1/workspace/*`
- `/api/plan/*` → `/api/v1/plan/*`
- `/api/plans/*` → `/api/v1/plan/*`
- `/api/multi-org/*` → `/api/v1/multi-org/*`
- `/api/bulk/*` → `/api/v1/bulk/*`
- `/api/push-notifications/*` → `/api/v1/push-notifications/*`
- `/api/payment/*` → `/api/v1/payment/*`

#### Room Service (`/api/*`)

- `/api/rooms/*` → `/api/rooms/*`
- `/api/meetings/*` → `/api/meetings/*`
- `/api/recordings/*` → `/api/recordings/*`
- `/api/ai/*` → `/api/ai/*`
- `/api/analytics/*` → `/api/analytics/*`
- `/api/calendar/*` → `/api/calendar/*`

#### Signaling Service

- `/socket.io` → WebSocket connections
- `/uploads` → File uploads
- `/connect` → Connection endpoints

## 🚀 Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## 🏥 Health Monitoring

### Health Check Endpoint

```http
GET /health
```

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "services": ["auth", "room", "signaling"],
  "environment": "development"
}
```

## 🚨 Error Handling

Consistent error responses across all services:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Types

- **404**: Route not found
- **429**: Too many requests
- **500**: Internal server error
- **503**: Service unavailable

## 🔄 Request Flow

1. **Frontend** → API Gateway (`http://localhost:3000`)
2. **Gateway** → Determines target service based on path
3. **Gateway** → Routes request to appropriate service
4. **Service** → Processes request
5. **Service** → Returns response through gateway
6. **Gateway** → Returns response to frontend

## 📊 Logging

The gateway provides comprehensive logging:

- **Request Logging**: All incoming requests with method, path, and response time
- **Proxy Logging**: Service routing decisions and responses
- **Error Logging**: Detailed error information for debugging

## 🎯 Key Improvements

- ✅ **Simplified Architecture**: Clean, modular code structure
- ✅ **Better Error Handling**: Consistent error responses and proper error propagation
- ✅ **Improved Logging**: Detailed request/response logging for debugging
- ✅ **Production Ready**: Proper timeout handling and graceful shutdown
- ✅ **Maintainable**: Easy to understand and modify
- ✅ **Reliable**: Robust error handling and service discovery
- ✅ **Performance**: Optimized middleware stack and request handling

## 🔧 Troubleshooting

### Common Issues

1. **Service Unavailable (503)**: Check if backend services are running
2. **Route Not Found (404)**: Verify the request path matches configured routes
3. **CORS Errors**: Ensure frontend URL is in the CORS origins list

### Debugging

Enable detailed logging by setting `NODE_ENV=development` in your environment variables.

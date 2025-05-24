# MeetLite Backend Services

This repository contains the backend microservices for the MeetLite video meeting application.

## Services

- **Auth Service** (Port 5000): Handles user authentication and management
- **Room Service** (Port 5001): Manages meeting rooms and participants
- **Signaling Service** (Port 5002): Handles WebRTC signaling for peer-to-peer connections

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

## Setup

1. Clone the repository:

```bash
git clone <your-repo-url>
cd meetlite/backend
```

2. Install dependencies for all services:

```bash
npm run install:all
```

3. Create `.env` files for each service:

   - `auth-service/.env`
   - `room-service/.env`
   - `signaling-service/.env`

   See `.env.example` files in each service directory for required environment variables.

4. Start MongoDB:

```bash
mongod
```

## Development

To run all services in development mode:

```bash
npm run dev
```

To run individual services:

```bash
npm run dev:auth     # Auth service only
npm run dev:room     # Room service only
npm run dev:signaling # Signaling service only
```

## Environment Variables

Each service requires its own `.env` file. Create these files based on the `.env.example` files in each service directory.

### Auth Service

- `PORT`: Server port (default: 5000)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret for JWT token generation
- `CORS_ORIGIN`: Allowed CORS origins

### Room Service

- `PORT`: Server port (default: 5001)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret for JWT token verification
- `CORS_ORIGIN`: Allowed CORS origins

### Signaling Service

- `PORT`: Server port (default: 5002)
- `JWT_SECRET`: Secret for JWT token verification
- `CORS_ORIGIN`: Allowed CORS origins

## API Documentation

Each service has its own API endpoints. See the respective service directories for detailed API documentation.

## License

[Your chosen license]

# MeetLite

<div align="center">

**A modern, enterprise-grade video conferencing and collaboration platform**

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

[Features](#-features) • [Architecture](#-architecture) • [Getting Started](#-getting-started) • [Contributing](./CONTRIBUTING.md)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Development](#-development)
- [Project Structure](#-project-structure)
- [Contributing](./CONTRIBUTING.md)
- [License](#-license)

## 🎯 Overview

MeetLite is a comprehensive video conferencing platform designed for modern teams and enterprises. Built with a microservices architecture, it provides high-quality video calls, intelligent scheduling, AI-powered insights, and seamless collaboration tools.

### Key Highlights

- **HD Video Conferencing**: WebRTC-based, low-latency video calls with screen sharing
- **Smart Scheduling**: AI-powered scheduling with calendar integrations (Google, Outlook)
- **Real-time Collaboration**: Whiteboard, document collaboration, and workflow management
- **Meeting Intelligence**: AI-generated summaries, transcripts, and action items
- **Multi-Organization Management**: Create and manage multiple organizations with separate teams, members, and assets
- **Organization & Team Asset Tracking**: Track meeting assets (audio recordings, transcripts) at both organization and team levels with granular access control
- **Enterprise Ready**: Role-based access control, team management, and comprehensive permissions
- **Secure & Private**: End-to-end encryption, secure rooms, and granular access control

## ✨ Features

### Core Features

- **Video Conferencing**

  - HD video and audio quality
  - Screen sharing and presentation mode
  - Virtual backgrounds
  - Participant management
  - Waiting rooms and meeting controls

- **Smart Scheduling**

  - AI-powered time suggestions
  - Calendar integrations (Google Calendar, Outlook)
  - Timezone-aware scheduling
  - Automatic meeting reminders
  - Recurring meetings

- **Collaboration Tools**

  - Real-time whiteboard (Tldraw)
  - Document and simple coding collaboration (Yjs)
  - Workflow management
  - Chat messaging
  - File sharing

- **Meeting Intelligence**

  - AI-generated meeting summaries
  - Automatic transcription
  - Action item extraction
  - Sentiment analysis
  - Key topics identification

- **Recording & Asset Management**

  - HD meeting recordings with organization and team-level tracking
  - Searchable transcripts stored at organization and team levels
  - AI-powered summaries and insights
  - Granular access control for recordings and transcripts
  - Organization-wide and team-specific asset visibility
  - Shareable recording links with expiration
  - Analytics and insights per organization and team
  - Asset archiving and retention policies

- **Organization & Team Management**

  - **Multiple Organizations**: Create and manage multiple organizations from a single account
  - **Team Management**: Create multiple teams within each organization
  - **Asset Tracking**: Track meeting assets (recordings, transcripts) at both organization and team levels
  - **Access Control**: Granular permissions for organization and team assets
    - Organization-level assets: Accessible to all organization members
    - Team-level assets: Accessible only to team members
    - Private assets: Accessible only to participants
  - Role-based access control (owner, admin, member)
  - Invitation system for organizations and teams
  - Member management across organizations and teams

- **Integrations**
  - Google Calendar
  - Outlook Calendar

### Subscription Plans

- **Free**: Basic meetings, limited features
- **Pro**: Advanced features, longer meetings, more participants
- **Enterprise**: Unlimited features, custom branding, dedicated support

## 🏗️ Architecture

MeetLite follows a **microservices architecture** with an API Gateway pattern for scalable, maintainable infrastructure.

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│                    http://localhost:5174                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (Port 3000)                   │
│              Request Routing & Load Balancing                │
└───────────┬───────────────┬───────────────┬─────────────────┘
            │               │               │
            ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Auth Service │ │ Room Service │ │MediaSoup Svc │
    │  (Port 5000) │ │ (Port 5001)  │ │  (Port 3003) │
    └──────────────┘ └──────────────┘ └──────────────┘
            │               │               │
            └───────────────┴───────────────┘
                            │
                            ▼
            ┌───────────────────────────┐
            │      MongoDB Database      │
            │      Redis Cache           │
            └───────────────────────────┘
```

### Service Breakdown

#### 1. **API Gateway** (`api-gateway`)

- **Purpose**: Single entry point for all client requests
- **Responsibilities**:
  - Request routing to appropriate services
  - CORS handling
  - Rate limiting
  - Health monitoring
  - Request/response logging
- **Port**: 3000

#### 2. **Auth Service** (`auth-service`)

- **Purpose**: Authentication, authorization, and user management
- **Responsibilities**:
  - User authentication (JWT)
  - Organization management
  - Team management
  - Invitation system
  - Plan management
  - Payment processing (Stripe)
  - Email notifications
- **Port**: 5000
- **API Prefix**: `/api/v1/*`

#### 3. **Room Service** (`room-service`)

- **Purpose**: Meeting and room management
- **Responsibilities**:
  - Meeting CRUD operations
  - Meeting scheduling
  - Calendar integration
  - Recording management
  - AI services integration
  - Analytics
- **Port**: 5001
- **API Prefix**: `/api/v1/*`

#### 4. **MediaSoup Service** (`mediasoup-service`)

- **Purpose**: WebRTC media handling and real-time collaboration
- **Responsibilities**:
  - WebRTC signaling (Socket.IO)
  - Media streaming (audio/video)
  - Screen sharing
  - Tldraw collaboration (whiteboard)
  - Yjs document synchronization
  - File uploads
- **Port**: 3003
- **WebSocket**: `/socket.io`, `/connect`

#### 5. **Shared Models** (`shared-models`)

- **Purpose**: Shared data models and utilities
- **Responsibilities**:
  - Mongoose schemas
  - Common utilities
  - Plan configurations
  - Constants

### Data Flow

1. **Client Request** → API Gateway (port 3000)
2. **Gateway** → Routes to appropriate service based on path
3. **Service** → Processes request, interacts with MongoDB/Redis
4. **Service** → Returns response through gateway
5. **Gateway** → Returns response to client

### WebSocket Flow

1. **Client** → Connects to MediaSoup service via gateway
2. **MediaSoup** → Handles WebRTC signaling and media streams
3. **MediaSoup** → Manages collaboration state (Tldraw, Yjs)

## 🛠️ Tech Stack

### Frontend

- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui
- **State Management**: Zustand
- **Routing**: React Router v6
- **WebRTC**: MediaSoup client
- **Real-time**: Socket.IO Client
- **Collaboration**: Tldraw, Yjs
- **Forms**: React Hook Form
- **Notifications**: Sonner
- **Icons**: Lucide React

### Backend

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Cache**: Redis
- **Authentication**: JWT
- **WebRTC**: MediaSoup
- **Real-time**: Socket.IO
- **Email**: Nodemailer
- **Payment**: Stripe
- **File Storage**: Local filesystem (configurable)

### DevOps & Tools

- **API Gateway**: Custom Express proxy
- **Load Testing**: K6
- **Development**: Concurrently
- **Package Management**: npm workspaces

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v20.0.0 or higher
- **MongoDB**: v6.0 or higher
- **Redis**: v7.0 or higher (optional, for caching)
- **npm**: v9.0 or higher

### Installation

1. **Clone the repository**:

```bash
git clone https://github.com/YOUR_USERNAME/meetlite.git
cd meetlite
```

2. **Install dependencies**:

```bash
# Install root dependencies
npm install

# Install all workspace dependencies
npm run install:all
```

3. **Set up environment variables**:

Create `.env` files in each service directory:

**`backend/packages/api-gateway/.env`**:

```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5174

AUTH_SERVICE_URL=http://localhost:5000
ROOM_SERVICE_URL=http://localhost:5001
MEDIASOUP_SERVICE_URL=http://localhost:3003
```

**`backend/packages/auth-service/.env`**:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/meetlite
JWT_SECRET=your-jwt-secret-key
FRONTEND_URL=http://localhost:5174
# ... (see backend/packages/auth-service/.env.example)
```

**`backend/packages/room-service/.env`**:

```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/meetlite
# ... (see backend/packages/room-service/.env.example)
```

**`backend/packages/mediasoup-service/.env`**:

```env
PORT=3003
NODE_ENV=development
# ... (see backend/packages/mediasoup-service/.env.example)
```

**`client/.env`**:

```env
VITE_API_URL=http://localhost:3000
# ... (see client/.env.example)
```

4. **Start MongoDB and Redis**:

```bash
# MongoDB (if not running as service)
mongod

# Redis (if not running as service)
redis-server
```

### Development

1. **Start all backend services**:

```bash
cd backend
npm run dev:all
```

This starts:

- API Gateway (port 3000)
- Auth Service (port 5000)
- Room Service (port 5001)
- MediaSoup Service (port 3003)

2. **Start the frontend** (in a new terminal):

```bash
cd client
npm run dev
```

3. **Access the application**:

- Frontend: http://localhost:5174
- API Gateway: http://localhost:3000
- Health Check: http://localhost:3000/health

### Production Build

```bash
# Build frontend
npm run build:client

# Build backend (if applicable)
npm run build:backend
```

## 📁 Project Structure

```
meetlite/
├── client/                          # React frontend application
│   ├── src/
│   │   ├── components/              # React components
│   │   │   ├── auth/               # Authentication components
│   │   │   ├── dashboard/          # Dashboard components
│   │   │   ├── meeting/            # Meeting components
│   │   │   ├── room/               # Video room components
│   │   │   ├── organization/      # Organization management
│   │   │   ├── teams/              # Team management
│   │   │   └── ui/                 # Reusable UI components
│   │   ├── contexts/               # React contexts
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── pages/                  # Page components
│   │   ├── services/               # API service clients
│   │   ├── stores/                 # Zustand stores
│   │   ├── types/                  # TypeScript types
│   │   └── utils/                  # Utility functions
│   ├── public/                     # Static assets
│   └── package.json
│
├── backend/                        # Backend microservices
│   ├── packages/
│   │   ├── api-gateway/            # API Gateway service
│   │   │   ├── src/
│   │   │   │   ├── config/         # Configuration
│   │   │   │   ├── middleware/     # Express middleware
│   │   │   │   └── routes/         # Service routing
│   │   │   └── package.json
│   │   │
│   │   ├── auth-service/           # Authentication service
│   │   │   ├── src/
│   │   │   │   ├── controllers/    # Request handlers
│   │   │   │   ├── services/       # Business logic
│   │   │   │   ├── routes/         # API routes
│   │   │   │   ├── middleware/     # Auth middleware
│   │   │   │   ├── templates/      # Email templates
│   │   │   │   └── utils/           # Utilities
│   │   │   └── package.json
│   │   │
│   │   ├── room-service/           # Room/Meeting service
│   │   │   ├── src/
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── routes/
│   │   │   │   ├── models/
│   │   │   │   └── templates/
│   │   │   └── package.json
│   │   │
│   │   ├── mediasoup-service/     # WebRTC service
│   │   │   ├── src/
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── routes/
│   │   │   │   └── handlers/
│   │   │   └── package.json
│   │   │
│   │   └── shared-models/          # Shared models
│   │       ├── src/
│   │       │   ├── models/         # Mongoose schemas
│   │       │   ├── config/         # Shared config
│   │       │   └── utils/          # Shared utilities
│   │       └── package.json
│   │
│   └── README.md                   # Backend documentation
│
├── k6/                             # Load testing
│   ├── backend/                    # Backend load tests
│   ├── frontend/                   # Frontend load tests
│   └── config/                     # Test configuration
│
├── package.json                    # Root package.json (workspaces)
└── README.md                       # This file
```

## 🤝 Contributing

We welcome contributions to MeetLite! Please see our [Contributing Guide](./CONTRIBUTING.md) for detailed information on:

- How to contribute
- Coding standards and guidelines
- Pull request process
- Issue reporting
- Development best practices

For a quick start, fork the repository, create a feature branch, make your changes, and open a pull request.

## 📄 License

This project is licensed under the ISC License.

---

<div align="center">

**Built with ❤️ by the MeetLite team**

[Documentation](./docs) • [API Reference](./docs/api) • [Changelog](./CHANGELOG.md)

</div>

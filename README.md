# MeetLite

A modern video meeting application built with React, Node.js, and WebRTC.

## Project Structure

```
meetlite/
├── client/                 # React frontend application
│   ├── src/               # Source files
│   ├── public/            # Static files
│   └── package.json       # Frontend dependencies
│
└── backend/               # Backend microservices
    ├── auth-service/      # Authentication service
    ├── room-service/      # Room management service
    └── signaling-service/ # WebRTC signaling service
```

## Features

- Real-time video meetings using WebRTC
- User authentication and authorization
- Room creation and management
- Modern, responsive UI
- Dark/Light theme support

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Socket.IO Client
- WebRTC

### Backend

- Node.js
- Express
- MongoDB
- Socket.IO
- JWT Authentication

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/meetlite.git
cd meetlite
```

2. Install frontend dependencies:

```bash
cd client
npm install
```

3. Install backend dependencies:

```bash
cd ../backend
npm run install:all
```

4. Set up environment variables:
   - Create `.env` files in each service directory based on `.env.example` files
   - See backend/README.md for detailed environment variable setup

### Development

1. Start the backend services:

```bash
cd backend
npm run dev
```

2. In a new terminal, start the frontend:

```bash
cd client
npm run dev
```

The application will be available at:

- Frontend: http://localhost:5173
- Auth Service: http://localhost:5000
- Room Service: http://localhost:5001
- Signaling Service: http://localhost:5002

## Contributing

[Your contribution guidelines]

## License

[Your chosen license]

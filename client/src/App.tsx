import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import NotFound from './pages/NotFound';
import Layout from './components/Layout';
import Meetings from './pages/Meetings';
import MeetingJoin from './pages/MeetingJoin';
import Landing from './pages/Landing';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public routes */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />}
        />
        <Route
          path="/signup"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Signup />}
        />
        <Route path="/meeting/:meetingId/join" element={<MeetingJoin />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/lobby/:roomId"
          element={isAuthenticated ? <Lobby /> : <Navigate to="/login" />}
        />
        <Route
          path="/room/:roomId"
          element={isAuthenticated ? <Room /> : <Navigate to="/login" />}
        />
        <Route
          path="/meetings"
          element={isAuthenticated ? <Meetings /> : <Navigate to="/login" />}
        />

        {/* Redirects */}
        <Route
          path="/"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Landing />}
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;

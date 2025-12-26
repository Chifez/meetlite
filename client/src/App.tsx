import { Routes, Route } from 'react-router-dom';
import { useHotkeys } from './hooks/use-hotkeys';
import { GlobalHotkeyHelp } from './components/hotkeys/hotkey-help';
import { ProtectedRoute } from './components/protected-route';
import { PublicRoute } from './components/public-route';
import Login from './pages/login';
import Signup from './pages/signup';
import ForgotPassword from './pages/forgot-password';
import ResetPassword from './pages/reset-password';
import Dashboard from './pages/dashboard';
import Lobby from './pages/lobby';
import Room from './pages/room';
import NotFound from './pages/not-found';
import Layout from './components/layout';
import Meetings from './pages/meeting';
import MeetingJoin from './pages/meeting-join';
import Landing from './pages/landing';
import Onboarding from './pages/onboarding';
import Members from './pages/members';
import Recordings from './pages/recordings';
import OrganizationSettings from './pages/organization-settings';
import Settings from './pages/settings';
import InvitationPage from './pages/invitation';
import PaymentSuccess from './pages/payment-success';
import Notifications from './pages/notifications';
import TeamMeetings from './pages/teams/[teamId]/meetings';
import TeamRecordings from './pages/teams/[teamId]/recordings';
import TeamSettings from './pages/teams/[teamId]/settings';

function App() {
  // Initialize hotkeys
  useHotkeys();

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              <PublicRoute redirectIfAuthenticated>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute redirectIfAuthenticated>
                <Signup />
              </PublicRoute>
            }
          />
          <Route
            path="/meeting/:meetingId/join"
            element={
              <PublicRoute>
                <MeetingJoin />
              </PublicRoute>
            }
          />
          <Route
            path="/invite/:token"
            element={
              <PublicRoute>
                <InvitationPage />
              </PublicRoute>
            }
          />
          <Route
            path="/payment/success"
            element={
              <PublicRoute>
                <PaymentSuccess />
              </PublicRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPassword />
              </PublicRoute>
            }
          />
          <Route
            path="/reset-password"
            element={
              <PublicRoute>
                <ResetPassword />
              </PublicRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <PublicRoute redirectIfAuthenticated>
                <Onboarding />
              </PublicRoute>
            }
          />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lobby/:roomId"
            element={
              <ProtectedRoute>
                <Lobby />
              </ProtectedRoute>
            }
          />
          <Route
            path="/room/:roomId"
            element={
              <ProtectedRoute>
                <Room />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meetings"
            element={
              <ProtectedRoute>
                <Meetings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/members"
            element={
              <ProtectedRoute>
                <Members />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recordings"
            element={
              <ProtectedRoute>
                <Recordings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams/:teamId/meetings"
            element={
              <ProtectedRoute>
                <TeamMeetings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams/:teamId/recordings"
            element={
              <ProtectedRoute>
                <TeamRecordings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams/:teamId/settings"
            element={
              <ProtectedRoute>
                <TeamSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organization/:orgId/settings"
            element={
              <ProtectedRoute>
                <OrganizationSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />

          {/* Redirects */}
          <Route
            path="/"
            element={
              <PublicRoute redirectIfAuthenticated>
                <Landing />
              </PublicRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>

      {/* Global hotkey help - outside Routes */}
      <GlobalHotkeyHelp />
    </>
  );
}

export default App;

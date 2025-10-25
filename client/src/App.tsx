import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/use-auth';
import { useHotkeys } from './hooks/use-hotkeys';
import { GlobalHotkeyHelp } from './components/hotkeys/hotkey-help';
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

function App() {
  const { isAuthenticated, redirectTo, user } = useAuth();

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
              isAuthenticated ? (
                <Navigate to={redirectTo || '/dashboard'} />
              ) : (
                <Login />
              )
            }
          />
          <Route
            path="/signup"
            element={
              isAuthenticated ? (
                <Navigate to={redirectTo || '/dashboard'} />
              ) : (
                <Signup />
              )
            }
          />
          <Route path="/meeting/:meetingId/join" element={<MeetingJoin />} />
          <Route path="/invite/:token" element={<InvitationPage />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/onboarding"
            element={
              isAuthenticated && user?.onboardingCompleted ? (
                <Navigate to={redirectTo || '/dashboard'} />
              ) : (
                <Onboarding />
              )
            }
          />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              isAuthenticated ? (
                user?.onboardingCompleted ? (
                  <Dashboard />
                ) : (
                  <Navigate to="/onboarding" />
                )
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/lobby/:roomId"
            element={
              isAuthenticated ? (
                user?.onboardingCompleted ? (
                  <Lobby />
                ) : (
                  <Navigate to="/onboarding" />
                )
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/room/:roomId"
            element={
              isAuthenticated ? (
                user?.onboardingCompleted ? (
                  <Room />
                ) : (
                  <Navigate to="/onboarding" />
                )
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/meetings"
            element={
              isAuthenticated ? (
                user?.onboardingCompleted ? (
                  <Meetings />
                ) : (
                  <Navigate to="/onboarding" />
                )
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/members"
            element={
              isAuthenticated ? (
                user?.onboardingCompleted ? (
                  <Members />
                ) : (
                  <Navigate to="/onboarding" />
                )
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/recordings"
            element={
              isAuthenticated ? (
                user?.onboardingCompleted ? (
                  <Recordings />
                ) : (
                  <Navigate to="/onboarding" />
                )
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/organization/:orgId/settings"
            element={
              isAuthenticated ? (
                user?.onboardingCompleted ? (
                  <OrganizationSettings />
                ) : (
                  <Navigate to="/onboarding" />
                )
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/settings"
            element={
              isAuthenticated ? (
                user?.onboardingCompleted ? (
                  <Settings />
                ) : (
                  <Navigate to="/onboarding" />
                )
              ) : (
                <Navigate to="/login" />
              )
            }
          />

          {/* Redirects */}
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Navigate to={redirectTo || '/dashboard'} />
              ) : (
                <Landing />
              )
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

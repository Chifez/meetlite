import { Navigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

/**
 * ProtectedRoute - Wrapper for routes that require authentication
 * Handles redirects for unauthenticated users and onboarding checks
 * Blocks system admins from accessing normal user routes
 */
export function ProtectedRoute({
  children,
  requireOnboarding = true,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const redirect = searchParams.get('redirect');

  // If auth state is still loading, show a centered spinner
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If not authenticated, redirect to login with redirect parameter
  if (!isAuthenticated) {
    const currentPath = window.location.pathname + window.location.search;
    const redirectUrl = redirect || currentPath;
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(redirectUrl)}`}
        replace
      />
    );
  }

  // System admins can only access /admin routes
  if (user?.isSystemAdmin && !location.pathname.startsWith('/admin')) {
    return <Navigate to="/admin" replace />;
  }

  // Non-system-admins cannot access /admin routes
  if (!user?.isSystemAdmin && location.pathname.startsWith('/admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  // If onboarding is required but not completed, redirect to onboarding
  // Skip onboarding check for system admins
  if (requireOnboarding && !user?.onboardingCompleted && !user?.isSystemAdmin) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

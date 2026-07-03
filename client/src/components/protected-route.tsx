import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

/**
 * ProtectedRoute - Wrapper for routes that require authentication
 * Handles redirects for unauthenticated users and onboarding checks
 */
export function ProtectedRoute({
  children,
  requireOnboarding = true,
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

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

  // If onboarding is required but not completed, redirect to onboarding
  if (requireOnboarding && !user?.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

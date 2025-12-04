import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';

interface PublicRouteProps {
  children: React.ReactNode;
  /**
   * If true, redirects authenticated users away from this route
   * (e.g., login/signup pages)
   */
  redirectIfAuthenticated?: boolean;
}

/**
 * PublicRoute - Wrapper for routes that don't require authentication
 * Can optionally redirect authenticated users away
 */
export function PublicRoute({
  children,
  redirectIfAuthenticated = false,
}: PublicRouteProps) {
  const { isAuthenticated, redirectTo } = useAuth();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  // If authenticated and this route should redirect authenticated users
  if (redirectIfAuthenticated && isAuthenticated) {
    // Priority: redirect param > redirectTo context > default
    const target = redirect
      ? decodeURIComponent(redirect)
      : redirectTo || '/dashboard';
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}

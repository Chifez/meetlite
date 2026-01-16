import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { LoginForm } from './auth/login-form';
import { SignupForm } from './auth/signup-form';

interface AuthPageProps {
  mode: 'login' | 'signup';
}

const AuthPage = ({ mode }: AuthPageProps) => {
  const { login, signup, redirectTo, setRedirectTo, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Parse URL params
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const error = params.get('error');
  const invitation = params.get('invitation'); // Legacy support
  const redirect = params.get('redirect'); // New redirect parameter

  // Handle OAuth callback side effects
  useEffect(() => {
    if (token) {
      Cookies.set('token', token, { secure: true, sameSite: 'lax' });
      // System admins always go to /admin (unless redirect param overrides)
      if (user?.isSystemAdmin && !redirect) {
        navigate('/admin');
      } else if (redirect) {
        navigate(decodeURIComponent(redirect));
      } else if (invitation) {
        navigate(`/invite/${invitation}`);
      } else {
        navigate('/dashboard');
      }
    } else if (error === 'google_oauth_failed') {
      toast.error(
        `Google ${
          mode === 'login' ? 'sign-in' : 'sign-up'
        } failed. Please try again.`
      );
    }
  }, [token, error, mode, navigate, invitation, redirect, user]);

  const handlePostAuthNavigation = () => {
    // System admins always go to /admin
    if (user?.isSystemAdmin) {
      navigate('/admin');
      return;
    }

    // Priority: redirect param > redirectTo context > invitation (legacy) > default
    if (redirect) {
      navigate(decodeURIComponent(redirect));
    } else if (redirectTo) {
      navigate(redirectTo);
      setRedirectTo(null);
    } else if (invitation) {
      navigate(`/invite/${invitation}`);
    } else {
      navigate(mode === 'login' ? '/dashboard' : '/onboarding');
    }
  };

  const handleLoginSubmit = async (data: {
    email: string;
    password: string;
  }) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      handlePostAuthNavigation();
    } catch (error) {
      // Error handled in context
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (data: {
    email: string;
    password: string;
  }) => {
    setIsLoading(true);
    try {
      await signup(data.email, data.password);
      handlePostAuthNavigation();
    } catch (error) {
      // Error handled in context
    } finally {
      setIsLoading(false);
    }
  };

  // Render appropriate form based on mode
  return mode === 'login' ? (
    <LoginForm
      onSubmit={handleLoginSubmit}
      isLoading={isLoading}
      invitation={invitation}
    />
  ) : (
    <SignupForm
      onSubmit={handleSignupSubmit}
      isLoading={isLoading}
      invitation={invitation}
    />
  );
};

export default AuthPage;

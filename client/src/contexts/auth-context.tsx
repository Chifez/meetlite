import { createContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { getAuthToken, setAuthToken, removeAuthToken } from '@/lib/token-storage';
import { Organization } from '@/types/organization';

// Types
type User = {
  id: string;
  email: string;
  name?: string;
  useNameInMeetings?: boolean;
  onboardingCompleted?: boolean;
  isSystemAdmin?: boolean;
  onboarding?: {
    name?: string;
    useCase?: 'personal' | 'education' | 'business' | 'team';
    teamSize?: '1-5' | '6-20' | '21-50' | '50+';
    primaryUse?: string[];
    experience?: 'beginner' | 'intermediate' | 'advanced';
  };
  organizationId?: string | null;
  role?: 'owner' | 'admin' | 'member';
  plan?: {
    type: 'free' | 'pro' | 'enterprise';
    startDate?: Date;
    endDate?: Date | null;
    status?: 'active' | 'expired' | 'cancelled';
  };
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  organization: Organization | null;
  setOrganization: (organization: Organization | null) => void;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  validateToken: () => Promise<boolean>;
  updateUser: (userData: Partial<User>) => void;
  handleNewToken: (token: string) => void;
  redirectTo: string | null;
  setRedirectTo: (url: string | null) => void;
};

type TokenPayload = {
  userId: string;
  email: string;
  organizationId?: string | null;
  role?: 'owner' | 'admin' | 'member';
  tokenVersion?: number;
  exp: number;
};

// Create context
export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  organization: null,
  setOrganization: () => {},
  login: async () => {},
  signup: async () => {},
  logout: () => {},
  validateToken: async () => false,
  updateUser: () => {},
  handleNewToken: () => {},
  redirectTo: null,
  setRedirectTo: () => {},
});

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);

  // Helper to fetch latest user profile
  const fetchUserProfile = useCallback(async (token: string) => {
    try {
      const response = await api.get('/api/auth/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profile = response.data.user;
      setUser({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        useNameInMeetings: profile.useNameInMeetings,
        onboardingCompleted: profile.onboardingCompleted,
        onboarding: profile.onboarding,
        organizationId: profile.organizationId ?? null,
        role: profile.role,
        plan: profile.plan,
        isSystemAdmin: profile.isSystemAdmin || false,
      });

      console.log('Profile fetched successfully:', {
        user: profile,
        onboardingCompleted: profile.onboardingCompleted,
        hasUser: !!profile,
      });
    } catch (error) {
      // fallback: clear user if profile fetch fails
      setUser(null);
    }
  }, []);

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Proactively schedule token refresh 2 minutes before expiry
  const scheduleTokenRefresh = useCallback((token: string) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    try {
      const decoded = jwtDecode<TokenPayload>(token);
      const currentTime = Date.now() / 1000;
      // Refresh 2 minutes before expiration, or in 10s if already close/expired
      const secondsUntilRefresh = Math.max(10, decoded.exp - currentTime - 120);

      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          const currentToken = getAuthToken();
          if (!currentToken) return;

          const response = await api.post('/api/auth/refresh', {
            token: currentToken,
          });
          const newToken = response.data?.token || response.data?.accessToken;
          if (newToken) {
            setAuthToken(newToken);
            scheduleTokenRefresh(newToken);
            window.dispatchEvent(
              new CustomEvent('meetlite:token-refreshed', {
                detail: { token: newToken },
              })
            );
          }
        } catch (err) {
          console.warn('[AUTH] Proactive token refresh failed:', err);
        }
      }, secondsUntilRefresh * 1000);
    } catch {
      // Invalid token, no schedule
    }
  }, []);

  // Helper function to handle new tokens from API responses
  const handleNewToken = useCallback((newToken: string) => {
    setAuthToken(newToken);
    scheduleTokenRefresh(newToken);
    // Fetch updated profile with new token
    fetchUserProfile(newToken);
  }, [fetchUserProfile, scheduleTokenRefresh]);

  // Update user function
  const updateUser = useCallback((userData: Partial<User>) => {
    setUser((prev) => {
      if (prev) {
        return { ...prev, ...userData };
      }
      return prev;
    });
  }, []);

  // Validate token with server
  const validateToken = useCallback(async (): Promise<boolean> => {
    const token = getAuthToken();
    if (!token) return false;

    try {
      const response = await api.post('/api/auth/validate', {
        token,
      });
      if (response.data.valid) {
        // Fetch latest profile after validation
        await fetchUserProfile(token);
        return true;
      }
    } catch (error) {
      console.error('Token validation failed:', error);
    }

    return false;
  }, [fetchUserProfile]);

  // Check for token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAuthToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const decodedToken = jwtDecode<TokenPayload>(token);
        const currentTime = Date.now() / 1000;

        if (decodedToken.exp < currentTime) {
          // Token expired, refresh via /api/auth/refresh
          try {
            const refreshRes = await api.post('/api/auth/refresh', {
              token,
            });
            const refreshedToken =
              refreshRes.data?.token || refreshRes.data?.accessToken;

            if (refreshedToken) {
              setAuthToken(refreshedToken);
              scheduleTokenRefresh(refreshedToken);
              await fetchUserProfile(refreshedToken);
            } else {
              removeAuthToken();
              setUser(null);
            }
          } catch {
            removeAuthToken();
            setUser(null);
          }
        } else {
          // Valid token, fetch latest profile and schedule refresh
          scheduleTokenRefresh(token);
          await fetchUserProfile(token);
        }
      } catch (error) {
        // Invalid token
        removeAuthToken();
        setUser(null);
      }

      setIsLoading(false);
    };

    checkAuth();

    // Listen for cross-context token refreshes (e.g. from axios interceptor)
    const handleExternalTokenRefresh = (event: Event) => {
      const customEvent = event as CustomEvent<{ token: string }>;
      const refreshedToken = customEvent.detail?.token;
      if (refreshedToken) {
        scheduleTokenRefresh(refreshedToken);
      }
    };
    window.addEventListener(
      'meetlite:token-refreshed',
      handleExternalTokenRefresh
    );

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      window.removeEventListener(
        'meetlite:token-refreshed',
        handleExternalTokenRefresh
      );
    };
  }, [fetchUserProfile, scheduleTokenRefresh]);

  // Login user
  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await api.post('/api/auth/login', {
        email,
        password,
      });
      const { token } = response.data;
      setAuthToken(token);
      scheduleTokenRefresh(token);

      // Fetch latest profile after login
      await fetchUserProfile(token);

      toast.success('Success', {
        description: 'You have successfully logged in',
      });
    } catch (error) {
      toast.error('Login Failed', {
        description: 'Invalid email or password',
      });
      throw error;
    }
  }, [fetchUserProfile, scheduleTokenRefresh]);

  // Register user
  const signup = useCallback(async (email: string, password: string) => {
    try {
      const response = await api.post('/api/auth/signup', {
        email,
        password,
      });

      const { token } = response.data;
      setAuthToken(token);
      scheduleTokenRefresh(token);

      // Fetch latest profile after signup
      await fetchUserProfile(token);

      toast.success('Success', {
        description: 'Account created successfully',
      });
    } catch (error) {
      toast.error('Registration Failed', {
        description: 'Could not create account. Please try again.',
      });
      console.log('error', error);
      throw error;
    }
  }, [fetchUserProfile, scheduleTokenRefresh]);

  // Logout user
  const logout = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    removeAuthToken();
    setUser(null);
    setRedirectTo(null); // Clear redirect URL on logout
    toast.success('Logged out', {
      description: 'You have been logged out successfully',
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        organization,
        setOrganization,
        login,
        signup,
        logout,
        validateToken,
        updateUser,
        handleNewToken,
        redirectTo,
        setRedirectTo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

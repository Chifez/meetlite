import { createContext, useState, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { env } from '@/config/env';
import Cookies from 'js-cookie';

// Types
type User = {
  id: string;
  email: string;
  name?: string;
  useNameInMeetings?: boolean;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  validateToken: () => Promise<boolean>;
  updateUser: (userData: Partial<User>) => void;
  redirectTo: string | null;
  setRedirectTo: (url: string | null) => void;
};

type TokenPayload = {
  userId: string;
  email: string;
  name?: string;
  useNameInMeetings?: boolean;
  exp: number;
};

// Create context
export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
  validateToken: async () => false,
  updateUser: () => {},
  redirectTo: null,
  setRedirectTo: () => {},
});

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  // Update user function
  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  // Validate token with server
  const validateToken = async (): Promise<boolean> => {
    const token = Cookies.get('token');
    if (!token) return false;

    try {
      const response = await api.post(`${env.AUTH_API_URL}/auth/validate`, {
        token,
      });
      if (response.data.valid) {
        setUser({
          id: response.data.user.id,
          email: response.data.user.email,
          name: response.data.user.name,
          useNameInMeetings: response.data.user.useNameInMeetings,
        });
        return true;
      }
    } catch (error) {
      console.error('Token validation failed:', error);
    }

    return false;
  };

  // Check for token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = Cookies.get('token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const decodedToken = jwtDecode<TokenPayload>(token);
        const currentTime = Date.now() / 1000;

        if (decodedToken.exp < currentTime) {
          // Token expired, try to refresh
          const isValid = await validateToken();
          if (!isValid) {
            Cookies.remove('token');
            setUser(null);
          }
        } else {
          // Valid token
          setUser({
            id: decodedToken.userId,
            email: decodedToken.email,
            name: decodedToken.name,
            useNameInMeetings: decodedToken.useNameInMeetings,
          });
        }
      } catch (error) {
        // Invalid token
        Cookies.remove('token');
        setUser(null);
      }

      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // Login user
  const login = async (email: string, password: string) => {
    try {
      const response = await api.post(`${env.AUTH_API_URL}/auth/login`, {
        email,
        password,
      });

      const { token } = response.data;
      Cookies.set('token', token, { secure: true, sameSite: 'lax' });

      // Decode token
      const decodedToken = jwtDecode<TokenPayload>(token);
      setUser({
        id: decodedToken.userId,
        email: decodedToken.email,
        name: decodedToken.name,
        useNameInMeetings: decodedToken.useNameInMeetings,
      });

      toast.success('Success', {
        description: 'You have successfully logged in',
      });
    } catch (error) {
      toast.error('Login Failed', {
        description: 'Invalid email or password',
      });
      throw error;
    }
  };

  // Register user
  const signup = async (email: string, password: string) => {
    try {
      const response = await api.post(`${env.AUTH_API_URL}/auth/signup`, {
        email,
        password,
      });

      const { token } = response.data;
      Cookies.set('token', token, { secure: true, sameSite: 'lax' });

      // Decode token
      const decodedToken = jwtDecode<TokenPayload>(token);
      setUser({
        id: decodedToken.userId,
        email: decodedToken.email,
        name: decodedToken.name,
        useNameInMeetings: decodedToken.useNameInMeetings,
      });

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
  };

  // Logout user
  const logout = () => {
    Cookies.remove('token');
    setUser(null);
    setRedirectTo(null); // Clear redirect URL on logout
    toast.success('Logged out', {
      description: 'You have been logged out successfully',
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        validateToken,
        updateUser,
        redirectTo,
        setRedirectTo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

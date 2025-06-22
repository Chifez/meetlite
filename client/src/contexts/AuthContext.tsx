import { createContext, useState, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import { toast } from 'sonner';
import { env } from '@/config/env';
import Cookies from 'js-cookie';

// Types
type User = {
  id: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  getAuthHeaders: () => { Authorization: string };
};

type TokenPayload = {
  userId: string;
  email: string;
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
  getAuthHeaders: () => ({ Authorization: '' }),
});

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check for token on mount
  useEffect(() => {
    const checkAuth = () => {
      const token = Cookies.get('token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const decodedToken = jwtDecode<TokenPayload>(token);
        const currentTime = Date.now() / 1000;

        if (decodedToken.exp < currentTime) {
          // Token expired
          Cookies.remove('token');
          setUser(null);
        } else {
          // Valid token
          setUser({
            id: decodedToken.userId,
            email: decodedToken.email,
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
      const response = await axios.post(`${env.AUTH_API_URL}/auth/login`, {
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
      const response = await axios.post(`${env.AUTH_API_URL}/auth/signup`, {
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
      });

      toast.success('Success', {
        description: 'Account created successfully',
      });
    } catch (error) {
      toast.success('Registration Failed', {
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
    toast.success('Logged out', {
      description: 'You have been logged out successfully',
    });
  };

  // Get auth headers
  const getAuthHeaders = () => {
    const token = Cookies.get('token');
    return {
      Authorization: `Bearer ${token}`,
    };
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
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

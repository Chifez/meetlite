import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import { env } from '@/config/env';

// Create axios instance
const api = axios.create();

// Token refresh state
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  failedQueue = [];
};

// Request interceptor to add auth headers
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const token = Cookies.get('token');
      if (!token) {
        isRefreshing = false;
        // Redirect to login
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        // Try to refresh the token
        const response = await axios.post(`${env.AUTH_API_URL}/auth/refresh`, {
          token,
        });

        const newToken = response.data.token;
        Cookies.set('token', newToken, { secure: true, sameSite: 'lax' });

        // Update the original request
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        // Process queued requests
        processQueue(null, newToken);

        return api(originalRequest);
      } catch (refreshError) {
        // Token refresh failed
        processQueue(refreshError, null);
        Cookies.remove('token');

        // Redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

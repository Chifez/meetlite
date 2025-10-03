import api from '@/lib/axios';
import { env } from '@/config/env';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  useNameInMeetings?: boolean;
}

export const fetchUserProfile = async (
  token: string
): Promise<UserProfile | null> => {
  try {
    const response = await api.get(`${env.AUTH_API_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.user;
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    return null;
  }
};

export const fetchUserProfileByEmail = async (
  email: string,
  token: string
): Promise<UserProfile | null> => {
  try {
    // Note: This endpoint doesn't exist yet, we'll need to create it
    const response = await api.get(
      `${env.AUTH_API_URL}/auth/user-by-email/${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data.user;
  } catch (error) {
    console.error('Failed to fetch user profile by email:', error);
    return null;
  }
};

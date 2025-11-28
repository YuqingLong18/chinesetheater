import axios from 'axios';
import { env } from '../config/env.js';

export interface CentralAuthUser {
  id: number;
  username: string;
}

export interface CentralAuthResponse {
  success: boolean;
  user?: CentralAuthUser;
  error?: string;
}

/**
 * Verify credentials with centralized authentication server
 */
export const verifyCentralCredentials = async (
  username: string,
  password: string
): Promise<CentralAuthUser | null> => {
  try {
    const response = await axios.post<CentralAuthResponse>(
      `${env.CENTRAL_AUTH_URL}/verify`,
      { username, password },
      { timeout: 5000 }
    );

    if (response.data.success && response.data.user) {
      return response.data.user;
    }

    return null;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        // Invalid credentials
        return null;
      }
      console.error('Central auth error:', error.message);
    } else {
      console.error('Unexpected error verifying credentials:', error);
    }
    throw new Error('无法连接到认证服务器');
  }
};

/**
 * Check if a user exists in the central authentication system
 */
export const checkCentralUserExists = async (username: string): Promise<boolean> => {
  try {
    const response = await axios.get<{ exists: boolean }>(
      `${env.CENTRAL_AUTH_URL}/user/${encodeURIComponent(username)}`,
      { timeout: 5000 }
    );
    return response.data.exists;
  } catch (error) {
    console.error('Error checking user existence:', error);
    return false;
  }
};


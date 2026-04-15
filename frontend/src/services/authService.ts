// frontend/src/services/authService.ts
import api from './api';
import { AuthResponse, User } from '../types/types';

export const authService = {
  // Login
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', {
      email,
      password,
    });
    return response.data;
  },

  // Register
  async register(data: {
    email: string;
    password: string;
    fullName: string;
    role?: 'admin' | 'credentialing_specialist';
  }): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  // Get current user
  async getMe(): Promise<User> {
    const response = await api.get<{ status: string; data: { user: User } }>('/auth/me');
    return response.data.data.user;
  },

  // Update password
  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.put('/auth/update-password', {
      currentPassword,
      newPassword,
    });
  },

  // Admin: get all users
  async getAllUsers(): Promise<any[]> {
    const response = await api.get('/auth/users');
    return response.data?.data?.users || [];
  },

  // Admin: update user role
  async updateUserRole(userId: string, role: string): Promise<any> {
    const response = await api.patch(`/auth/users/${userId}/role`, { role });
    return response.data?.data?.user;
  },

  // Admin: create new user
  async createUser(data: {
    fullName: string;
    email: string;
    password: string;
    role: 'admin' | 'credentialing_specialist';
  }): Promise<any> {
    const response = await api.post('/auth/users', data);
    return response.data?.data?.user;
  },

  // Admin: delete user
  async deleteUser(userId: string): Promise<void> {
    await api.delete(`/auth/users/${userId}`);
  },

  // Admin: assign one provider to user (or clear assignment)
  async assignUserProvider(userId: string, providerId: string | null): Promise<any> {
    const response = await api.patch(`/auth/users/${userId}/provider`, { providerId });
    return response.data?.data?.user;
  },
};

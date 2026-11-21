import { api } from './api';
import { AuthResponseData, HealthData, User } from '../types/auth';

export const authService = {
  async register(data: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): Promise<{ user: User; token?: string }> {
    const res = await api.post<AuthResponseData>('/api/auth/register', data);
    if (!res.data) throw new Error(res.message || 'Registration failed');
    if (res.data.token) {
      api.setToken(res.data.token);
    }
    return res.data;
  },

  async login(data: {
    email: string;
    password: string;
  }): Promise<{ user: User; token?: string }> {
    const res = await api.post<AuthResponseData>('/api/auth/login', data);
    if (!res.data) throw new Error(res.message || 'Login failed');
    if (res.data.token) {
      api.setToken(res.data.token);
    }
    return res.data;
  },

  async getMe(): Promise<User> {
    const res = await api.get<{ user: User }>('/api/auth/me');
    if (!res.data?.user) throw new Error('User not found');
    return res.data.user;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout');
    } finally {
      api.setToken(null);
    }
  },

  async checkHealth(): Promise<HealthData> {
    const res = await api.get<HealthData>('/api/health');
    if (!res.data) throw new Error('Health check failed');
    return res.data;
  },
};

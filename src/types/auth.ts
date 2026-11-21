export interface User {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  role?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
}

export interface AuthResponseData {
  user: User;
  token?: string;
}

export interface HealthData {
  status: string;
  service: string;
  timestamp: string;
  database: {
    connected: boolean;
    type: 'mongodb' | 'disconnected' | 'test-mock' | 'memory' | string;
    persistent?: boolean;
    host: string;
    name?: string;
    warning?: string;
    error?: string;
  };
  environment: string;
}

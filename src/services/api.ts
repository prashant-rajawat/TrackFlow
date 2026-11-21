import { ApiResponse } from '../types/auth';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedToken = localStorage.getItem('trackflow_token');
        if (savedToken) {
          this.token = savedToken;
        }
      }
    } catch (_e) {
      // Safe fallback
    }
  }

  setToken(token: string | null) {
    this.token = token;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (token) {
          localStorage.setItem('trackflow_token', token);
        } else {
          localStorage.removeItem('trackflow_token');
        }
      }
    } catch (_e) {
      // Safe fallback
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem('trackflow_token');
      }
    } catch (_e) {
      // Safe fallback
    }
    return null;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Ensure cookies are sent
      });

      let json: ApiResponse<T>;
      try {
        json = await response.json();
      } catch (_e) {
        throw new Error(
          `Server responded with non-JSON status ${response.status} (${response.statusText})`
        );
      }

      if (!response.ok) {
        const errorMsg =
          json.message ||
          (json.errors && json.errors.length > 0 ? json.errors[0].message : null) ||
          `Request failed with status ${response.status}`;
        
        const error: any = new Error(errorMsg);
        error.status = response.status;
        error.errors = json.errors;
        throw error;
      }

      return json;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Network error. Unable to reach the TrackFlow server.');
      }
      throw err;
    }
  }

  get<T>(endpoint: string, options?: RequestInit) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: any, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: any, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: any, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: RequestInit) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();

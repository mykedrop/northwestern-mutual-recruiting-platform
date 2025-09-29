import api from './api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  mfaEnabled: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  requiresMFA?: boolean;
}

class AuthService {
  private static instance: AuthService;
  private user: User | null = null;
  private tokens: { access: string; refresh: string } | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await api.post('/auth/login', credentials);

      if (response.requiresMFA && !credentials.mfaCode) {
        return response;
      }

      this.setAuthData(response);
      return response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  }

  async loginWithMFA(email: string, password: string, mfaCode: string): Promise<AuthResponse> {
    try {
      const response = await api.post('/auth/login-mfa', {
        email,
        password,
        mfaCode
      });

      this.setAuthData(response);
      return response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'MFA login failed');
    }
  }

  async refreshToken(): Promise<string> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await api.post('/auth/refresh', {
        refreshToken
      });

      this.setTokens(response.accessToken, response.refreshToken);
      return response.accessToken;
    } catch (error) {
      this.logout();
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      const refreshToken = this.getRefreshToken();
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      this.clearAuthData();
    }
  }

  async getProfile(): Promise<User> {
    try {
      const response = await api.get('/auth/profile');
      this.user = response.user;
      return response.user;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get profile');
    }
  }

  async setupMFA(): Promise<{ qrCode: string; backupCodes: string[] }> {
    try {
      const response = await api.post('/auth/setup-mfa');
      return response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to setup MFA');
    }
  }

  async verifyMFA(token: string): Promise<void> {
    try {
      await api.post('/auth/verify-mfa', { token });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to verify MFA');
    }
  }

  private setAuthData(authResponse: AuthResponse): void {
    this.user = authResponse.user;
    this.setTokens(authResponse.accessToken, authResponse.refreshToken);
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    this.tokens = { access: accessToken, refresh: refreshToken };
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  private clearAuthData(): void {
    this.user = null;
    this.tokens = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  getAccessToken(): string | null {
    return this.tokens?.access || localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return this.tokens?.refresh || localStorage.getItem('refreshToken');
  }

  getUser(): User | null {
    if (this.user) return this.user;

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        this.user = JSON.parse(storedUser);
        return this.user;
      } catch (error) {
        console.warn('Failed to parse stored user data');
      }
    }

    return null;
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  hasRole(role: string): boolean {
    const user = this.getUser();
    return user?.role === role;
  }

  getOrganization(): User['organization'] | null {
    const user = this.getUser();
    return user?.organization || null;
  }

  isNorthwesternMutual(): boolean {
    const org = this.getOrganization();
    return org?.slug === 'northwestern-mutual';
  }
}

export const authService = AuthService.getInstance();
export default authService;
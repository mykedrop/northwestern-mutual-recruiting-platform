import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { authService, User, LoginCredentials } from '../services/auth';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  requiresMFA: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  loginWithMFA: (email: string, password: string, mfaCode: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  setupMFA: () => Promise<{ qrCode: string; backupCodes: string[] }>;
  verifyMFA: (token: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      immer((set, get) => ({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        requiresMFA: false,

        login: async (credentials: LoginCredentials) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await authService.login(credentials);

            if (response.requiresMFA) {
              set((state) => {
                state.requiresMFA = true;
                state.isLoading = false;
              });
              return;
            }

            set((state) => {
              state.user = response.user;
              state.isAuthenticated = true;
              state.requiresMFA = false;
              state.isLoading = false;
            });

            // Store user in localStorage for persistence
            localStorage.setItem('user', JSON.stringify(response.user));
          } catch (error: any) {
            set((state) => {
              state.error = error.message;
              state.isLoading = false;
              state.requiresMFA = false;
            });
            throw error;
          }
        },

        loginWithMFA: async (email: string, password: string, mfaCode: string) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await authService.loginWithMFA(email, password, mfaCode);

            set((state) => {
              state.user = response.user;
              state.isAuthenticated = true;
              state.requiresMFA = false;
              state.isLoading = false;
            });

            localStorage.setItem('user', JSON.stringify(response.user));
          } catch (error: any) {
            set((state) => {
              state.error = error.message;
              state.isLoading = false;
            });
            throw error;
          }
        },

        logout: async () => {
          set((state) => {
            state.isLoading = true;
          });

          try {
            await authService.logout();
          } catch (error) {
            console.warn('Logout error:', error);
          } finally {
            set((state) => {
              state.user = null;
              state.isAuthenticated = false;
              state.isLoading = false;
              state.error = null;
              state.requiresMFA = false;
            });
          }
        },

        checkAuth: async () => {
          const token = authService.getAccessToken();
          if (!token) {
            set((state) => {
              state.isAuthenticated = false;
              state.user = null;
            });
            return;
          }

          try {
            const user = await authService.getProfile();
            set((state) => {
              state.user = user;
              state.isAuthenticated = true;
            });
            localStorage.setItem('user', JSON.stringify(user));
          } catch (error) {
            // Token might be invalid
            await get().logout();
          }
        },

        clearError: () => {
          set((state) => {
            state.error = null;
          });
        },

        setupMFA: async () => {
          try {
            const response = await authService.setupMFA();
            return response;
          } catch (error: any) {
            set((state) => {
              state.error = error.message;
            });
            throw error;
          }
        },

        verifyMFA: async (token: string) => {
          try {
            await authService.verifyMFA(token);
            // Refresh user data to get updated MFA status
            await get().checkAuth();
          } catch (error: any) {
            set((state) => {
              state.error = error.message;
            });
            throw error;
          }
        },
      })),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    { name: 'auth-store' }
  )
);
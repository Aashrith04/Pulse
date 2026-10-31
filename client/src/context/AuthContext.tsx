import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  state?: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string, state?: string) => Promise<void>;
  logout: () => void;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';
  openAuthModal: (mode?: 'login' | 'register', callback?: () => void) => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('pulse_auth_token') : null;
  });
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('pulse_user') : null;
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [postAuthAction, setPostAuthAction] = useState<(() => void) | null>(null);

  // Validate session on mount
  useEffect(() => {
    if (token) {
      api.getMe()
        .then(res => {
          if (res.authenticated && res.user) {
            setUser(prev => ({
              id: res.user!.id,
              email: res.user!.email,
              isAdmin: res.user!.isAdmin,
              fullName: prev?.fullName,
              state: prev?.state,
            }));
          } else {
            // Token is invalid/expired
            logout();
          }
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    if (res.session?.access_token) {
      localStorage.setItem('pulse_auth_token', res.session.access_token);
      localStorage.setItem('pulse_user', JSON.stringify(res.user));
      setToken(res.session.access_token);
      setUser(res.user);
      setIsAuthModalOpen(false);
      if (postAuthAction) {
        postAuthAction();
        setPostAuthAction(null);
      }
    }
  };

  const register = async (email: string, password: string, fullName?: string, state?: string) => {
    const res = await api.register({ email, password, fullName, state });
    if (res.session?.access_token) {
      localStorage.setItem('pulse_auth_token', res.session.access_token);
      localStorage.setItem('pulse_user', JSON.stringify(res.user));
      setToken(res.session.access_token);
      setUser(res.user);
      setIsAuthModalOpen(false);
      if (postAuthAction) {
        postAuthAction();
        setPostAuthAction(null);
      }
    }
  };

  const logout = () => {
    localStorage.removeItem('pulse_auth_token');
    localStorage.removeItem('pulse_user');
    setToken(null);
    setUser(null);
    api.logout().catch(() => {});
  };

  const openAuthModal = (mode: 'login' | 'register' = 'login', callback?: () => void) => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
    if (callback) {
      setPostAuthAction(() => callback);
    }
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setPostAuthAction(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token && user),
        isLoading,
        login,
        register,
        logout,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

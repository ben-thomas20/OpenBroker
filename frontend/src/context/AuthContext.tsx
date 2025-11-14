import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';
import type { User, LoginCredentials, RegisterData } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = api.getToken();
    if (token) {
      // Verify token is valid by making a test request
      try {
        // You might want to add a /auth/me endpoint to verify token
        // For now, we'll assume token exists means authenticated
        setUser({ id: 'user', email: '', name: '' }); // Placeholder
      } catch (error) {
        api.clearToken();
        setUser(null);
      }
    }
    setLoading(false);
  };

  const login = async (credentials: LoginCredentials) => {
    const response = await api.login(credentials);
    setUser(response.user);
  };

  const register = async (data: RegisterData) => {
    const response = await api.register(data);
    setUser(response.user);
  };

  const logout = () => {
    api.clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


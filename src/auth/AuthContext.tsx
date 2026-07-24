import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { apiFetch, clearToken, getToken, setToken } from '../data/apiFetch';
import { initStore } from '../data/store';

interface AuthState {
  user: User | null | undefined; // undefined = still checking the stored session
  login: (email: string, password: string, remember: boolean) => Promise<string | null>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: undefined,
  login: async () => 'Auth not ready',
  logout: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const me = await apiFetch<User>('/auth/me');
      // Warm the data cache only once a valid session is confirmed — /api/bootstrap
      // requires auth, so this can't run before we know the stored token is good.
      await initStore();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    try {
      const { token, user: found } = await apiFetch<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, remember }),
      });
      setToken(token, remember);
      await initStore();
      setUser(found);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

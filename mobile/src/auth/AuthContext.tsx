import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { apiFetch, registerUnauthorizedHandler } from '../api/client';
import { clearToken, getToken, setToken } from './storage';

interface AuthState {
  user: User | null | undefined; // undefined = still checking the stored session
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: undefined,
  login: async () => 'Auth not ready',
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  const refreshUser = useCallback(async () => {
    // Wrap the whole check (including the storage read itself) — if anything here throws,
    // the safe fallback is "treat as logged out", not leaving `user` stuck at `undefined`
    // forever (which would hang RootNavigator on its spinner indefinitely).
    try {
      const token = await getToken();
      if (!token) {
        setUser(null);
        return;
      }
      const me = await apiFetch<User>('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Central 401 handling (see api/client.ts) flips `user` to null on any expired/invalid
  // session, which is what actually drives RootNavigator's AuthStack/AppTabs switch.
  useEffect(() => {
    registerUnauthorizedHandler(() => setUser(null));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { token, user: found } = await apiFetch<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await setToken(token);
      setUser(found);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

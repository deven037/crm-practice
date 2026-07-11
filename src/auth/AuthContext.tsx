import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { User } from '../types';
import { delay, getAllSync, logAudit } from '../data/store';

const SESSION_KEY = 'crm.session';

interface AuthState {
  user: User | null;
  login: (email: string, password: string, remember: boolean) => Promise<string | null>;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  login: async () => 'Auth not ready',
  logout: () => {},
  refreshUser: () => {},
});

function readSession(): User | null {
  const id = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
  if (!id) return null;
  return getAllSync<User>('users').find((u) => u.id === id) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readSession());

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    await delay(400, 1000);
    const found = getAllSync<User>('users').find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
    );
    if (!found) return 'Invalid email or password.';
    if (!found.active) return 'This account has been deactivated. Contact your administrator.';
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(SESSION_KEY, found.id);
    logAudit(found.name, 'login', `${found.name} signed in`);
    setUser(found);
    return null;
  }, []);

  const logout = useCallback(() => {
    if (user) logAudit(user.name, 'logout', `${user.name} signed out`);
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, [user]);

  const refreshUser = useCallback(() => setUser(readSession()), []);

  return <AuthContext.Provider value={{ user, login, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

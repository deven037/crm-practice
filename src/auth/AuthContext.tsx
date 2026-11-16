import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { apiFetch, clearToken, getToken, setToken } from '../data/apiFetch';
import { initStore } from '../data/store';
import { PublicBank, rememberBank } from '../data/frontDoor';
import { applyBankTheme } from '../theme/bankTheme';

/** Which bank to sign in to, when the email alone does not settle it. */
export interface BankChoice {
  bankId?: string;
  bankName?: string;
}

/** A failed sign-in: the message to show, the server's code, and the banks to choose from when it asks. */
export interface LoginFailure {
  message: string;
  code: string;
  banks?: PublicBank[];
}

interface Session {
  token: string;
  user: User;
  bank?: PublicBank;
  mustChangePassword?: boolean;
}

interface AuthState {
  user: User | null | undefined; // undefined = still checking the stored session
  /** Signs in. Resolves to null on success, or to what went wrong. */
  login: (email: string, password: string, remember: boolean, bank?: BankChoice) => Promise<LoginFailure | null>;
  /** Starts a session the server has just issued (an accepted invite, a changed password). */
  startSession: (session: Session, remember: boolean) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: undefined,
  login: async () => ({ message: 'Auth not ready', code: 'not_ready' }),
  startSession: async () => {},
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
      // A failed warm-up must not end the session: the shell shows its own error and Retry.
      // Only a 401 does (apiFetch clears the token), so the token tells the two apart.
      // Someone who must replace their password first has no data to load yet.
      if (!me.mustChangePassword) await initStore().catch(() => undefined);
      setUser(getToken() ? me : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const startSession = useCallback(async (session: Session, remember: boolean) => {
    setToken(session.token, remember);
    if (session.bank) {
      // The device remembers the bank: its branded sign-in opens directly next time.
      rememberBank(session.bank);
      applyBankTheme(session.bank.color);
    }
    const mustChangePassword = Boolean(session.mustChangePassword ?? session.user.mustChangePassword);
    if (!mustChangePassword) await initStore();
    setUser({ ...session.user, mustChangePassword });
  }, []);

  const login = useCallback(
    async (email: string, password: string, remember: boolean, bank: BankChoice = {}) => {
      try {
        const session = await apiFetch<Session>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password, remember, ...bank }),
        });
        await startSession(session, remember);
        return null;
      } catch (e) {
        const error = e as Error & { code?: string; details?: { banks?: PublicBank[] } };
        return { message: error.message, code: error.code ?? 'request_failed', banks: error.details?.banks };
      }
    },
    [startSession]
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, login, startSession, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

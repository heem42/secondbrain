import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  apiFetch,
  login as apiLogin,
  logout as apiLogout,
  refreshAccessToken,
  signup as apiSignup,
} from '../api/client';
import type { User } from '../api/types';

type Status = 'loading' | 'authed' | 'anon';

interface AuthContextValue {
  status: Status;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  // On load, try to restore a session from the httpOnly refresh cookie: mint a
  // fresh access token, then fetch the profile. No token is persisted in JS.
  useEffect(() => {
    let active = true;
    (async () => {
      const ok = await refreshAccessToken();
      if (!active) return;
      if (!ok) {
        setStatus('anon');
        return;
      }
      try {
        const me = await apiFetch<User>('/users/me');
        if (!active) return;
        setUser(me);
        setStatus('authed');
      } catch {
        if (active) setStatus('anon');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login: async (email, password) => {
        setUser(await apiLogin(email, password));
        setStatus('authed');
      },
      signup: async (email, password, displayName) => {
        setUser(await apiSignup(email, password, displayName));
        setStatus('authed');
      },
      logout: async () => {
        await apiLogout();
        setUser(null);
        setStatus('anon');
      },
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

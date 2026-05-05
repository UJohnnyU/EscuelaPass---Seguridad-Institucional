import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { unregisterWebPushToken } from '@/lib/fcm-web';
import { clearTokens, loadTokens, loadUser, saveTokens, saveUser, type StoredUser } from '@/lib/storage';
import { AuthContext, type AuthState } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = loadUser();
    const { access } = loadTokens();
    if (u && access) setUser(u);
    else clearTokens();
    setReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{
      accessToken: string;
      refreshToken: string;
      user: StoredUser;
    }>('/api/v1/auth/login', { email: email.trim(), password });
    saveTokens(data.accessToken, data.refreshToken);
    saveUser(data.user);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await unregisterWebPushToken();
    } catch {
      /* ignorar */
    }
    const { refresh } = loadTokens();
    try {
      if (refresh) {
        await api.post('/api/v1/auth/logout', { refreshToken: refresh });
      }
    } catch {
      /* ignorar */
    }
    clearTokens();
    setUser(null);
    window.location.assign('/login');
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      login: async (email: string, password: string) => {
        try {
          await login(email, password);
        } catch (e) {
          throw new Error(getUserFacingMessage(e, 'No se pudo iniciar sesión.'));
        }
      },
      logout
    }),
    [user, ready, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

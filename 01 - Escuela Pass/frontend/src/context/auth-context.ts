import { createContext } from 'react';
import type { StoredUser } from '@/lib/storage';

export type AuthState = {
  user: StoredUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

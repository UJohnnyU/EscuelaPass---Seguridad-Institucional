const ACCESS = 'ep_access';
const REFRESH = 'ep_refresh';
const USER = 'ep_user';

export type StoredUser = {
  id: string;
  email: string;
  role: string;
  fullName: string;
};

export function loadTokens(): { access: string | null; refresh: string | null } {
  return {
    access: localStorage.getItem(ACCESS),
    refresh: localStorage.getItem(REFRESH)
  };
}

export function saveTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS, access);
  localStorage.setItem(REFRESH, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
  localStorage.removeItem(USER);
}

export function saveUser(u: StoredUser) {
  localStorage.setItem(USER, JSON.stringify(u));
}

export function loadUser(): StoredUser | null {
  const raw = localStorage.getItem(USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

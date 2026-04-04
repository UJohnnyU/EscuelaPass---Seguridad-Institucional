import type { StoredUser } from '@/lib/storage';

export function hasRole(user: StoredUser | null, ...roles: string[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

export function isStaff(user: StoredUser | null): boolean {
  return hasRole(user, 'ADMIN', 'ADMINISTRATIVO', 'DOCENTE');
}

export function isAdmin(user: StoredUser | null): boolean {
  return hasRole(user, 'ADMIN', 'ADMINISTRATIVO');
}

/** Entradas de menú lateral: `roles: null` = todos los autenticados. */
export type NavItem = {
  to: string;
  label: string;
  roles: string[] | null;
};

export const SIDEBAR_NAV: NavItem[] = [
  { to: '/app', label: 'Inicio', roles: null },
  { to: '/app/perfil', label: 'Mi perfil', roles: null },
  { to: '/app/modulos', label: 'Operaciones', roles: null },
  { to: '/app/modulos/academico', label: 'Académico', roles: ['ALUMNO', 'PADRE'] },
  { to: '/app/modulos/calificaciones-docente', label: 'Calificaciones', roles: ['DOCENTE'] },
  { to: '/app/modulos/anotaciones-docente', label: 'Anotaciones', roles: ['DOCENTE'] },
  { to: '/app/horario', label: 'Horario', roles: ['ALUMNO'] },
  { to: '/app/modulos/herramientas', label: 'Herramientas', roles: ['ADMIN', 'ADMINISTRATIVO', 'DOCENTE'] },
  { to: '/app/institucion', label: 'Institución', roles: null },
  { to: '/app/importaciones', label: 'Importar y exportar', roles: ['ADMIN', 'ADMINISTRATIVO', 'DOCENTE'] },
  { to: '/app/acceso/escaner', label: 'Escáner de acceso', roles: ['ADMIN', 'ADMINISTRATIVO', 'DOCENTE'] },
  { to: '/app/circuito', label: 'Circuito (familia)', roles: ['PADRE', 'ADMIN', 'ADMINISTRATIVO'] },
  { to: '/app/circuito/hoy', label: 'Circuito del día', roles: ['DOCENTE', 'ADMIN', 'ADMINISTRATIVO'] }
];

export function navVisibleForRole(item: NavItem, role: string | undefined): boolean {
  if (!role) return false;
  if (item.roles === null) return true;
  return item.roles.includes(role);
}

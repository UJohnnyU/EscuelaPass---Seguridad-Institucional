/** Entradas de menú lateral: `roles: null` = todos los autenticados. */
export type NavItem = {
  to: string;
  label: string;
  roles: string[] | null;
};

export const SIDEBAR_NAV: NavItem[] = [
  { to: '/app', label: 'Inicio', roles: null },
  { to: '/app/perfil', label: 'Mi perfil', roles: null },
  { to: '/app/modulos/comunicacion', label: 'Comunicación', roles: null },
  { to: '/app/modulos/finanzas', label: 'Finanzas', roles: ['ADMIN', 'ADMINISTRATIVO', 'ALUMNO', 'PADRE'] },
  { to: '/app/modulos/visitas', label: 'Visitas externas', roles: null },
  { to: '/app/modulos/reuniones', label: 'Reuniones', roles: null },
  { to: '/app/modulos/academico', label: 'Académico', roles: ['PADRE', 'DOCENTE', 'ADMINISTRATIVO'] },
  { to: '/app/modulos/periodos-academicos', label: 'Periodos académicos', roles: ['ADMIN', 'ADMINISTRATIVO'] },
  { to: '/app/modulos/calificaciones-docente', label: 'Actividades y notas', roles: ['DOCENTE', 'ADMIN', 'ADMINISTRATIVO'] },
  { to: '/app/modulos/mis-calificaciones', label: 'Mis calificaciones', roles: ['ALUMNO'] },
  { to: '/app/modulos/mis-calificaciones', label: 'Calificaciones', roles: ['PADRE'] },
  { to: '/app/modulos/boletines', label: 'Boletines', roles: ['ADMIN', 'ADMINISTRATIVO', 'DOCENTE', 'ALUMNO', 'PADRE'] },
  { to: '/app/modulos/anotaciones-docente', label: 'Anotaciones', roles: ['DOCENTE', 'ADMIN', 'ADMINISTRATIVO'] },
  { to: '/app/horario', label: 'Horario', roles: ['ALUMNO', 'DOCENTE', 'ADMIN', 'ADMINISTRATIVO'] },
  { to: '/app/modulos/administracion', label: 'Administración e informes', roles: ['ADMIN', 'ADMINISTRATIVO'] },
  { to: '/app/institucion', label: 'Institución', roles: null },
  { to: '/app/gestion-escolar', label: 'Grupos y personas', roles: ['ADMIN', 'ADMINISTRATIVO'] },
  { to: '/app/escuelas', label: 'Escuelas', roles: ['ADMIN'] },
  { to: '/app/importaciones', label: 'Importar y exportar', roles: ['ADMIN', 'ADMINISTRATIVO'] },
  { to: '/app/acceso/escaner', label: 'Escáner de acceso', roles: ['ADMIN', 'ADMINISTRATIVO', 'DOCENTE'] },
  { to: '/app/circuito', label: 'Circuito (familia)', roles: ['PADRE'] },
  { to: '/app/circuito/hoy', label: 'Circuito del día', roles: ['DOCENTE', 'ADMIN', 'ADMINISTRATIVO'] }
];

/** Visibilidad por rol real: ADMIN ya no ve automáticamente todas las entradas (evita pantallas vacías o solo informativas). */
export function navVisibleForRole(item: NavItem, role: string | undefined): boolean {
  if (!role) return false;
  if (item.roles === null) return true;
  return item.roles.includes(role);
}

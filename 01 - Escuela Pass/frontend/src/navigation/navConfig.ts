/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

/** Entradas de menú lateral: `roles: null` = todos los autenticados. */
export type NavItem = {
  to: string;
  label: string;
  roles: string[] | null;
};

export const SIDEBAR_NAV: NavItem[] = [
  { to: '/app', label: 'Inicio', roles: null },
  { to: '/app/perfil', label: 'Mi perfil', roles: null },
  { to: '/app/modulos/reuniones', label: 'Reuniones', roles: null },
  { to: '/app/modulos/visitas-externas', label: 'Visitas externas', roles: null },
  {
    to: '/app/modulos/anotaciones-docente',
    label: 'Anotaciones (docente)',
    roles: ['DOCENTE', 'ADMIN', 'ADMINISTRATIVO']
  },
  { to: '/app/modulos/finanzas', label: 'Finanzas', roles: ['ADMIN', 'ADMINISTRATIVO', 'ALUMNO', 'PADRE'] },
  { to: '/app/modulos/academico', label: 'Académico', roles: ['PADRE', 'DOCENTE', 'ADMINISTRATIVO'] },
  { to: '/app/modulos/periodos-academicos', label: 'Periodos académicos', roles: ['ADMIN', 'ADMINISTRATIVO'] },
  { to: '/app/modulos/calificaciones-docente', label: 'Actividades y notas', roles: ['DOCENTE', 'ADMIN', 'ADMINISTRATIVO'] },
  { to: '/app/modulos/mis-calificaciones', label: 'Mis calificaciones', roles: ['ALUMNO'] },
  { to: '/app/modulos/mis-calificaciones', label: 'Calificaciones', roles: ['PADRE'] },
  { to: '/app/modulos/boletines', label: 'Boletines', roles: ['ADMIN', 'ADMINISTRATIVO', 'DOCENTE', 'ALUMNO', 'PADRE'] },
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

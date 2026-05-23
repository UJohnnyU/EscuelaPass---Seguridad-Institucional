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

import type { SmartSelectOption } from '@/components/SmartSelect';
import { api } from '@/lib/api';

/** Coincide con el límite máximo del API para búsquedas de grupos. */
export const GROUP_SELECT_LIMIT = 80;

export type GroupSelectRow = {
  id: string;
  name: string;
  grade: string | null;
  schoolYear: string;
  schoolId?: string;
};

type SchoolMini = { id: string; name: string; code: string };

export function toGroupSmartOptions(
  rows: GroupSelectRow[],
  schools: SchoolMini[],
  showSchoolPrefix: boolean
): SmartSelectOption[] {
  return rows.map((g) => {
    const schoolName = g.schoolId ? schools.find((s) => s.id === g.schoolId)?.name : undefined;
    const prefix = showSchoolPrefix && schoolName ? `${schoolName} · ` : '';
    const label = `${prefix}${g.name}${g.grade ? ` · ${g.grade}` : ''} · ${g.schoolYear}`;
    const searchText = [schoolName, g.name, g.grade, g.schoolYear].filter(Boolean).join(' ');
    return { value: g.id, label, searchText };
  });
}

/**
 * Grupos por escuela o alcance del JWT (`GET /school/groups` con `q` y `limit`).
 */
export function createSchoolGroupsLoadOptions(args: {
  /** Si se envía, filtra por escuela (ADMIN plataforma). */
  schoolId?: string | null;
  schools: SchoolMini[];
  /** true: prefijar nombre de escuela (listas mezcladas). */
  showSchoolPrefix: boolean;
}) {
  return async (q: string, signal: AbortSignal): Promise<SmartSelectOption[]> => {
    const params: Record<string, string | undefined> = {
      q: q.trim() || undefined,
      limit: String(GROUP_SELECT_LIMIT)
    };
    if (args.schoolId?.trim()) params.schoolId = args.schoolId.trim();
    const { data } = await api.get<GroupSelectRow[]>('/api/v1/school/groups', { params, signal });
    const rows = Array.isArray(data) ? data : [];
    return toGroupSmartOptions(rows, args.schools, args.showSchoolPrefix);
  };
}

/**
 * Grupos donde el usuario tiene asignación docente / vista me (`GET /schedules/me/teacher/groups`).
 */
export function createTeacherMyGroupsLoadOptions(schools: SchoolMini[], showSchoolPrefix: boolean) {
  return async (q: string, signal: AbortSignal): Promise<SmartSelectOption[]> => {
    const params = { q: q.trim() || undefined, limit: String(GROUP_SELECT_LIMIT) };
    const { data } = await api.get<GroupSelectRow[]>('/api/v1/schedules/me/teacher/groups', { params, signal });
    const rows = Array.isArray(data) ? data : [];
    return toGroupSmartOptions(rows, schools, showSchoolPrefix);
  };
}

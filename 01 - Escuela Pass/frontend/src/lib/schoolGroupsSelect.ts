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

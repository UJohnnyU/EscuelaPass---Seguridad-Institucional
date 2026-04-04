import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { Panel } from '@/components/ValueView';
import { useAuth } from '@/context/useAuth';
import { isAdmin } from '@/lib/roles';

type Group = { id: string; name?: string; grade?: string | null; schoolYear?: string };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function groupLabel(g: Group): string {
  const parts = [g.name, g.grade, g.schoolYear].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Grupo';
}

export function ImportExportPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const docente = user?.role === 'DOCENTE';
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        if (admin) {
          const { data } = await api.get<Group[]>('/api/v1/school/groups');
          if (!cancelled && Array.isArray(data)) {
            setGroups(data);
            setGroupId(data[0]?.id ?? '');
          }
        } else if (docente) {
          const { data } = await api.get<Group[]>('/api/v1/schedules/me/teacher/groups');
          if (!cancelled && Array.isArray(data)) {
            setGroups(data);
            setGroupId(data[0]?.id ?? '');
          }
        }
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [admin, docente]);

  async function downloadTemplate(path: string, filename: string) {
    setLoading(true);
    setErr(null);
    try {
      const { data } = await api.get(path, { responseType: 'blob' });
      downloadBlob(data as Blob, filename);
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function downloadExport(path: string, filename: string, params?: Record<string, string | undefined>) {
    if (!groupId) {
      setErr('Seleccione un grupo.');
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const { data } = await api.get(path, {
        params: { groupId, ...params },
        responseType: 'blob'
      });
      downloadBlob(data as Blob, filename);
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setLoading(false);
    }
  }

  if (!admin && !docente) {
    return (
      <p className="text-sm text-slate-600">
        Esta sección es para personal de la institución. Si necesita un archivo, solicítelo en secretaría.
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Importar y exportar información</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Descargue plantillas y archivos de trabajo en Excel según los permisos de su cuenta. Las cargas masivas
          suelen realizarse desde herramientas autorizadas; aquí tiene las <strong>plantillas oficiales</strong> y las{' '}
          <strong>exportaciones</strong> por grupo.
        </p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}

      <Panel
        title="Plantillas de importación (Excel)"
        description="Descargue el formato esperado por el sistema para cargas masivas."
      >
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void downloadTemplate('/api/v1/school/import/templates/students.xlsx', 'plantilla-alumnos.xlsx')
            }
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
          >
            Plantilla estudiantes
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void downloadTemplate(
                '/api/v1/school/import/templates/students-to-groups.xlsx',
                'plantilla-asignacion-grupos.xlsx'
              )
            }
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
          >
            Plantilla asignación a grupos
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void downloadTemplate('/api/v1/school/import/templates/groups.xlsx', 'plantilla-grupos.xlsx')}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
          >
            Plantilla grupos
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void downloadTemplate('/api/v1/school/import/templates/teachers.xlsx', 'plantilla-docentes.xlsx')
            }
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
          >
            Plantilla docentes
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void downloadTemplate(
                '/api/v1/school/import/templates/teacher-assignments.xlsx',
                'plantilla-asignaciones-docentes.xlsx'
              )
            }
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
          >
            Plantilla asignaciones docente–grupo
          </button>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          La subida de archivos la realiza personal con permisos de administración escolar.
        </p>
      </Panel>

      <Panel
        title="Exportaciones por grupo"
        description="Elija un curso y descargue el archivo. Si no aparece ningún grupo, verifique su asignación docente o los permisos con secretaría."
      >
        {groups.length > 0 ? (
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <label className="block text-xs font-medium uppercase text-slate-500">Grupo</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {groupLabel(g)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium uppercase text-slate-500">Fecha (asistencia)</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        ) : (
          <p className="mb-4 text-sm text-amber-800">
            No hay grupos disponibles para su usuario. Compruebe que tenga grupos asignados o permisos de consulta.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading || !groupId}
            onClick={() =>
              downloadExport('/api/v1/exports/attendance.xlsx', `asistencia-${date}.xlsx`, { date })
            }
            className="rounded bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-950 disabled:opacity-50"
          >
            Exportar asistencia (.xlsx)
          </button>
          <button
            type="button"
            disabled={loading || !groupId}
            onClick={() => downloadExport('/api/v1/exports/grades.xlsx', 'calificaciones.xlsx')}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
          >
            Exportar calificaciones (.xlsx)
          </button>
          <button
            type="button"
            disabled={loading || !groupId}
            onClick={() =>
              downloadExport('/api/v1/exports/bulletin-consolidated.xlsx', 'boletin-consolidado.xlsx')
            }
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
          >
            Boletín consolidado (.xlsx)
          </button>
        </div>
      </Panel>
    </div>
  );
}

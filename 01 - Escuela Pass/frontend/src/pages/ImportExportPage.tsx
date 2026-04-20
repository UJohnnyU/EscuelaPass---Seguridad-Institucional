import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { SmartSelect } from '@/components/SmartSelect';
import { createSchoolGroupsLoadOptions, createTeacherMyGroupsLoadOptions } from '@/lib/schoolGroupsSelect';
import { Panel } from '@/components/ValueView';
import { useAuth } from '@/context/useAuth';
import { hasRole, isAdmin, isPlatformAdmin } from '@/lib/roles';

type Group = {
  id: string;
  name?: string;
  grade?: string | null;
  schoolYear?: string;
  schoolId?: string;
};
type SchoolRow = { id: string; name: string; code: string };
type ImportKind = 'groups' | 'students' | 'teachers' | 'teacher-assignments' | 'students-to-groups';
type ImportSummary = {
  totalRows: number;
  created?: number;
  updated?: number;
  errors: Array<{ row: number; message: string }>;
  dryRun: boolean;
};
type ImportHistoryRow = {
  id: string;
  kind: string;
  createdAt: string;
  totalRows: number;
  created: number;
  errorCount: number;
  dryRun: boolean;
};
type TemplateFormat = 'xlsx' | 'csv';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function groupLabel(g: Group, schoolName?: string): string {
  const parts = [schoolName, g.name, g.grade, g.schoolYear].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Grupo';
}

export function ImportExportPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const platformAdmin = isPlatformAdmin(user);
  const administrativo = user?.role === 'ADMINISTRATIVO';
  const adminOrStaff = hasRole(user, 'ADMIN', 'ADMINISTRATIVO');
  const docente = user?.role === 'DOCENTE';
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [groupId, setGroupId] = useState('');
  const [exportGroupLabel, setExportGroupLabel] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importKind, setImportKind] = useState<ImportKind>('students');
  const [dryRun, setDryRun] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [history, setHistory] = useState<ImportHistoryRow[]>([]);
  const [templateFormat, setTemplateFormat] = useState<TemplateFormat>('xlsx');

  const schoolFilterOptions = useMemo(
    () => [
      { value: '', label: 'Todas las instituciones' },
      ...schools.map((s) => ({ value: s.id, label: `${s.name} (${s.code})`, searchText: s.code }))
    ],
    [schools]
  );

  const loadExportGroupOptions = useMemo(() => {
    if (platformAdmin || administrativo) {
      return createSchoolGroupsLoadOptions({
        schoolId: platformAdmin && schoolFilter.trim() ? schoolFilter.trim() : undefined,
        schools,
        showSchoolPrefix: platformAdmin && !schoolFilter.trim()
      });
    }
    if (docente) {
      return createTeacherMyGroupsLoadOptions(schools, false);
    }
    return async () => [];
  }, [administrativo, docente, platformAdmin, schoolFilter, schools]);

  useEffect(() => {
    if (!platformAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<SchoolRow[]>('/api/v1/schools');
        if (!cancelled && Array.isArray(data)) setSchools(data);
      } catch {
        if (!cancelled) setSchools([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformAdmin]);

  useEffect(() => {
    if (!platformAdmin && !administrativo && !docente) return;
    const ac = new AbortController();
    let cancelled = false;
    setErr(null);
    loadExportGroupOptions('', ac.signal)
      .then((rows) => {
        if (cancelled) return;
        if (rows.length > 0) {
          setGroupId((prev) => (prev && rows.some((r) => r.value === prev) ? prev : rows[0].value));
        } else {
          setGroupId('');
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const aborted =
          e &&
          typeof e === 'object' &&
          'name' in e &&
          ((e as { name?: string }).name === 'CanceledError' || (e as { name?: string }).name === 'AbortError');
        if (!aborted) setErr(getUserFacingMessage(e));
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [loadExportGroupOptions, platformAdmin, administrativo, docente, schoolFilter]);

  useEffect(() => {
    if (!groupId) {
      setExportGroupLabel('');
      return;
    }
    let cancelled = false;
    api
      .get<Group>(`/api/v1/school/groups/${groupId}`)
      .then(({ data: g }) => {
        if (cancelled) return;
        setExportGroupLabel(groupLabel(g, platformAdmin && g.schoolId ? schools.find((s) => s.id === g.schoolId)?.name : undefined));
      })
      .catch(() => {
        if (!cancelled) setExportGroupLabel('');
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, platformAdmin, schools]);

  async function loadImportHistory() {
    if (!adminOrStaff) return;
    try {
      const { data } = await api.get<ImportHistoryRow[]>('/api/v1/school/import/history?limit=30');
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    }
  }

  useEffect(() => {
    void loadImportHistory();
  }, [adminOrStaff]);

  /** ADMIN de plataforma: al elegir escuela, las plantillas .xlsx incluyen nombre y logo de esa institución. */
  const templateExcelSchoolQuery = useMemo(() => {
    if (platformAdmin && schoolFilter.trim()) {
      return `?schoolId=${encodeURIComponent(schoolFilter.trim())}`;
    }
    return '';
  }, [platformAdmin, schoolFilter]);

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

  async function runImport(forceExecute = false) {
    if (!adminOrStaff) {
      setErr('Solo administración puede ejecutar cargas masivas.');
      return;
    }
    if (!uploadFile) {
      setErr('Seleccione un archivo .xlsx o .csv.');
      return;
    }
    const ext = uploadFile.name.toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.csv')) {
      setErr('Formato no soportado. Use .xlsx o .csv.');
      return;
    }
    const effectiveDryRun = forceExecute ? false : dryRun;
    setLoading(true);
    setErr(null);
    setOk(null);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const { data } = await api.post<ImportSummary>(`/api/v1/school/import/${importKind}`, formData, {
        params: { dryRun: effectiveDryRun ? 'true' : 'false' },
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportResult(data);
      if (effectiveDryRun) {
        setOk('Validación completada. Revise errores y luego ejecute la importación real.');
      } else {
        setOk('Importación aplicada correctamente.');
      }
      await loadImportHistory();
    } catch (e) {
      setErr(getUserFacingMessage(e));
      setImportResult(null);
    } finally {
      setLoading(false);
    }
  }

  if (!admin && !docente) {
    return (
      <p className="text-sm text-slate-600">
        Esta sección es para el personal del plantel. Si necesita un archivo, solicítelo en secretaría.
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Importar y exportar información</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Descargue las <strong>plantillas oficiales</strong> para preparar listas de alumnos, docentes o grupos, y
          obtenga <strong>exportaciones</strong> en Excel con la información de cada grupo.
        </p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      {ok && <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{ok}</div>}

      <Panel
        title="Plantillas para importar (Excel y CSV)"
        description="Use estos archivos como base: complételos con los datos y luego cárguelos al sistema."
      >
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="text-sm text-slate-700">
            Formato preferido
            <select
              className="ml-3 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
              value={templateFormat}
              onChange={(e) => setTemplateFormat(e.target.value as TemplateFormat)}
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
            </select>
          </label>
          {platformAdmin ? (
            <div className="min-w-[12rem] max-w-md flex-1">
              <label className="block text-xs font-medium uppercase text-slate-500">
                Institución (cabecera y logo en Excel)
              </label>
              <div className="mt-1">
                <SmartSelect
                  options={schoolFilterOptions}
                  value={schoolFilter}
                  onChange={setSchoolFilter}
                  placeholder="Todas — sin logo de escuela concreta"
                />
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void downloadTemplate(
                `/api/v1/school/import/templates/students.${templateFormat}${
                  templateFormat === 'xlsx' ? templateExcelSchoolQuery : ''
                }`,
                `plantilla-alumnos.${templateFormat}`
              )
            }
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
          >
            {`Plantilla estudiantes (.${templateFormat})`}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void downloadTemplate(
                `/api/v1/school/import/templates/students-to-groups.${templateFormat}${
                  templateFormat === 'xlsx' ? templateExcelSchoolQuery : ''
                }`,
                `plantilla-asignacion-grupos.${templateFormat}`
              )
            }
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
          >
            {`Plantilla asignación a grupos (.${templateFormat})`}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void downloadTemplate(
                `/api/v1/school/import/templates/groups.${templateFormat}${
                  templateFormat === 'xlsx' ? templateExcelSchoolQuery : ''
                }`,
                `plantilla-grupos.${templateFormat}`
              )
            }
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
          >
            {`Plantilla grupos (.${templateFormat})`}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void downloadTemplate(
                `/api/v1/school/import/templates/teachers.${templateFormat}${
                  templateFormat === 'xlsx' ? templateExcelSchoolQuery : ''
                }`,
                `plantilla-docentes.${templateFormat}`
              )
            }
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
          >
            {`Plantilla docentes (.${templateFormat})`}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void downloadTemplate(
                `/api/v1/school/import/templates/teacher-assignments.${templateFormat}${
                  templateFormat === 'xlsx' ? templateExcelSchoolQuery : ''
                }`,
                `plantilla-asignaciones-docentes.${templateFormat}`
              )
            }
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
          >
            {`Plantilla asignaciones docente–grupo (.${templateFormat})`}
          </button>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Recomendamos primero subir el archivo en modo de validación para detectar errores y luego confirmar la
          carga.
          {platformAdmin ? (
            <>
              {' '}
              En Excel, la parte superior incluye el nombre institucional y, si subió un logo en la configuración de
              esa escuela, la imagen en la plantilla.
            </>
          ) : null}
        </p>
      </Panel>

      <Panel
        title="Cargar información en bloque"
        description="Pasos: 1) suba el archivo, 2) revise los errores en modo de validación, 3) corrija lo necesario, 4) confirme la carga."
      >
        {!adminOrStaff ? (
          <p className="text-sm text-slate-600">
            Puede descargar las plantillas y exportaciones. La carga de información en bloque está reservada para la
            administración del plantel.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-700">
                Tipo de carga
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={importKind}
                  onChange={(e) => setImportKind(e.target.value as ImportKind)}
                >
                  <option value="students">Alumnos</option>
                  <option value="teachers">Docentes</option>
                  <option value="groups">Grupos</option>
                  <option value="teacher-assignments">Asignaciones docente-grupo-materia</option>
                  <option value="students-to-groups">Asignación de alumnos a grupos</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Archivo (.xlsx o .csv)
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
              Solo validar el archivo (no guardar cambios)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void runImport(false)}
                className="rounded bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-950 disabled:opacity-50"
              >
                {loading ? 'Procesando…' : dryRun ? 'Validar archivo' : 'Importar ahora'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void runImport(true)}
                className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
              >
                Confirmar y guardar
              </button>
            </div>
            {importResult && (
              <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-800">
                  Resultado: {importResult.totalRows} filas leídas ·{' '}
                  {'created' in importResult ? `creadas ${importResult.created ?? 0}` : `actualizadas ${importResult.updated ?? 0}`}{' '}
                  · errores {importResult.errors.length}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 max-h-52 list-disc space-y-1 overflow-auto pl-5 text-xs text-slate-700">
                    {importResult.errors.slice(0, 50).map((er, idx) => (
                      <li key={`${er.row}-${idx}`}>
                        Fila {er.row}: {er.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel
        title="Descargar información por grupo"
        description={
          platformAdmin
            ? 'Elija una escuela (opcional) y un grupo, y descargue el archivo en Excel. Si no filtra por escuela verá los grupos de todas.'
            : 'Elija un grupo y descargue el archivo en Excel. Si no ve ningún grupo, consulte con secretaría sus asignaciones.'
        }
      >
        {platformAdmin || administrativo || docente ? (
          <div className="mb-4 grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {platformAdmin && (
              <div className="min-w-0">
                <label className="block text-xs font-medium uppercase text-slate-500">Institución</label>
                <div className="mt-1">
                  <SmartSelect
                    options={schoolFilterOptions}
                    value={schoolFilter}
                    onChange={setSchoolFilter}
                    placeholder="Todas las instituciones"
                  />
                </div>
              </div>
            )}
            <div className="min-w-0">
              <label className="block text-xs font-medium uppercase text-slate-500">Grupo</label>
              <div className="mt-1">
                <SmartSelect
                  loadOptions={loadExportGroupOptions}
                  value={groupId}
                  onChange={setGroupId}
                  placeholder="— Elegir grupo —"
                  selectedLabel={exportGroupLabel || undefined}
                />
              </div>
            </div>
            <div className="min-w-0 sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-medium uppercase text-slate-500">Fecha (asistencia)</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full min-w-0 max-w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        ) : null}
        {!groupId && (platformAdmin || administrativo || docente) ? (
          <p className="mb-4 text-sm text-amber-800">
            Aún no ha elegido un grupo, o su cuenta no tiene grupos asignados. Si cree que es un error, consulte con
            secretaría.
          </p>
        ) : null}
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

      {adminOrStaff && (
        <Panel title="Cargas recientes" description="Las últimas importaciones realizadas en su escuela.">
          {history.length === 0 ? (
            <p className="text-sm text-slate-600">Aún no hay cargas recientes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2 font-semibold text-slate-700">Fecha</th>
                    <th className="px-3 py-2 font-semibold text-slate-700">Tipo</th>
                    <th className="px-3 py-2 font-semibold text-slate-700">Filas</th>
                    <th className="px-3 py-2 font-semibold text-slate-700">Procesadas</th>
                    <th className="px-3 py-2 font-semibold text-slate-700">Errores</th>
                    <th className="px-3 py-2 font-semibold text-slate-700">Modo</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{new Date(h.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-700">{h.kind}</td>
                      <td className="px-3 py-2 text-slate-700">{h.totalRows}</td>
                      <td className="px-3 py-2 text-slate-700">{h.created}</td>
                      <td className="px-3 py-2 text-slate-700">{h.errorCount}</td>
                      <td className="px-3 py-2 text-slate-700">{h.dryRun ? 'Validación' : 'Aplicado'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

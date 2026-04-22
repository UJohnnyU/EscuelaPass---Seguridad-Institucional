import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { useAuth } from '@/context/useAuth';
import { hasRole, isPlatformAdmin } from '@/lib/roles';
import { SmartSelect, type SmartSelectOption } from '@/components/SmartSelect';

type ReportCardType = 'PERIOD' | 'FINAL';
type ReportCardStatus = 'DRAFT' | 'PUBLISHED';
type PromotionStatus = 'APROBADO' | 'APROBADO_CON_PENDIENTES' | 'REPROBADO';

type ReportCardSummary = {
  id: string;
  studentId: string;
  studentName: string;
  matricula: string;
  schoolId: string;
  schoolYear: string;
  type: ReportCardType;
  periodId: string | null;
  periodName: string | null;
  groupId: string | null;
  groupName: string | null;
  overallAverage: string;
  failedSubjectsCount: number;
  promotionStatus: PromotionStatus | null;
  status: ReportCardStatus;
  publishedAt: string | null;
  generatedAt: string;
};

type ReportCardDetail = ReportCardSummary & {
  passingGrade: string;
  maxGradeScale: string;
  minFailedSubjectsToRepeat: number;
  subjects: {
    id: string;
    subjectId: string;
    subjectName: string;
    average: string;
    activityCount: number;
    gradedCount: number;
    isPassing: boolean;
  }[];
};
type SchoolOption = { id: string; name: string };
const STORAGE_BULLETINS_SCHOOL = 'ep:bulletins:schoolId';

async function downloadPdfBlob(url: string, filename: string): Promise<void> {
  const res = await api.get<Blob>(url, { responseType: 'blob' });
  const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/pdf' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function BoletinesPage() {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const platformAdmin = isPlatformAdmin(user);
  const isStudent = role === 'ALUMNO';
  const isParent = role === 'PADRE';
  const isStaff = hasRole(user, 'ADMIN', 'ADMINISTRATIVO', 'DOCENTE');

  const [rows, setRows] = useState<ReportCardSummary[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(STORAGE_BULLETINS_SCHOOL) ?? '';
  });
  const [selected, setSelected] = useState<ReportCardDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleDownloadPdf = useCallback(async (id: string, label: string) => {
    setErr(null);
    setDownloadingId(id);
    try {
      await downloadPdfBlob(
        `/api/v1/documents/bulletin/${id}`,
        `boletin-${label.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`
      );
    } catch (e) {
      setErr(getUserFacingMessage(e, 'No se pudo descargar el boletín en PDF.'));
    } finally {
      setDownloadingId(null);
    }
  }, []);

  useEffect(() => {
    if (!platformAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<SchoolOption[]>('/api/v1/schools');
        const rows = Array.isArray(data) ? data : [];
        if (!cancelled) {
          setSchools(rows);
          if (rows.length > 0) {
            setSelectedSchoolId((prev) =>
              prev && rows.some((s) => s.id === prev) ? prev : rows[0].id
            );
          }
        }
      } catch {
        if (!cancelled) setSchools([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformAdmin]);

  useEffect(() => {
    if (!platformAdmin || typeof window === 'undefined') return;
    if (!selectedSchoolId) return;
    sessionStorage.setItem(STORAGE_BULLETINS_SCHOOL, selectedSchoolId);
  }, [platformAdmin, selectedSchoolId]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      let endpoint = '/api/v1/report-cards';
      if (isStudent) endpoint = '/api/v1/report-cards/student/me';
      else if (isParent) endpoint = '/api/v1/report-cards/parent/my-children';
      const params: Record<string, string> = {};
      if (platformAdmin && selectedSchoolId) params.schoolId = selectedSchoolId;
      const { data } = await api.get<ReportCardSummary[]>(endpoint, { params });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(getUserFacingMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [isParent, isStudent, platformAdmin, selectedSchoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: string) => {
    setLoadingDetail(true);
    setErr(null);
    try {
      const { data } = await api.get<ReportCardDetail>(`/api/v1/report-cards/${id}`);
      setSelected(data);
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setLoadingDetail(false);
    }
  };

  const groupedByYear = useMemo(() => {
    const map = new Map<string, ReportCardSummary[]>();
    for (const r of rows) {
      if (!map.has(r.schoolYear)) map.set(r.schoolYear, []);
      map.get(r.schoolYear)!.push(r);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows]);

  if (selected) {
    return (
      <ReportCardDetailView
        detail={selected}
        onBack={() => setSelected(null)}
        loading={loadingDetail}
        err={err}
        downloading={downloadingId === selected.id}
        canDownload={selected.status === 'PUBLISHED' || isStaff}
        onDownload={() =>
          void handleDownloadPdf(
            selected.id,
            `${selected.studentName || 'estudiante'}-${selected.periodName ?? selected.type}-${selected.schoolYear}`
          )
        }
      />
    );
  }

  return (
    <div className="max-w-5xl animate-fade-in space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Boletines</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          Cada vez que la escuela cierra un periodo, su boletín queda disponible aquí para descargarlo. El boletín
          final aparece cuando se cierran todos los periodos del año escolar.
        </p>
      </div>

      {err && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>}

      {platformAdmin && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Institución</span>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
            >
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      {isStaff && <BulkDownloadPanel rows={rows} onError={setErr} schoolId={platformAdmin ? selectedSchoolId : ''} />}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando boletines…</p>
      ) : rows.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
          No hay boletines disponibles todavía.
        </div>
      ) : (
        groupedByYear.map(([year, items]) => (
          <section key={year} className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">
              Ciclo {year}
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">
                        {r.type === 'FINAL' ? 'Boletín final' : r.periodName ?? 'Periodo'}
                      </p>
                      <TypeBadge type={r.type} />
                      {r.promotionStatus && <PromotionBadge status={r.promotionStatus} />}
                      {r.status === 'DRAFT' && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                          Borrador
                        </span>
                      )}
                    </div>
                    {(platformAdmin || role === 'ADMIN' || role === 'ADMINISTRATIVO' || role === 'DOCENTE') && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {r.studentName || '—'} {r.matricula ? `(${r.matricula})` : ''}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-500">
                      Promedio general: <strong>{parseFloat(r.overallAverage)}</strong> · Reprobadas:{' '}
                      {r.failedSubjectsCount}
                      {r.publishedAt
                        ? ` · Publicado ${new Date(r.publishedAt).toLocaleDateString('es')}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void openDetail(r.id)}
                      className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                    >
                      Ver detalle
                    </button>
                    {(r.status === 'PUBLISHED' || isStaff) && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleDownloadPdf(
                            r.id,
                            `${r.studentName || 'estudiante'}-${r.periodName ?? r.type}-${r.schoolYear}`
                          )
                        }
                        disabled={downloadingId === r.id}
                        className="inline-flex items-center gap-1.5 rounded bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-3.5 w-3.5"
                          aria-hidden
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        {downloadingId === r.id ? 'Descargando…' : 'Descargar PDF'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function ReportCardDetailView({
  detail,
  onBack,
  loading,
  err,
  canDownload,
  downloading,
  onDownload
}: {
  detail: ReportCardDetail;
  onBack: () => void;
  loading: boolean;
  err: string | null;
  canDownload: boolean;
  downloading: boolean;
  onDownload: () => void;
}) {
  const passingGrade = Number(detail.passingGrade);
  const scale = Number(detail.maxGradeScale);

  return (
    <div className="max-w-4xl animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Volver a boletines
        </button>
        {canDownload && (
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 rounded bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {downloading ? 'Descargando…' : 'Descargar PDF'}
          </button>
        )}
      </div>

      {err && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>}
      {loading && <p className="text-sm text-slate-500">Cargando…</p>}

      <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 p-5">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-slate-900">
              {detail.type === 'FINAL' ? 'Boletín final' : detail.periodName ?? 'Boletín de periodo'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {detail.studentName || '—'} {detail.matricula && `· ${detail.matricula}`}
            </p>
            <p className="mt-1 text-xs text-slate-500">Ciclo {detail.schoolYear}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">Promedio general</p>
            <p className="text-3xl font-semibold text-slate-900">{parseFloat(detail.overallAverage)}</p>
            <p className="text-xs text-slate-500">de {scale.toFixed(2)}</p>
            {detail.promotionStatus && (
              <div className="mt-2 flex justify-end">
                <PromotionBadge status={detail.promotionStatus} />
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-2 border-b border-slate-100 bg-white px-5 py-3 text-xs text-slate-600 sm:grid-cols-3">
          <div>
            Nota mínima aprobatoria: <span className="font-medium text-slate-800">{passingGrade.toFixed(2)}</span>
          </div>
          <div>
            Materias reprobadas: <span className="font-medium text-slate-800">{detail.failedSubjectsCount}</span>
          </div>
          {detail.type === 'FINAL' && (
            <div>
              Mínimo para reprobar el año:{' '}
              <span className="font-medium text-slate-800">{detail.minFailedSubjectsToRepeat} materias</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white">
                <th className="px-3 py-2 font-semibold text-slate-700">Asignatura</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Promedio</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Actividades</th>
                <th className="px-3 py-2 font-semibold text-slate-700">Estado</th>
              </tr>
            </thead>
            <tbody>
              {detail.subjects.map((s) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-900">{s.subjectName}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">{parseFloat(s.average)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {s.gradedCount} / {s.activityCount}
                  </td>
                  <td className="px-3 py-2">
                    {s.isPassing ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                        Aprobada
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800">
                        Reprobada
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {detail.subjects.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">
                    Sin registro de materias.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-[11px] text-slate-500">
          Generado el {new Date(detail.generatedAt).toLocaleString('es')}
          {detail.publishedAt ? ` · Publicado ${new Date(detail.publishedAt).toLocaleString('es')}` : ''}
        </div>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: ReportCardType }) {
  if (type === 'FINAL') {
    return (
      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-900">Final</span>
    );
  }
  return (
    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">Periodo</span>
  );
}

function PromotionBadge({ status }: { status: PromotionStatus }) {
  if (status === 'APROBADO')
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
        Aprobado
      </span>
    );
  if (status === 'REPROBADO')
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800">Reprobado</span>
    );
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
      Aprobado con pendientes
    </span>
  );
}

function BulkDownloadPanel({
  rows,
  onError,
  schoolId
}: {
  rows: ReportCardSummary[];
  onError: (msg: string | null) => void;
  schoolId?: string;
}) {
  const [scope, setScope] = useState<'STUDENT' | 'GROUP' | 'ALL'>('ALL');
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [periodId, setPeriodId] = useState<string>('');
  const [type, setType] = useState<'PERIOD' | 'FINAL' | ''>('');
  const [studentId, setStudentId] = useState<string>('');
  const [groupId, setGroupId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (schoolYear && r.schoolYear !== schoolYear) return false;
      if (periodId && r.periodId !== periodId) return false;
      if (type && r.type !== type) return false;
      return true;
    });
  }, [rows, schoolYear, periodId, type]);

  const publishedCount = useMemo(() => {
    return filteredRows.filter((r) => {
      if (r.status !== 'PUBLISHED') return false;
      if (scope === 'STUDENT' && studentId && r.studentId !== studentId) return false;
      if (scope === 'GROUP' && groupId && r.groupId !== groupId) return false;
      return true;
    }).length;
  }, [filteredRows, scope, studentId, groupId]);

  const [allPeriods, setAllPeriods] = useState<
    Array<{ id: string; schoolYear: string; name: string }>
  >([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<Array<{ id: string; schoolYear: string; name: string }>>(
          '/api/v1/academic-periods'
        );
        if (!cancelled) setAllPeriods(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setAllPeriods([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const yearOptions = useMemo<SmartSelectOption[]>(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.schoolYear) set.add(r.schoolYear);
    for (const p of allPeriods) if (p.schoolYear) set.add(p.schoolYear);
    return [
      { value: '', label: 'Todos los años' },
      ...[...set].sort().reverse().map((y) => ({ value: y, label: `Ciclo ${y}` }))
    ];
  }, [rows, allPeriods]);

  const periodOptions = useMemo<SmartSelectOption[]>(() => {
    const map = new Map<string, string>();
    for (const p of allPeriods) {
      if (schoolYear && p.schoolYear !== schoolYear) continue;
      if (!map.has(p.id)) {
        map.set(p.id, `${p.name}${p.schoolYear ? ` · ${p.schoolYear}` : ''}`);
      }
    }
    for (const r of rows) {
      if (schoolYear && r.schoolYear !== schoolYear) continue;
      if (r.periodId && r.periodName && !map.has(r.periodId)) {
        map.set(r.periodId, `${r.periodName}${r.schoolYear ? ` · ${r.schoolYear}` : ''}`);
      }
    }
    return [
      { value: '', label: 'Todos los periodos' },
      ...[...map.entries()].map(([value, label]) => ({ value, label }))
    ];
  }, [rows, allPeriods, schoolYear]);

  const studentOptions = useMemo<SmartSelectOption[]>(() => {
    const map = new Map<string, { name: string; matricula: string }>();
    for (const r of rows) {
      if (!map.has(r.studentId)) {
        map.set(r.studentId, { name: r.studentName, matricula: r.matricula });
      }
    }
    return [...map.entries()]
      .map(([value, info]) => ({
        value,
        label: `${info.name}${info.matricula ? ` (${info.matricula})` : ''}`,
        searchText: info.matricula
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [rows]);

  const groupOptions = useMemo<SmartSelectOption[]>(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.groupId && r.groupName && !map.has(r.groupId)) {
        map.set(r.groupId, r.groupName);
      }
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [rows]);

  const handleDownload = async () => {
    onError(null);
    setInfo(null);
    setBusy(true);
    try {
      const params: Record<string, string> = {};
      if (schoolYear) params.schoolYear = schoolYear;
      if (schoolId) params.schoolId = schoolId;
      if (periodId) params.periodId = periodId;
      if (type) params.type = type;
      if (scope === 'STUDENT') {
        if (!studentId) throw new Error('Seleccione un alumno.');
        params.studentId = studentId;
      } else if (scope === 'GROUP') {
        if (!groupId) throw new Error('Seleccione un grupo.');
        params.groupId = groupId;
      }
      const res = await api.get<Blob>('/api/v1/documents/bulletins/bulk', {
        params,
        responseType: 'blob'
      });
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/pdf' });
      const count = Number(res.headers['x-bulletin-count'] ?? '0') || 0;
      const fileLabel =
        scope === 'STUDENT'
          ? 'alumno'
          : scope === 'GROUP'
            ? 'grupo'
            : 'plantel';
      const filenameParts = ['boletines', fileLabel];
      if (type) filenameParts.push(type === 'FINAL' ? 'finales' : 'periodo');
      if (schoolYear) filenameParts.push(schoolYear);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filenameParts.join('-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setInfo(`Se descargaron ${count} boletín${count === 1 ? '' : 'es'} en un solo PDF.`);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : getUserFacingMessage(e, 'No se pudo generar la descarga.');
      onError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-slate-900">Descarga masiva</h2>
          <p className="mt-1 text-sm text-slate-600">
            Descargue los boletines publicados de un alumno, un grupo o de toda la escuela. Se entrega un único PDF
            con un boletín por página.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className="text-slate-700">Alcance</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as 'STUDENT' | 'GROUP' | 'ALL')}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ALL">Todos los alumnos</option>
            <option value="GROUP">Un grupo</option>
            <option value="STUDENT">Un alumno</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Año escolar</span>
          <div className="mt-1">
            <SmartSelect options={yearOptions} value={schoolYear} onChange={setSchoolYear} />
          </div>
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Periodo</span>
          <div className="mt-1">
            <SmartSelect options={periodOptions} value={periodId} onChange={setPeriodId} />
          </div>
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Tipo</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'PERIOD' | 'FINAL' | '')}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Periodo y final</option>
            <option value="PERIOD">Solo de periodo</option>
            <option value="FINAL">Solo finales</option>
          </select>
        </label>

        {scope === 'STUDENT' && (
          <label className="block text-sm sm:col-span-2 lg:col-span-2">
            <span className="text-slate-700">Alumno</span>
            <div className="mt-1">
              <SmartSelect
                options={studentOptions}
                value={studentId}
                onChange={setStudentId}
                placeholder="— Buscar alumno —"
                emptyLabel="No hay alumnos en los boletines listados"
              />
            </div>
          </label>
        )}
        {scope === 'GROUP' && (
          <label className="block text-sm sm:col-span-2 lg:col-span-2">
            <span className="text-slate-700">Grupo</span>
            <div className="mt-1">
              <SmartSelect
                options={groupOptions}
                value={groupId}
                onChange={setGroupId}
                placeholder="— Buscar grupo —"
                emptyLabel="No hay grupos en los boletines listados"
              />
            </div>
          </label>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {publishedCount > 0
          ? `Se incluirán ${publishedCount} boletín${publishedCount === 1 ? '' : 'es'} publicados con los filtros actuales.`
          : 'No hay boletines publicados que coincidan con los filtros seleccionados.'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={busy || publishedCount === 0}
          className="inline-flex items-center gap-2 rounded bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {busy ? 'Generando…' : 'Descargar boletines en PDF'}
        </button>
        {info && <p className="text-sm text-emerald-700">{info}</p>}
      </div>
    </section>
  );
}

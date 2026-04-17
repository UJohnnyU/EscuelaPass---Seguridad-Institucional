import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { useAuth } from '@/context/useAuth';
import { isPlatformAdmin } from '@/lib/roles';

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

export function BoletinesPage() {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const platformAdmin = isPlatformAdmin(user);
  const isStudent = role === 'ALUMNO';
  const isParent = role === 'PADRE';

  const [rows, setRows] = useState<ReportCardSummary[]>([]);
  const [selected, setSelected] = useState<ReportCardDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      let endpoint = '/api/v1/report-cards';
      if (isStudent) endpoint = '/api/v1/report-cards/student/me';
      else if (isParent) endpoint = '/api/v1/report-cards/parent/my-children';
      const { data } = await api.get<ReportCardSummary[]>(endpoint);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(getUserFacingMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [isParent, isStudent]);

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
      />
    );
  }

  return (
    <div className="max-w-5xl animate-fade-in space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Boletines</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          Los boletines de periodo se publican automáticamente al cerrarse cada periodo académico. El boletín final
          se publica cuando todos los periodos del ciclo están cerrados.
        </p>
      </div>

      {err && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>}

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
                  <button
                    type="button"
                    onClick={() => void openDetail(r.id)}
                    className="rounded border border-brand-800 bg-white px-3 py-1.5 text-xs font-medium text-brand-900 hover:bg-slate-50"
                  >
                    Ver detalle
                  </button>
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
  err
}: {
  detail: ReportCardDetail;
  onBack: () => void;
  loading: boolean;
  err: string | null;
}) {
  const passingGrade = Number(detail.passingGrade);
  const scale = Number(detail.maxGradeScale);

  return (
    <div className="max-w-4xl animate-fade-in space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        ← Volver a boletines
      </button>

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

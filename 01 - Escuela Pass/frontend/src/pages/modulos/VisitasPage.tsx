import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { DetailModal } from '@/components/DetailModal';
import { DATA_TABLE_SEARCH_INPUT, SCROLLABLE_PANEL_BODY } from '@/components/DataTableScroll';
import { type SmartSelectOption, SmartSelect } from '@/components/SmartSelect';
import { useAuth } from '@/context/useAuth';
import { hasRole, isStaff } from '@/lib/roles';

type AudienceScope = 'SCHOOL' | 'GROUPS' | 'STUDENTS';
type VisitStatus = 'PROGRAMADA' | 'REPROGRAMADA' | 'REALIZADA' | 'CANCELADA';

type VisitRow = {
  id: string;
  title: string;
  purpose: string;
  visitorName: string;
  visitorOrganization: string | null;
  location: string | null;
  visitDatetime: string;
  durationMinutes: number;
  audienceScope: AudienceScope;
  status: VisitStatus;
  createdByUserId: string;
  cancellationReason: string | null;
  previousDatetime: string | null;
  groupIds: string[];
  studentIds: string[];
  schoolId: string;
  createdAt: string;
};

type GroupRow = { id: string; name: string; grade: string | null; schoolYear: string };
type StudentRow = { id: string; matricula: string; fullName: string };
type SchoolOption = { id: string; name: string };
const STORAGE_VISITS_SCHOOL = 'ep:visits:schoolId';

function formatDateLong(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-MX', {
      dateStyle: 'long',
      timeStyle: 'short'
    });
  } catch {
    return iso;
  }
}

function toLocalInputValue(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

function nowLocalInputValue(): string {
  return toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000).toISOString());
}

function statusBadgeClass(status: VisitStatus): string {
  switch (status) {
    case 'PROGRAMADA':
      return 'bg-sky-100 text-sky-900 border-sky-200';
    case 'REPROGRAMADA':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'REALIZADA':
      return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    case 'CANCELADA':
      return 'bg-rose-100 text-rose-900 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}

export function VisitasPage() {
  const { user } = useAuth();
  const staff = hasRole(user, 'ADMIN', 'ADMINISTRATIVO', 'DOCENTE');
  const canCreate = isStaff(user);
  const docenteOnly = user?.role === 'DOCENTE';
  const platformAdmin = user?.role === 'ADMIN';

  const [tab, setTab] = useState<'upcoming' | 'past' | 'organized'>('upcoming');
  const [listSearch, setListSearch] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mine, setMine] = useState<VisitRow[]>([]);
  const [organized, setOrganized] = useState<VisitRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VisitRow | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [groupNameMap, setGroupNameMap] = useState<Record<string, string>>({});
  const [studentNameMap, setStudentNameMap] = useState<Record<string, string>>({});
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(STORAGE_VISITS_SCHOOL) ?? '';
  });
  const selectedSchoolName = useMemo(
    () => schools.find((s) => s.id === selectedSchoolId)?.name ?? '',
    [schools, selectedSchoolId]
  );

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
    sessionStorage.setItem(STORAGE_VISITS_SCHOOL, selectedSchoolId);
  }, [platformAdmin, selectedSchoolId]);

  const loadLists = useCallback(async () => {
    setErr(null);
    try {
      const mineRes = await api.get<VisitRow[]>('/api/v1/external-visits/me');
      setMine(Array.isArray(mineRes.data) ? mineRes.data : []);
      if (staff) {
        const params: Record<string, string> = {};
        if (platformAdmin && selectedSchoolId) params.schoolId = selectedSchoolId;
        const orgRes = await api.get<VisitRow[]>('/api/v1/external-visits', { params });
        setOrganized(Array.isArray(orgRes.data) ? orgRes.data : []);
      } else {
        setOrganized([]);
      }
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  }, [staff, platformAdmin, selectedSchoolId]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    setListSearch('');
  }, [tab]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailErr(null);
      try {
        const res = await api.get<VisitRow>(`/api/v1/external-visits/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (e) {
        if (!cancelled) setDetailErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: VisitRow[] = [];
    const pa: VisitRow[] = [];
    for (const v of mine) {
      const t = new Date(v.visitDatetime).getTime();
      if (v.status === 'CANCELADA' || v.status === 'REALIZADA' || t < now) {
        pa.push(v);
      } else {
        up.push(v);
      }
    }
    up.sort((a, b) => new Date(a.visitDatetime).getTime() - new Date(b.visitDatetime).getTime());
    pa.sort((a, b) => new Date(b.visitDatetime).getTime() - new Date(a.visitDatetime).getTime());
    return { upcoming: up, past: pa };
  }, [mine]);

  const list = tab === 'upcoming' ? upcoming : tab === 'past' ? past : organized;
  const filteredList = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((v) => {
      const blob = [
        v.title,
        v.purpose,
        v.visitorName,
        v.visitorOrganization,
        v.location,
        v.status,
        formatDateLong(v.visitDatetime),
        v.audienceScope
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [list, listSearch]);
  const allVisits = useMemo(() => {
    const byId = new Map<string, VisitRow>();
    [...mine, ...organized].forEach((v) => byId.set(v.id, v));
    return Array.from(byId.values());
  }, [mine, organized]);
  const selectedVisit = selectedId ? allVisits.find((v) => v.id === selectedId) ?? null : null;
  const currentDetail = selectedVisit
    ? detail && detail.id === selectedVisit.id
      ? detail
      : selectedVisit
    : null;
  const canModifyCurrent = !!currentDetail && staff && (currentDetail.createdByUserId === user?.id || user?.role === 'ADMIN');
  const currentGroupNames = useMemo(() => {
    if (!currentDetail?.groupIds?.length) return [];
    return currentDetail.groupIds.map((id) => groupNameMap[id] ?? id);
  }, [currentDetail?.groupIds, groupNameMap]);
  const currentStudentNames = useMemo(() => {
    if (!currentDetail?.studentIds?.length) return [];
    return currentDetail.studentIds.map((id) => studentNameMap[id] ?? id);
  }, [currentDetail?.studentIds, studentNameMap]);

  useEffect(() => {
    if (!currentDetail) return;
    const needGroups = currentDetail.groupIds.some((id) => !groupNameMap[id]);
    const needStudents = currentDetail.studentIds.some((id) => !studentNameMap[id]);
    if (!needGroups && !needStudents) return;
    let cancelled = false;
    (async () => {
      try {
        const calls: Promise<unknown>[] = [];
        if (needGroups) calls.push(api.get<GroupRow[]>('/api/v1/school/groups', { params: { limit: 300 } }));
        if (needStudents) calls.push(api.get<StudentRow[]>('/api/v1/school/students', { params: { limit: 300 } }));
        const results = await Promise.all(calls);
        if (cancelled) return;
        for (const res of results) {
          const data = (res as { data: unknown }).data;
          if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] && 'matricula' in (data[0] as object)) {
            const rows = data as StudentRow[];
            setStudentNameMap((prev) => {
              const next = { ...prev };
              rows.forEach((s) => {
                next[s.id] = `${s.fullName} (${s.matricula})`;
              });
              return next;
            });
          } else if (Array.isArray(data)) {
            const rows = data as GroupRow[];
            setGroupNameMap((prev) => {
              const next = { ...prev };
              rows.forEach((g) => {
                next[g.id] = `${g.name}${g.grade ? ` · ${g.grade}` : ''} · ${g.schoolYear}`;
              });
              return next;
            });
          }
        }
      } catch {
        // si falla, dejamos fallback con IDs
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentDetail, groupNameMap, studentNameMap]);

  const reloadAll = async () => {
    await loadLists();
    if (selectedId) {
      try {
        const res = await api.get<VisitRow>(`/api/v1/external-visits/${selectedId}`);
        setDetail(res.data);
      } catch {
        /* noop */
      }
    }
  };

  const actionCancel = async (id: string) => {
    const reason = window.prompt('Motivo de cancelación (opcional)', '') ?? undefined;
    try {
      await api.post(`/api/v1/external-visits/${id}/cancel`, { reason });
      setMsg('Visita cancelada.');
      await reloadAll();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  };

  const actionReschedule = async (id: string) => {
    const current = organized.find((x) => x.id === id) ?? mine.find((x) => x.id === id);
    const hint = current ? toLocalInputValue(current.visitDatetime) : '';
    const next = window.prompt('Nueva fecha y hora (YYYY-MM-DDTHH:MM)', hint);
    if (!next) return;
    try {
      await api.post(`/api/v1/external-visits/${id}/reschedule`, {
        visitDatetime: new Date(next).toISOString()
      });
      setMsg('Visita reprogramada.');
      await reloadAll();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  };

  const actionRealized = async (id: string) => {
    try {
      await api.post(`/api/v1/external-visits/${id}/realized`, {});
      setMsg('Visita marcada como realizada.');
      await reloadAll();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  };

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Visitas externas</h1>
        <p className="mt-1 text-sm text-slate-600">
          Visitas que organiza la escuela. Le avisaremos un día antes y una hora antes para que no se le pase.
        </p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      {msg && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {msg}
        </div>
      )}

      {platformAdmin && (
        <div className="rounded border border-slate-200 bg-white p-4">
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
        </div>
      )}
      {canCreate && (
        <CreateVisitPanel
          onCreated={reloadAll}
          docenteOnly={docenteOnly}
          schoolId={platformAdmin ? selectedSchoolId : undefined}
          requireSchoolSelection={platformAdmin}
          targetSchoolName={platformAdmin ? selectedSchoolName : undefined}
        />
      )}

      <div className="rounded border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 pt-3">
          <TabButton active={tab === 'upcoming'} onClick={() => setTab('upcoming')}>
            Próximas ({upcoming.length})
          </TabButton>
          <TabButton active={tab === 'past'} onClick={() => setTab('past')}>
            Pasadas ({past.length})
          </TabButton>
          {staff && (
            <TabButton active={tab === 'organized'} onClick={() => setTab('organized')}>
              Organizadas por la escuela ({organized.length})
            </TabButton>
          )}
        </div>
        <div className="p-4">
          {list.length === 0 ? (
            <p className="text-sm text-slate-600">No hay visitas en esta vista.</p>
          ) : (
            <>
              <label className="mb-3 block max-w-md text-sm text-slate-700">
                <span className="font-medium">Buscar en esta vista</span>
                <input
                  type="search"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Título, visitante, lugar, estado…"
                  className={`mt-1 ${DATA_TABLE_SEARCH_INPUT}`}
                />
              </label>
              {filteredList.length === 0 ? (
                <p className="text-sm text-slate-600">Ninguna visita coincide con la búsqueda.</p>
              ) : (
                <div className={`${SCROLLABLE_PANEL_BODY} pr-1`}>
                  <ul className="space-y-3">
                    {filteredList.map((v) => (
                      <li
                        key={v.id}
                        className="rounded border border-slate-200 bg-slate-50 p-3 transition hover:bg-white"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedId(v.id)}
                          className="flex w-full flex-col gap-1 text-left"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900">{v.title}</span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(v.status)}`}
                            >
                              {v.status}
                            </span>
                          </div>
                          <span className="text-sm text-slate-700">{formatDateLong(v.visitDatetime)}</span>
                          <span className="text-xs text-slate-500">
                            Visitante: {v.visitorName}
                            {v.visitorOrganization ? ` · ${v.visitorOrganization}` : ''}
                            {v.location ? ` · ${v.location}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <DetailModal
        open={!!currentDetail}
        title={currentDetail?.title ?? 'Detalle de visita'}
        subtitle={currentDetail ? formatDateLong(currentDetail.visitDatetime) : ''}
        badge={
          currentDetail ? (
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(currentDetail.status)}`}>
              {currentDetail.status}
            </span>
          ) : null
        }
        onClose={() => setSelectedId(null)}
        footer={
          currentDetail ? (
            <VisitActions
              detail={currentDetail}
              canModify={canModifyCurrent}
              onCancel={() => actionCancel(currentDetail.id)}
              onReschedule={() => actionReschedule(currentDetail.id)}
              onRealized={() => actionRealized(currentDetail.id)}
            />
          ) : null
        }
      >
        {currentDetail ? (
          <VisitDetailView
            detail={currentDetail}
            detailErr={detailErr}
            groupNames={currentGroupNames}
            studentNames={currentStudentNames}
          />
        ) : null}
      </DetailModal>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t border-b-2 px-3 py-2 text-sm font-medium ${
        active
          ? 'border-brand-800 text-brand-900'
          : 'border-transparent text-slate-600 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

function VisitDetailView({
  detail,
  detailErr,
  groupNames,
  studentNames
}: {
  detail: VisitRow;
  detailErr: string | null;
  groupNames?: string[];
  studentNames?: string[];
}) {
  return (
    <div className="space-y-3 text-sm">
      {detailErr && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-900">{detailErr}</div>
      )}
      <p className="text-slate-700">
        <span className="font-medium text-slate-900">Propósito:</span> {detail.purpose}
      </p>
      <div className="grid grid-cols-1 gap-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2">
        <p className="text-slate-700">
          <span className="font-medium text-slate-900">Fecha y hora:</span> {formatDateLong(detail.visitDatetime)}
        </p>
        <p className="text-slate-700">
          <span className="font-medium text-slate-900">Duración:</span> {detail.durationMinutes} min
        </p>
        <p className="text-slate-700">
          <span className="font-medium text-slate-900">Visitante:</span> {detail.visitorName}
        </p>
        <p className="text-slate-700">
          <span className="font-medium text-slate-900">Organización:</span> {detail.visitorOrganization ?? 'No especificada'}
        </p>
        <p className="text-slate-700 sm:col-span-2">
          <span className="font-medium text-slate-900">Lugar:</span> {detail.location ?? 'No especificado'}
        </p>
        <p className="text-slate-700 sm:col-span-2">
          <span className="font-medium text-slate-900">Registrada:</span> {formatDateLong(detail.createdAt)}
        </p>
      </div>
      <p className="text-slate-700">
        <span className="font-medium text-slate-900">Alcance:</span> {detail.audienceScope}
        {detail.audienceScope === 'GROUPS' ? ` · ${detail.groupIds.length} grupo(s)` : ''}
        {detail.audienceScope === 'STUDENTS' ? ` · ${detail.studentIds.length} estudiante(s)` : ''}
      </p>
      {detail.audienceScope === 'GROUPS' && detail.groupIds.length > 0 ? (
        <p className="text-slate-700">
          <span className="font-medium text-slate-900">Grupos:</span> {(groupNames && groupNames.length > 0 ? groupNames : detail.groupIds).join(', ')}
        </p>
      ) : null}
      {detail.audienceScope === 'STUDENTS' && detail.studentIds.length > 0 ? (
        <p className="text-slate-700">
          <span className="font-medium text-slate-900">Estudiantes:</span> {(studentNames && studentNames.length > 0 ? studentNames : detail.studentIds).join(', ')}
        </p>
      ) : null}
      {detail.previousDatetime ? (
        <p className="text-slate-700">
          <span className="font-medium text-slate-900">Fecha anterior:</span> {formatDateLong(detail.previousDatetime)}
        </p>
      ) : null}
      {detail.cancellationReason && (
        <p className="text-slate-700">
          <span className="font-medium text-slate-900">Motivo de cancelación:</span>{' '}
          {detail.cancellationReason}
        </p>
      )}
    </div>
  );
}

function VisitActions({
  detail,
  canModify,
  onCancel,
  onReschedule,
  onRealized
}: {
  detail: VisitRow;
  canModify: boolean;
  onCancel: () => void;
  onReschedule: () => void;
  onRealized: () => void;
}) {
  const canAct = detail.status !== 'CANCELADA' && detail.status !== 'REALIZADA';
  if (!canModify || !canAct) return null;
  return (
    <>
      <button type="button" onClick={onReschedule} className="rounded border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100">Reprogramar</button>
      <button type="button" onClick={onRealized} className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100">Marcar realizada</button>
      <button type="button" onClick={onCancel} className="rounded border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-900 hover:bg-rose-100">Cancelar visita</button>
    </>
  );
}

function CreateVisitPanel({
  onCreated,
  docenteOnly,
  schoolId,
  requireSchoolSelection,
  targetSchoolName
}: {
  onCreated: () => Promise<void> | void;
  docenteOnly: boolean;
  schoolId?: string;
  requireSchoolSelection?: boolean;
  targetSchoolName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [visitorOrg, setVisitorOrg] = useState('');
  const [location, setLocation] = useState('');
  const [visitDatetime, setVisitDatetime] = useState(nowLocalInputValue());
  const [duration, setDuration] = useState('60');
  const [scope, setScope] = useState<AudienceScope>(docenteOnly ? 'GROUPS' : 'SCHOOL');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [currentGroupPick, setCurrentGroupPick] = useState('');
  const [currentStudentPick, setCurrentStudentPick] = useState('');

  const loadGroups = useCallback(async (q: string, signal: AbortSignal) => {
    const endpoint = docenteOnly
      ? '/api/v1/schedules/me/teacher/groups'
      : '/api/v1/school/groups';
    const params: Record<string, string | number | undefined> = { q: q.trim() || undefined, limit: 80 };
    if (!docenteOnly && schoolId) params.schoolId = schoolId;
    const { data } = await api.get<GroupRow[]>(endpoint, {
      params,
      signal
    });
    const rows = Array.isArray(data) ? data : [];
    return rows.map(
      (g): SmartSelectOption => ({
        value: g.id,
        label: `${g.name}${g.grade ? ` · ${g.grade}` : ''} · ${g.schoolYear}`
      })
    );
  }, [docenteOnly, schoolId]);

  const loadStudents = useCallback(async (q: string, signal: AbortSignal) => {
    const params: Record<string, string | number | undefined> = { q: q.trim() || undefined, limit: 80 };
    if (schoolId) params.schoolId = schoolId;
    const { data } = await api.get<StudentRow[]>('/api/v1/school/students', {
      params,
      signal
    });
    const rows = Array.isArray(data) ? data : [];
    return rows.map(
      (s): SmartSelectOption => ({
        value: s.id,
        label: `${s.fullName} (${s.matricula})`,
        searchText: s.matricula
      })
    );
  }, [schoolId]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (requireSchoolSelection && !schoolId) {
      setErr('Seleccione primero la institución para crear la visita.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        purpose: purpose.trim(),
        visitorName: visitorName.trim(),
        visitorOrganization: visitorOrg.trim() || undefined,
        location: location.trim() || undefined,
        visitDatetime: new Date(visitDatetime).toISOString(),
        durationMinutes: Number(duration) || 60,
        audienceScope: scope
      };
      if (scope === 'GROUPS') payload.groupIds = groupIds;
      if (scope === 'STUDENTS') payload.studentIds = studentIds;
      const params: Record<string, string> = {};
      if (schoolId) params.schoolId = schoolId;
      await api.post('/api/v1/external-visits', payload, { params });
      setTitle('');
      setPurpose('');
      setVisitorName('');
      setVisitorOrg('');
      setLocation('');
      setVisitDatetime(nowLocalInputValue());
      setDuration('60');
      setGroupIds([]);
      setStudentIds([]);
      setOpen(false);
      await onCreated();
    } catch (e2) {
      setErr(getUserFacingMessage(e2, 'No se pudo crear la visita.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-slate-900">
          {open ? 'Cerrar formulario' : 'Crear nueva visita'}
        </span>
        <span className="text-xs text-slate-600">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <form onSubmit={onSubmit} className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2">
          {err && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 sm:col-span-2">
              {err}
            </div>
          )}
          {requireSchoolSelection && targetSchoolName ? (
            <div className="rounded border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900 sm:col-span-2 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-100">
              <span className="font-medium">Institución destino:</span>{' '}
              <span className="font-semibold">{targetSchoolName}</span>
            </div>
          ) : null}
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-700">Título</span>
            <input
              required
              maxLength={150}
              minLength={3}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-700">Propósito</span>
            <textarea
              required
              minLength={3}
              rows={3}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Nombre del visitante</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Organización (opcional)</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={visitorOrg}
              onChange={(e) => setVisitorOrg(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Lugar (opcional)</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Auditorio, Sala 3…"
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Fecha y hora</span>
            <input
              type="datetime-local"
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={visitDatetime}
              onChange={(e) => setVisitDatetime(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Duración (minutos)</span>
            <input
              type="number"
              min={5}
              max={600}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Alcance</span>
            <select
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={scope}
              onChange={(e) => setScope(e.target.value as AudienceScope)}
            >
              {!docenteOnly && <option value="SCHOOL">Toda la escuela</option>}
              <option value="GROUPS">Grupos específicos</option>
              <option value="STUDENTS">Estudiantes específicos</option>
            </select>
          </label>
          {scope === 'GROUPS' && (
            <div className="text-sm sm:col-span-2">
              <span className="text-slate-700">Grupos</span>
              <div className="mt-1 flex gap-2">
                <div className="flex-1">
                  <SmartSelect
                    loadOptions={loadGroups}
                    value={currentGroupPick}
                    onChange={(v) => {
                      if (v && !groupIds.includes(v)) setGroupIds([...groupIds, v]);
                      setCurrentGroupPick('');
                    }}
                    placeholder="— Buscar grupo —"
                  />
                </div>
              </div>
              <div className={`mt-2 ${SCROLLABLE_PANEL_BODY}`}>
                <ul className="flex flex-wrap gap-2 py-0.5">
                  {groupIds.map((id) => (
                    <li
                      key={id}
                      className="flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs"
                    >
                      {id.slice(0, 8)}…
                      <button
                        type="button"
                        onClick={() => setGroupIds(groupIds.filter((x) => x !== id))}
                        className="text-slate-500 hover:text-slate-800"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {scope === 'STUDENTS' && (
            <div className="text-sm sm:col-span-2">
              <span className="text-slate-700">Estudiantes</span>
              <div className="mt-1 flex gap-2">
                <div className="flex-1">
                  <SmartSelect
                    loadOptions={loadStudents}
                    value={currentStudentPick}
                    onChange={(v) => {
                      if (v && !studentIds.includes(v)) setStudentIds([...studentIds, v]);
                      setCurrentStudentPick('');
                    }}
                    placeholder="— Buscar estudiante —"
                  />
                </div>
              </div>
              <div className={`mt-2 ${SCROLLABLE_PANEL_BODY}`}>
                <ul className="flex flex-wrap gap-2 py-0.5">
                  {studentIds.map((id) => (
                    <li
                      key={id}
                      className="flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs"
                    >
                      {id.slice(0, 8)}…
                      <button
                        type="button"
                        onClick={() => setStudentIds(studentIds.filter((x) => x !== id))}
                        className="text-slate-500 hover:text-slate-800"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving || (requireSchoolSelection && !schoolId)}
              className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {saving ? 'Creando…' : 'Crear visita'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

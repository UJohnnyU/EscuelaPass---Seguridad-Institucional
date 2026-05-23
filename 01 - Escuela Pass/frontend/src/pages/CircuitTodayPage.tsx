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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { CIRCUIT_STATUS_LABEL, PICKUP_METHOD_LABEL } from '@/lib/circuit-labels';
import { useAuth } from '@/context/useAuth';
import { Skeleton } from '@/components/Skeleton';
import { SmartSelect, type SmartSelectOption } from '@/components/SmartSelect';
import { useAdaptivePolling } from '@/hooks/use-adaptive-polling';

type CircuitRow = {
  id: string;
  studentId: string;
  status: string;
  pickupMethod: string;
  requestTime: string | null;
  studentFullName?: string | null;
  studentMatricula?: string | null;
};

function formatCircuitRequestTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es');
}

function studentLine(r: CircuitRow): string {
  const name = r.studentFullName?.trim();
  const mat = r.studentMatricula?.trim();
  if (name && mat) return `${name} · ${mat}`;
  if (name) return name;
  if (mat) return `Mat. ${mat}`;
  return 'Alumno (sin nombre en listado)';
}

type SchoolOption = { id: string; name: string };

const STORAGE_CIRCUIT_SCHOOL = 'circuitTodaySchoolId';

function pickSchoolIdForAdmin(
  list: SchoolOption[],
  opts: { stored: string | null; userSchoolId: string | null }
): string {
  if (list.length === 0) return '';
  const { stored, userSchoolId } = opts;
  if (stored && list.some((s) => s.id === stored)) return stored;
  if (userSchoolId && list.some((s) => s.id === userSchoolId)) return userSchoolId;
  return list[0]?.id ?? '';
}

export function CircuitTodayPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CircuitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [circuitEnabled, setCircuitEnabled] = useState<boolean>(true);
  const [savingCircuit, setSavingCircuit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [schoolsLoadError, setSchoolsLoadError] = useState<string | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const allowed =
    user?.role === 'DOCENTE' || user?.role === 'ADMIN' || user?.role === 'ADMINISTRATIVO';
  const canManageCircuit = user?.role === 'ADMIN' || user?.role === 'ADMINISTRATIVO';
  const isAdmin = user?.role === 'ADMIN';
  const isTeacher = user?.role === 'DOCENTE';

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setSchoolsLoadError(null);
      try {
        const { data } = await api.get<SchoolOption[]>('/api/v1/schools');
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setSchools(list);
        const stored =
          typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_CIRCUIT_SCHOOL) : null;
        const userSchoolId = user?.schoolId?.trim() || null;
        const pick = pickSchoolIdForAdmin(list, { stored, userSchoolId });
        setSelectedSchoolId(pick);
      } catch (e) {
        if (!cancelled) {
          setSchools([]);
          setSelectedSchoolId('');
          setSchoolsLoadError(getUserFacingMessage(e, 'No se pudo cargar el listado de instituciones.'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, user?.schoolId]);

  const loadToday = useCallback(
    async (opts?: { silent?: boolean; signal?: AbortSignal }) => {
      if (!allowed) return;
      if (isAdmin && !selectedSchoolId) {
        setRows([]);
        setLastUpdatedAt(Date.now());
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const silent = Boolean(opts?.silent);
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const params: Record<string, string> = { _t: String(Date.now()), limit: '200' };
        if (isAdmin && selectedSchoolId) {
          params.schoolId = selectedSchoolId;
        }
        const q = searchApplied.trim();
        if (q) params.q = q;
        const { data } = await api.get<CircuitRow[]>('/api/v1/circuit-requests/today', { params, signal: opts?.signal });
        setRows(data);
        setLastUpdatedAt(Date.now());
      } catch (e) {
        setError(getUserFacingMessage(e, 'No se pudo cargar el listado.'));
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [allowed, isAdmin, selectedSchoolId, searchApplied]
  );

  useEffect(() => {
    if (!allowed) return;
    void loadToday();
  }, [allowed, loadToday]);

  useEffect(() => {
    if (!isAdmin || !selectedSchoolId || typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(STORAGE_CIRCUIT_SCHOOL, selectedSchoolId);
  }, [isAdmin, selectedSchoolId]);

  useEffect(() => {
    if (!allowed) return;
    if (isAdmin && !selectedSchoolId) return;
    let cancelled = false;
    (async () => {
      try {
        const params: Record<string, string> = {};
        if (isAdmin && selectedSchoolId) {
          params.schoolId = selectedSchoolId;
        }
        const { data } = await api.get<{ enabled: boolean }>('/api/v1/settings/circuit', { params });
        if (!cancelled) {
          setCircuitEnabled(Boolean(data?.enabled));
        }
      } catch {
        if (!cancelled) {
          setCircuitEnabled(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, isAdmin, selectedSchoolId]);

  useAdaptivePolling({
    enabled: allowed,
    intervalFocused: 10000,
    intervalBlurred: 60000,
    onPoll: async ({ signal }) => {
      await loadToday({ silent: true, signal });
    }
  });

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) return 'Sin actualizar';
    return new Date(lastUpdatedAt).toLocaleTimeString('es');
  }, [lastUpdatedAt]);

  const schoolSelectOptions = useMemo<SmartSelectOption[]>(
    () => schools.map((s) => ({ value: s.id, label: s.name })),
    [schools]
  );

  async function patchCircuit(updates: { enabled?: boolean }) {
    if (!canManageCircuit) return;
    if (isAdmin && !selectedSchoolId) return;
    setSavingCircuit(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (isAdmin && selectedSchoolId) {
        params.schoolId = selectedSchoolId;
      }
      const { data } = await api.patch<{ enabled: boolean }>('/api/v1/settings/circuit', updates, { params });
      if (updates.enabled !== undefined) {
        setCircuitEnabled(Boolean(data?.enabled));
      }
    } catch (e) {
      setError(getUserFacingMessage(e, 'No se pudo actualizar la configuración del circuito.'));
    } finally {
      setSavingCircuit(false);
    }
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <p className="font-medium">Esta vista es para docentes o administración.</p>
        <Link to="/app" className="mt-3 inline-block text-brand-800 underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (loading && !(isAdmin && !selectedSchoolId)) {
    return (
      <div className="space-y-3" aria-label="Cargando solicitudes del día">
        <Skeleton.Row height={56} />
        <Skeleton.Row height={56} />
        <Skeleton.Row height={56} />
        <Skeleton.Row height={56} />
        <Skeleton.Row height={56} />
      </div>
    );
  }

  const onAdminSchoolChange = (schoolId: string) => {
    setSelectedSchoolId(schoolId);
  };

  return (
    <div className="animate-slide-up">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Recogidas de hoy</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-300">
        Solicitudes de recogida del día. Abra una para enviar avisos a la familia y avanzar su estado.
      </p>
      {isTeacher ? (
        <p className="mt-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-100">
          Solo se muestran los alumnos que están en tu clase en este momento o solicitudes que ya estás atendiendo.
        </p>
      ) : null}
      {error && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-red-800 ring-1 ring-red-200" role="alert">
          {error}
        </div>
      )}
      {isAdmin && (
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <label className="flex min-w-0 sm:min-w-[14rem] flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
            Institución
            <div className="mt-0.5">
              <SmartSelect
                options={schoolSelectOptions}
                value={selectedSchoolId}
                onChange={onAdminSchoolChange}
                placeholder="— Elegir —"
                emptyLabel="Sin instituciones"
                noResultsLabel="Sin coincidencias"
                disabled={Boolean(schoolsLoadError) || schools.length === 0}
              />
            </div>
            {/* Mantiene el role/aria del label original y evita perder contraste visual */}
            <input
              type="hidden"
              value={selectedSchoolId}
              readOnly
              aria-hidden="true"
            />
          </label>
          <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
            El listado se filtra por la escuela elegida. Docentes y administrativos de plantel solo ven su
            institución.
          </p>
        </div>
      )}
      {isAdmin && schoolsLoadError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {schoolsLoadError}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
        <label className="min-w-0 sm:min-w-[12rem] flex-1 text-sm text-slate-700 dark:text-slate-200">
          Buscar por alumno, padre o matrícula
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setSearchApplied(searchInput.trim());
                void loadToday({ silent: true });
              }
            }}
            placeholder="Nombre del alumno/padre o matrícula"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setSearchApplied(searchInput.trim());
            void loadToday({ silent: true });
          }}
          className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          Filtrar
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => void loadToday({ silent: true })}
          disabled={refreshing}
          className="rounded border border-slate-300 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          {refreshing ? 'Actualizando…' : 'Actualizar listado'}
        </button>
        <span className="text-slate-500 dark:text-slate-400">Última actualización: {lastUpdatedLabel}</span>
      </div>
      {canManageCircuit && (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Estado del circuito:{' '}
              <span className={circuitEnabled ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>
                {circuitEnabled ? 'ACTIVO' : 'INACTIVO'}
              </span>
            </p>
            <button
              type="button"
              disabled={savingCircuit || (isAdmin && !selectedSchoolId)}
              onClick={() => void patchCircuit({ enabled: !circuitEnabled })}
              className="rounded bg-brand-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 disabled:opacity-60"
            >
              {circuitEnabled ? 'Desactivar circuito' : 'Activar circuito'}
            </button>
          </div>
        </div>
      )}

      {isAdmin && !selectedSchoolId ? (
        <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-950">
          Elija una institución para ver el circuito de hoy.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          No hay solicitudes registradas para hoy.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to={`/app/circuito/${r.id}`}
                className="flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{studentLine(r)}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {CIRCUIT_STATUS_LABEL[r.status] ?? r.status} ·{' '}
                    {PICKUP_METHOD_LABEL[r.pickupMethod] ?? r.pickupMethod} ·{' '}
                    {formatCircuitRequestTime(r.requestTime)}
                  </p>
                </div>
                <span className="text-sm font-medium text-brand-700">Ver detalle →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

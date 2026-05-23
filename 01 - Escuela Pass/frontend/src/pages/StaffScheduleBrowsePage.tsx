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
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DetailModal } from '@/components/DetailModal';
import { SmartSelect } from '@/components/SmartSelect';
import {
  buildWeekDays,
  WeekScheduleEvent,
  WeekScheduleGrid
} from '@/components/WeekScheduleGrid';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { createSchoolGroupsLoadOptions } from '@/lib/schoolGroupsSelect';
import { invalidateSessionCachePrefix, readSessionCache, writeSessionCache } from '@/lib/sessionFetchCache';
import { getAppTimeZone, mondayWeekRangeYmd, todayInAppTimezone } from '@/lib/app-date';
import { useAuth } from '@/context/useAuth';
import { isPlatformAdmin } from '@/lib/roles';

type SchoolRow = { id: string; name: string; code: string };
type GroupRow = {
  id: string;
  name: string;
  grade: string | null;
  schoolYear: string;
  schoolId?: string;
};
type SlotRow = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  subjectId: string | null;
  room: string | null;
};
type SubjectRow = { id: string; name: string };
type CalEntity = { id: string; exceptionDate: string; reason: string | null; groupId?: string | null };

function weekRangeISO(offsetWeeks: number): { from: string; to: string; label: string } {
  const { from, to } = mondayWeekRangeYmd(offsetWeeks);
  const start = new Date(`${from}T12:00:00.000Z`);
  const end = new Date(`${to}T12:00:00.000Z`);
  const tz = getAppTimeZone();
  const label = `${start.toLocaleDateString('es', { day: 'numeric', month: 'short', timeZone: tz })} – ${end.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: tz
  })}`;
  return { from, to, label };
}

export function StaffScheduleBrowsePage() {
  const { user } = useAuth();
  const platformAdmin = isPlatformAdmin(user);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [groupId, setGroupId] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const { from, to, label } = useMemo(() => weekRangeISO(weekOffset), [weekOffset]);

  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [calendarDays, setCalendarDays] = useState<CalEntity[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [instDate, setInstDate] = useState(() => todayInAppTimezone());
  const [instReason, setInstReason] = useState('');
  const [instSaving, setInstSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; label: string } | null>(null);
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);

  const schoolFilterOptions = useMemo(
    () => [
      { value: '', label: 'Todas (mostrar todos los grupos)' },
      ...schools.map((s) => ({ value: s.id, label: `${s.name} (${s.code})`, searchText: s.code }))
    ],
    [schools]
  );

  const loadGroupOptions = useMemo(
    () =>
      createSchoolGroupsLoadOptions({
        schoolId: platformAdmin && schoolFilter.trim() ? schoolFilter.trim() : undefined,
        schools,
        showSchoolPrefix: platformAdmin && !schoolFilter.trim()
      }),
    [platformAdmin, schoolFilter, schools]
  );

  const canMarkInstitutionWide =
    user?.role === 'ADMINISTRATIVO' || (user?.role === 'ADMIN' && (!platformAdmin || !!schoolFilter.trim()));

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
    invalidateSessionCachePrefix('staffsched:');
    const ac = new AbortController();
    let cancelled = false;
    setLoadingMeta(true);
    setErr(null);
    loadGroupOptions('', ac.signal)
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
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [loadGroupOptions, schoolFilter]);

  const [groupDetail, setGroupDetail] = useState<GroupRow | null>(null);

  useEffect(() => {
    if (!groupId) {
      setGroupDetail(null);
      return;
    }
    let cancelled = false;
    api
      .get<GroupRow>(`/api/v1/school/groups/${groupId}`)
      .then(({ data }) => {
        if (!cancelled) setGroupDetail(data);
      })
      .catch(() => {
        if (!cancelled) setGroupDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const loadSchedule = useCallback(
    async (opts?: { bypassCache?: boolean }) => {
      if (!groupId) {
        setSlots([]);
        setCalendarDays([]);
        return;
      }
      const cacheKey = `staffsched:${groupId}:${from}:${to}`;
      if (!opts?.bypassCache) {
        const cached = readSessionCache<{
          slots: SlotRow[];
          nameMap: Record<string, string>;
          calendarDays: CalEntity[];
        }>(cacheKey);
        if (cached) {
          setSlots(cached.slots);
          setNameMap(cached.nameMap);
          setCalendarDays(cached.calendarDays);
          return;
        }
      }
      setLoadingSchedule(true);
      setErr(null);
      try {
        const [slotRes, subjRes, calRes] = await Promise.all([
          api.get<SlotRow[]>(`/api/v1/schedules/groups/${groupId}`),
          api.get<SubjectRow[]>('/api/v1/school/subjects'),
          api.get<CalEntity[]>(
            `/api/v1/calendar/non-instructional-days?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&groupId=${encodeURIComponent(groupId)}`
          )
        ]);
        const rawSlots = Array.isArray(slotRes.data) ? slotRes.data : [];
        const subjects = Array.isArray(subjRes.data) ? subjRes.data : [];
        const nameById = Object.fromEntries(subjects.map((s) => [s.id, s.name]));
        const cal = Array.isArray(calRes.data) ? calRes.data : [];
        setSlots(rawSlots);
        setNameMap(nameById);
        setCalendarDays(cal);
        writeSessionCache(cacheKey, { slots: rawSlots, nameMap: nameById, calendarDays: cal });
      } catch (e) {
        setErr(getUserFacingMessage(e, 'No se pudo cargar el horario.'));
        setSlots([]);
        setCalendarDays([]);
      } finally {
        setLoadingSchedule(false);
      }
    },
    [groupId, from, to]
  );

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const weekCalendarDays = useMemo(() => {
    return calendarDays.filter((d) => {
      const x = String(d.exceptionDate).slice(0, 10);
      return x >= from && x <= to;
    });
  }, [calendarDays, from, to]);

  const dayOffByISO = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const d of weekCalendarDays) {
      map.set(String(d.exceptionDate).slice(0, 10), d.reason ?? null);
    }
    return map;
  }, [weekCalendarDays]);

  const weekDays = useMemo(() => buildWeekDays(from, dayOffByISO), [from, dayOffByISO]);

  const weekEvents = useMemo<WeekScheduleEvent[]>(() => {
    return slots.map((s) => {
      const subjectName = s.subjectId ? nameMap[s.subjectId] ?? null : null;
      return {
        id: s.id,
        weekday: s.weekday,
        startTime: s.startTime,
        endTime: s.endTime,
        title: subjectName ?? 'Clase',
        subtitle: null,
        room: s.room,
        colorKey: subjectName ?? s.subjectId ?? s.id
      };
    });
  }, [slots, nameMap]);

  async function addInstitutionalDayOff() {
    if (!canMarkInstitutionWide) return;
    if (user?.role === 'ADMIN' && platformAdmin && !schoolFilter.trim()) {
      setErr('Seleccione una institución para marcar un día sin clases global.');
      return;
    }
    setInstSaving(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        exceptionDate: instDate,
        reason: instReason.trim() || undefined
      };
      if (user?.role === 'ADMIN' && schoolFilter.trim()) {
        body.schoolId = schoolFilter.trim();
      }
      await api.post('/api/v1/calendar/non-instructional-days', body);
      setInstReason('');
      await loadSchedule({ bypassCache: true });
    } catch (e) {
      setErr(getUserFacingMessage(e, 'No se pudo registrar el día sin clases.'));
    } finally {
      setInstSaving(false);
    }
  }

  async function removeCalendarEntry(id: string) {
    setRemovingId(id);
    setErr(null);
    try {
      await api.delete(`/api/v1/calendar/non-instructional-days/${id}`);
      await loadSchedule({ bypassCache: true });
    } catch (e) {
      setErr(getUserFacingMessage(e, 'No se pudo eliminar el registro.'));
    } finally {
      setRemovingId(null);
    }
  }

  async function downloadPdf() {
    if (!groupId) return;
    try {
      const res = await api.get(`/api/v1/documents/schedule/group/${groupId}`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `horario-${groupId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(getUserFacingMessage(e, 'No se pudo descargar el PDF.'));
    }
  }

  return (
    <div className="max-w-5xl animate-fade-in space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900 dark:text-slate-100">Horarios por grupo</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {platformAdmin
            ? 'Elija una escuela (opcional) y un grupo para ver su horario semanal y los días sin clases.'
            : 'Elija un grupo de su escuela para ver su horario semanal y los días sin clases.'}
        </p>
      </div>

      {err && (
        <div
          className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          {err}
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/20 sm:flex-row sm:flex-wrap sm:items-end">
        {platformAdmin && (
          <label className="block min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-300 sm:max-w-md">
            Institución
            <div className="mt-1">
              <SmartSelect
                options={schoolFilterOptions}
                value={schoolFilter}
                onChange={setSchoolFilter}
                placeholder="Todas (mostrar todos los grupos)"
              />
            </div>
          </label>
        )}
        <label className="block min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-300 sm:min-w-[220px]">
          Grupo
          <div className="mt-1">
            <SmartSelect
              loadOptions={loadGroupOptions}
              value={groupId}
              onChange={setGroupId}
              disabled={loadingMeta}
              placeholder={loadingMeta ? 'Cargando…' : '— Elegir grupo —'}
              emptyLabel="No hay grupos disponibles"
              selectedLabel={groupDetail ? `${groupDetail.name} · ${groupDetail.schoolYear}` : undefined}
            />
          </div>
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            ← Semana anterior
          </button>
          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Semana siguiente →
          </button>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="text-sm font-medium text-brand-800 underline dark:text-brand-300"
            >
              Hoy
            </button>
          )}
        </div>
        {groupId ? (
          <button
            type="button"
            onClick={() => void downloadPdf()}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Descargar PDF del grupo
          </button>
        ) : null}
      </div>

      {groupDetail && (
        <p className="text-sm text-slate-700 dark:text-slate-300">
          <span className="font-medium text-slate-900 dark:text-slate-100">{groupDetail.name}</span>
          {groupDetail.grade ? ` · ${groupDetail.grade}` : ''} · Año {groupDetail.schoolYear}
        </p>
      )}

      {loadingSchedule && groupId ? (
        <p className="text-slate-600 dark:text-slate-400">Cargando horario…</p>
      ) : null}

      {!groupId ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-100">
          Elija un grupo para ver el horario.
        </p>
      ) : (
        <WeekScheduleGrid
          events={weekEvents}
          days={weekDays}
          onSelect={(id) => setOpenSlotId(id)}
          emptyLabel={
            loadingSchedule
              ? 'Cargando horario…'
              : 'No hay franjas horarias cargadas para este grupo.'
          }
        />
      )}
      {(() => {
        const slot = slots.find((s) => s.id === openSlotId) ?? null;
        const WEEKDAY = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const subjectName = slot?.subjectId ? nameMap[slot.subjectId] ?? null : null;
        return (
          <DetailModal
            open={slot !== null}
            title={subjectName ?? 'Clase'}
            subtitle={
              slot
                ? `${WEEKDAY[slot.weekday] ?? ''} · ${slot.startTime.slice(0, 5)}–${slot.endTime.slice(0, 5)}`
                : undefined
            }
            onClose={() => setOpenSlotId(null)}
          >
            {slot ? (
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Materia</dt>
                  <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{subjectName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Día</dt>
                  <dd className="mt-0.5 capitalize text-slate-900 dark:text-slate-100">{WEEKDAY[slot.weekday]}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Horario</dt>
                  <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
                    {slot.startTime.slice(0, 5)} – {slot.endTime.slice(0, 5)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Aula</dt>
                  <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{slot.room ?? 'No especificada'}</dd>
                </div>
                {groupDetail ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Grupo</dt>
                    <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
                      {groupDetail.name}
                      {groupDetail.grade ? ` · ${groupDetail.grade}` : ''} · Año {groupDetail.schoolYear}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </DetailModal>
        );
      })()}

      {canMarkInstitutionWide ? (
        <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm dark:border-amber-700/40 dark:bg-amber-950/25 dark:shadow-slate-950/20">
          <h2 className="font-serif text-lg font-semibold text-slate-900 dark:text-slate-100">
            Marcar día sin clases para toda la escuela
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Ese día no se tomará asistencia y no contará en ninguno de los grupos. Afecta a toda la escuela.
          </p>
          {user?.role === 'ADMIN' && platformAdmin && !schoolFilter.trim() ? (
            <p className="mt-3 text-sm text-amber-900 dark:text-amber-200">Elija una escuela en el filtro de arriba para continuar.</p>
          ) : (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-300">
                Fecha
                <input
                  type="date"
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={instDate}
                  onChange={(e) => setInstDate(e.target.value)}
                />
              </label>
              <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm text-slate-700 dark:text-slate-300">
                Motivo (opcional)
                <input
                  type="text"
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={instReason}
                  onChange={(e) => setInstReason(e.target.value)}
                  placeholder="Ej. Junta de académicos"
                />
              </label>
              <button
                type="button"
                disabled={instSaving}
                onClick={() => void addInstitutionalDayOff()}
                className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-400"
              >
                {instSaving ? 'Guardando…' : 'Marcar día sin clases'}
              </button>
            </div>
          )}
        </section>
      ) : null}

      <section>
        <h2 className="font-serif text-lg font-semibold text-slate-900 dark:text-slate-100">Días sin clases de esta semana</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Incluye los días sin clases para toda la escuela y los del grupo seleccionado.
        </p>
        {weekCalendarDays.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">No hay días marcados sin clases en esta semana.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {weekCalendarDays.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/20"
              >
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {new Date(String(d.exceptionDate).slice(0, 10) + 'T12:00:00').toLocaleDateString('es', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </span>
                  <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {d.groupId ? 'Solo este grupo' : 'Toda la institución'}
                  </span>
                  {d.reason ? <span className="mt-1 block text-slate-600 dark:text-slate-300">{d.reason}</span> : null}
                </div>
                {(user?.role === 'ADMIN' || user?.role === 'ADMINISTRATIVO') && (
                  <button
                    type="button"
                    disabled={removingId === d.id}
                    onClick={() =>
                      setPendingRemoval({
                        id: d.id,
                        label: `${String(d.exceptionDate).slice(0, 10)}${d.reason ? ` (${d.reason})` : ''}`
                      })
                    }
                    className="shrink-0 text-sm font-medium text-red-700 hover:underline disabled:opacity-50 dark:text-red-400"
                  >
                    {removingId === d.id ? '…' : 'Quitar'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Para crear o editar franjas use los módulos de administración académica (horarios) con una cuenta con permisos
        correspondientes.
      </p>
      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Quitar día sin clases"
        description={
          pendingRemoval
            ? `Se eliminará el registro "${pendingRemoval.label}". La asistencia de ese día volverá a contarse normalmente.`
            : ''
        }
        confirmLabel="Sí, quitar registro"
        busy={removingId !== null}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (!pendingRemoval) return;
          void removeCalendarEntry(pendingRemoval.id).finally(() => setPendingRemoval(null));
        }}
      />
    </div>
  );
}

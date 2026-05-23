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
import { SmartSelect } from '@/components/SmartSelect';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DATA_TABLE_SEARCH_INPUT, SCROLLABLE_PANEL_BODY } from '@/components/DataTableScroll';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { useAuth } from '@/context/useAuth';
import { isPlatformAdmin } from '@/lib/roles';

type School = { id: string; name: string; code: string };

type PeriodStatus = 'PLANNED' | 'ACTIVE' | 'CLOSED';

type Period = {
  id: string;
  schoolId: string;
  schoolYear: string;
  name: string;
  orderIndex: number;
  startDate: string;
  endDate: string;
  weight: string;
  status: PeriodStatus;
  closedAt: string | null;
  reopenedAt?: string | null;
};

type EffectivePolicy = {
  schoolId: string;
  schoolYear: string;
  maxGradeScale: string;
  passingGrade: string;
  minFailedSubjectsToRepeat: number;
  totalWeight: string;
  remainingWeight: string;
};

type NewForm = {
  schoolYear: string;
  name: string;
  orderIndex: string;
  startDate: string;
  endDate: string;
  weight: string;
};

const emptyForm = (): NewForm => ({
  schoolYear: '',
  name: '',
  orderIndex: '',
  startDate: '',
  endDate: '',
  weight: ''
});

const emptyEditForm = () => ({
  name: '',
  orderIndex: '',
  startDate: '',
  endDate: '',
  weight: ''
});

function canReopenClosedPeriodThisCalendarYear(p: Period): boolean {
  if (p.status !== 'CLOSED' || !p.closedAt) return false;
  return new Date(p.closedAt).getFullYear() === new Date().getFullYear();
}

type PeriodPendingAction = { kind: 'close' | 'reopen' | 'delete'; id: string };

function reopenAutoCloseDeadlineYear(p: Period): number | null {
  if (!p.reopenedAt) return null;
  return new Date(p.reopenedAt).getFullYear() + 1;
}

export function PeriodosAcademicosPage() {
  const { user } = useAuth();
  const platformAdmin = isPlatformAdmin(user);

  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [periodsListSearch, setPeriodsListSearch] = useState('');
  const [ok, setOk] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<NewForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [policy, setPolicy] = useState<EffectivePolicy | null>(null);
  const [periodDialog, setPeriodDialog] = useState<PeriodPendingAction | null>(null);
  const [periodDialogBusy, setPeriodDialogBusy] = useState(false);

  useEffect(() => {
    if (!platformAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<School[]>('/api/v1/schools');
        if (!cancelled && Array.isArray(data)) {
          setSchools(data);
          if (!schoolId && data.length > 0) setSchoolId(data[0].id);
        }
      } catch {
        if (!cancelled) setSchools([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformAdmin, schoolId]);

  const loadPeriods = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params: Record<string, string> = {};
      if (platformAdmin && schoolId) params.schoolId = schoolId;
      const { data } = await api.get<Period[]>('/api/v1/academic-periods', { params });
      setPeriods(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(getUserFacingMessage(e));
      setPeriods([]);
    } finally {
      setLoading(false);
    }
  }, [platformAdmin, schoolId]);

  const loadPolicy = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (platformAdmin && schoolId) params.schoolId = schoolId;
      const { data } = await api.get<EffectivePolicy>('/api/v1/academic-periods/policy/effective', { params });
      setPolicy(data ?? null);
    } catch {
      setPolicy(null);
    }
  }, [platformAdmin, schoolId]);

  useEffect(() => {
    if (platformAdmin && !schoolId) return;
    void loadPeriods();
    void loadPolicy();
  }, [loadPeriods, loadPolicy, platformAdmin, schoolId]);

  const periodsForRegisteredList = useMemo(() => {
    const q = periodsListSearch.trim().toLowerCase();
    if (!q) return periods;
    return periods.filter((p) => {
      const blob = [
        p.name,
        p.schoolYear,
        p.startDate,
        p.endDate,
        p.status,
        String(p.orderIndex),
        p.weight
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [periods, periodsListSearch]);

  const yearOptions = useMemo(() => {
    const set = new Set(periodsForRegisteredList.map((p) => p.schoolYear));
    return [...set].sort().reverse();
  }, [periodsForRegisteredList]);

  const totalWeightByYear = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of periodsForRegisteredList) {
      map.set(p.schoolYear, (map.get(p.schoolYear) ?? 0) + Number(p.weight));
    }
    return map;
  }, [periodsForRegisteredList]);

  const submit = async () => {
    setErr(null);
    setOk(null);
    const year = form.schoolYear.trim();
    const name = form.name.trim();
    const order = Number(form.orderIndex);
    const weight = Number(form.weight.replace(',', '.'));
    if (!year || !name) {
      setErr('Ciclo escolar y nombre son obligatorios.');
      return;
    }
    if (!Number.isInteger(order) || order < 1 || order > 20) {
      setErr('El orden debe ser un entero entre 1 y 20.');
      return;
    }
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
      setErr('El peso debe estar entre 0 y 100.');
      return;
    }
    if (!form.startDate || !form.endDate) {
      setErr('Indique fechas de inicio y fin.');
      return;
    }
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        schoolYear: year,
        name,
        orderIndex: order,
        startDate: form.startDate,
        endDate: form.endDate,
        weight
      };
      if (platformAdmin && schoolId) payload.schoolId = schoolId;
      await api.post('/api/v1/academic-periods', payload);
      setOk('Periodo académico creado.');
      setForm(emptyForm());
      await loadPeriods();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const activatePeriod = async (id: string) => {
    setBusyId(id);
    setErr(null);
    try {
      await api.post(`/api/v1/academic-periods/${id}/activate`);
      setOk('Periodo activado.');
      await loadPeriods();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const periodDialogCopy = useMemo(() => {
    if (!periodDialog) return null;
    switch (periodDialog.kind) {
      case 'close':
        return {
          title: 'Cerrar periodo académico',
          description:
            '¿Cerrar este periodo? Todas las actividades abiertas se cerrarán (los alumnos sin nota reciben 0) y se generarán los boletines del periodo.',
          confirmLabel: 'Cerrar periodo',
          confirmTone: 'danger' as const
        };
      case 'reopen':
        return {
          title: 'Reabrir periodo académico',
          description:
            '¿Reabrir este periodo? Volverá a ACTIVO para que los docentes puedan trabajar calificaciones. Debe cerrarlo de nuevo a mano antes del 1 de enero del año siguiente; si no, el sistema lo cerrará automáticamente esa fecha (misma lógica que el cierre manual: actividades y boletines).',
          confirmLabel: 'Reabrir periodo',
          confirmTone: 'primary' as const
        };
      case 'delete':
        return {
          title: 'Eliminar periodo',
          description: '¿Eliminar este periodo? Solo se permite si no tiene actividades vinculadas.',
          confirmLabel: 'Eliminar periodo',
          confirmTone: 'danger' as const
        };
    }
  }, [periodDialog]);

  const confirmPeriodDialog = async () => {
    if (!periodDialog) return;
    const { kind, id } = periodDialog;
    setPeriodDialogBusy(true);
    setBusyId(id);
    setErr(null);
    try {
      if (kind === 'close') {
        await api.post(`/api/v1/academic-periods/${id}/close`);
        setOk('Periodo cerrado y boletines generados.');
      } else if (kind === 'reopen') {
        await api.post(`/api/v1/academic-periods/${id}/reopen`);
        setOk('Periodo reabierto. Recuerde cerrarlo de nuevo antes del 1 de enero del año siguiente.');
      } else {
        await api.delete(`/api/v1/academic-periods/${id}`);
        setOk('Periodo eliminado.');
      }
      setPeriodDialog(null);
      await loadPeriods();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setPeriodDialogBusy(false);
      setBusyId(null);
    }
  };

  const requestClosePeriod = (id: string) => setPeriodDialog({ kind: 'close', id });
  const requestReopenPeriod = (id: string) => setPeriodDialog({ kind: 'reopen', id });
  const requestRemovePeriod = (id: string) => setPeriodDialog({ kind: 'delete', id });

  const startEdit = (p: Period) => {
    setErr(null);
    setOk(null);
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      orderIndex: String(p.orderIndex),
      startDate: p.startDate,
      endDate: p.endDate,
      weight: String(Number(p.weight))
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyEditForm());
  };

  const saveEdit = async (id: string) => {
    setErr(null);
    setOk(null);
    const name = editForm.name.trim();
    const order = Number(editForm.orderIndex);
    const weight = Number(editForm.weight.replace(',', '.'));
    if (!name) {
      setErr('El nombre del periodo es obligatorio.');
      return;
    }
    if (!Number.isInteger(order) || order < 1 || order > 20) {
      setErr('El orden debe ser un entero entre 1 y 20.');
      return;
    }
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
      setErr('El peso debe estar entre 0 y 100.');
      return;
    }
    if (!editForm.startDate || !editForm.endDate) {
      setErr('Indique fechas de inicio y fin.');
      return;
    }
    setBusyId(id);
    try {
      await api.patch(`/api/v1/academic-periods/${id}`, {
        name,
        orderIndex: order,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        weight
      });
      setOk('Periodo actualizado.');
      cancelEdit();
      await loadPeriods();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <ConfirmDialog
        open={periodDialog !== null}
        title={periodDialogCopy?.title ?? ''}
        description={periodDialogCopy?.description ?? ''}
        confirmLabel={periodDialogCopy?.confirmLabel}
        confirmTone={periodDialogCopy?.confirmTone ?? 'danger'}
        cancelLabel="Cancelar"
        busy={periodDialogBusy}
        onCancel={() => !periodDialogBusy && setPeriodDialog(null)}
        onConfirm={() => void confirmPeriodDialog()}
      />
      <div className="max-w-5xl animate-fade-in space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Periodos académicos</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          Defina los bimestres o trimestres del año escolar. Al <strong>activar</strong> un periodo, los docentes
          pueden crear actividades y poner notas. Al <strong>cerrar</strong> un periodo, las notas quedan fijas, los
          alumnos sin calificar reciben cero y los boletines se publican a las familias. Un periodo{' '}
          <strong>cerrado en el año calendario en curso</strong> puede <strong>reabrirse</strong>; si queda reabierto,
          debe <strong>cerrarse de nuevo a mano antes del 1 de enero del año siguiente</strong>; de lo contrario, el
          cierre automático se aplicará esa fecha.
        </p>
      </div>

      {err && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>}
      {ok && !err && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{ok}</div>
      )}

      {platformAdmin && (
        <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-sm">
            <span className="text-slate-700">Institución</span>
            <div className="mt-1 max-w-sm">
              <SmartSelect
                options={schools.map((s) => ({ value: s.id, label: `${s.name} (${s.code})`, searchText: s.code }))}
                value={schoolId}
                onChange={setSchoolId}
                placeholder="Selecciona una escuela"
              />
            </div>
          </label>
        </section>
      )}

      <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
        {policy ? (
          <div className="mb-4 rounded border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">
            <p className="font-semibold">
              Política académica efectiva · ciclo {policy.schoolYear}
            </p>
            <p className="mt-1">
              Escala máxima: <strong>{policy.maxGradeScale}</strong> · Nota mínima aprobatoria:{' '}
              <strong>{policy.passingGrade}</strong> · Reprueba con <strong>{policy.minFailedSubjectsToRepeat}</strong>{' '}
              o más materias reprobadas.
            </p>
            <p className="mt-1">
              Peso total definido: <strong>{policy.totalWeight}%</strong> · Peso restante:{' '}
              <strong>{policy.remainingWeight}%</strong>
            </p>
          </div>
        ) : null}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Nuevo periodo</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm">
            <span className="text-slate-700">Ciclo escolar</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Ej. 2026-2027"
              value={form.schoolYear}
              onChange={(e) => setForm((f) => ({ ...f, schoolYear: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Nombre</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Ej. Bimestre 1"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Orden (1..N)</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.orderIndex}
              onChange={(e) => setForm((f) => ({ ...f, orderIndex: e.target.value }))}
              inputMode="numeric"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Inicio</span>
            <input
              type="date"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Fin</span>
            <input
              type="date"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Peso en boletín final (%)</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
              inputMode="decimal"
              placeholder="Ej. 25"
            />
          </label>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={creating}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {creating ? 'Creando…' : 'Crear periodo'}
          </button>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Periodos registrados</h2>
          <div className="flex flex-wrap items-center gap-2">
            {periods.length > 0 ? (
              <input
                type="search"
                value={periodsListSearch}
                onChange={(e) => setPeriodsListSearch(e.target.value)}
                placeholder="Buscar periodo…"
                className={`max-w-xs ${DATA_TABLE_SEARCH_INPUT}`}
              />
            ) : null}
            <button
              type="button"
              onClick={() => void loadPeriods()}
              disabled={loading}
              className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </div>
        {loading ? (
          <p className="px-4 py-4 text-sm text-slate-500">Cargando…</p>
        ) : periods.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">No hay periodos registrados.</p>
        ) : periodsForRegisteredList.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">Ningún periodo coincide con la búsqueda.</p>
        ) : (
          <div className={`divide-y divide-slate-100 ${SCROLLABLE_PANEL_BODY}`}>
            {yearOptions.map((year) => {
              const total = totalWeightByYear.get(year) ?? 0;
              return (
                <div key={year}>
                  <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700">
                    <span>Ciclo {year}</span>
                    <span
                      className={
                        Math.abs(total - 100) < 0.01
                          ? 'text-emerald-700'
                          : total > 100
                          ? 'text-red-700'
                          : 'text-amber-700'
                      }
                    >
                      Peso total: {total.toFixed(2)}% {Math.abs(total - 100) < 0.01 ? '✓' : '(debería sumar 100)'}
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {periodsForRegisteredList
                      .filter((p) => p.schoolYear === year)
                      .sort((a, b) => a.orderIndex - b.orderIndex)
                      .map((p) => {
                        const autoCloseYear = reopenAutoCloseDeadlineYear(p);
                        return (
                        <li key={p.id} className="flex flex-col gap-3 px-4 py-3">
                          {editingId === p.id ? (
                            <>
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                                <label className="text-xs">
                                  <span className="text-slate-600">Nombre</span>
                                  <input
                                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                  />
                                </label>
                                <label className="text-xs">
                                  <span className="text-slate-600">Orden</span>
                                  <input
                                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                    inputMode="numeric"
                                    value={editForm.orderIndex}
                                    onChange={(e) => setEditForm((f) => ({ ...f, orderIndex: e.target.value }))}
                                  />
                                </label>
                                <label className="text-xs">
                                  <span className="text-slate-600">Inicio</span>
                                  <input
                                    type="date"
                                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                    value={editForm.startDate}
                                    onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                                  />
                                </label>
                                <label className="text-xs">
                                  <span className="text-slate-600">Fin</span>
                                  <input
                                    type="date"
                                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                    value={editForm.endDate}
                                    onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
                                  />
                                </label>
                                <label className="text-xs">
                                  <span className="text-slate-600">Peso (%)</span>
                                  <input
                                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                    inputMode="decimal"
                                    value={editForm.weight}
                                    onChange={(e) => setEditForm((f) => ({ ...f, weight: e.target.value }))}
                                  />
                                </label>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void saveEdit(p.id)}
                                  disabled={busyId === p.id}
                                  className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                                >
                                  Guardar cambios
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={busyId === p.id}
                                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900">
                                  #{p.orderIndex} · {p.name}
                                  <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium">
                                    <StatusBadge status={p.status} />
                                  </span>
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {p.startDate} → {p.endDate} · Peso {parseFloat(p.weight)}%{' '}
                                  {p.closedAt ? `· Cerrado ${new Date(p.closedAt).toLocaleDateString('es')}` : ''}
                                </p>
                                {p.status === 'ACTIVE' && autoCloseYear != null ? (
                                  <p className="mt-1 text-xs font-medium text-amber-800">
                                    Reabierto: cierre manual antes del 1 de enero de {autoCloseYear} (si no, cierre
                                    automático).
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {p.status !== 'CLOSED' && (
                                  <button
                                    type="button"
                                    onClick={() => startEdit(p)}
                                    disabled={busyId === p.id}
                                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                                  >
                                    Editar
                                  </button>
                                )}
                                {p.status === 'PLANNED' && (
                                  <button
                                    type="button"
                                    onClick={() => void activatePeriod(p.id)}
                                    disabled={busyId === p.id}
                                    className="rounded border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                                  >
                                    Activar
                                  </button>
                                )}
                                {p.status === 'ACTIVE' && (
                                  <button
                                    type="button"
                                    onClick={() => requestClosePeriod(p.id)}
                                    disabled={busyId === p.id}
                                    className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                                  >
                                    Cerrar periodo
                                  </button>
                                )}
                                {p.status === 'CLOSED' && canReopenClosedPeriodThisCalendarYear(p) && (
                                  <button
                                    type="button"
                                    onClick={() => requestReopenPeriod(p.id)}
                                    disabled={busyId === p.id}
                                    className="rounded border border-amber-600 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60"
                                  >
                                    Reabrir (mismo año)
                                  </button>
                                )}
                                {p.status !== 'CLOSED' && (
                                  <button
                                    type="button"
                                    onClick={() => requestRemovePeriod(p.id)}
                                    disabled={busyId === p.id}
                                    className="rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-60"
                                  >
                                    Eliminar
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </li>
                        );
                      })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
    </>
  );
}

function StatusBadge({ status }: { status: PeriodStatus }) {
  if (status === 'ACTIVE')
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">Activo</span>;
  if (status === 'CLOSED')
    return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">Cerrado</span>;
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Planeado</span>;
}

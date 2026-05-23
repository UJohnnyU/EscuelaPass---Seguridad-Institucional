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

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';

type PanelSummary = {
  date: string;
  nonInstructionalDay: boolean;
  entities: {
    students: number;
    teachers: number;
    groups: number;
    usersActive: number;
  };
  attendanceToday: { total: number; byStatus: Record<string, number> };
  payments: { pendingDebts: number; overdueDebts: number; pendingWithVoucher: number };
  circuitToday: { total: number; byStatus: Record<string, number> };
  accessToday: { total: number; byType: Record<string, number> };
};

export type AdminPanelPayload = {
  referenceDate: string;
  window: { startDate: string; endDate: string; label: string };
  summary: PanelSummary;
  circuits: {
    byDay: Array<{ date: string; total: number; byStatus: Record<string, number> }>;
    byGroup: Array<{
      groupId: string;
      groupName: string;
      grade: string | null;
      shift: string | null;
      total: number;
    }>;
  };
};

const CIRCUIT_STATUS_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  PADRE_EN_CAMINO: 'Padre en camino',
  NOTIFICADO_LLEGADA: 'Llegada notificada',
  AUTORIZADO_SALIR: 'Autorizado salir',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CERRADO_SIN_CONFIRMACION_PADRE: 'Cerrado sin confirmación',
  CONSENTIDO_SOLO: 'Solo consentimiento',
  CANCELADO: 'Cancelado'
};

const SHIFT_LABEL: Record<string, string> = {
  MATUTINO: 'Mañana',
  VESPERTINO: 'Tarde',
  NOCTURNO: 'Noche'
};

function formatDayShort(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
}

function formatRange(start: string, end: string) {
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${a.toLocaleDateString('es', o)} – ${b.toLocaleDateString('es', o)} ${b.getFullYear()}`;
}

function KpiCard({
  title,
  value,
  hint,
  tone = 'slate'
}: {
  title: string;
  value: string | number;
  hint?: string;
  tone?: 'slate' | 'brand' | 'amber' | 'emerald';
}) {
  const ring =
    tone === 'brand'
      ? 'ring-brand-800/15 dark:ring-brand-400/25'
      : tone === 'amber'
        ? 'ring-amber-600/15 dark:ring-amber-400/20'
        : tone === 'emerald'
          ? 'ring-emerald-600/15 dark:ring-emerald-400/20'
          : 'ring-slate-300/40 dark:ring-slate-500/30';
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ring-1 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/20 ${ring}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-1 font-serif text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function AdminDashboardPanel() {
  const [data, setData] = useState<AdminPanelPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refDate, setRefDate] = useState(() => new Date().toISOString().slice(0, 10));
  const hasDataRef = useRef(false);

  const load = useCallback(async () => {
    setErr(null);
    if (!hasDataRef.current) setLoading(true);
    else setRefreshing(true);
    try {
      const { data: payload } = await api.get<AdminPanelPayload>('/api/v1/dashboard/panel', {
        params: { date: refDate }
      });
      setData(payload);
      hasDataRef.current = true;
    } catch (e) {
      setErr(getUserFacingMessage(e, 'No se pudo cargar el panel.'));
      if (!hasDataRef.current) setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;
  const maxDay = Math.max(1, ...(data?.circuits.byDay.map((d) => d.total) ?? [1]));
  const groupsTop = (data?.circuits.byGroup ?? []).slice(0, 10);
  const maxGroup = Math.max(1, ...groupsTop.map((g) => g.total));

  const circuitStatusEntries = summary
    ? Object.entries(summary.circuitToday.byStatus).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <section className="space-y-6" aria-label="Panel institucional" aria-busy={refreshing}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold text-slate-900 dark:text-slate-100">Panel de su escuela</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Resumen del día y de la última semana de su institución, con desglose por
            {' '}<strong className="font-medium text-slate-800 dark:text-slate-200">grupo o curso</strong>.
          </p>
          {data && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Período: {data.window.label} ({formatRange(data.window.startDate, data.window.endDate)})
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span className="whitespace-nowrap">Día de referencia</span>
            <input
              type="date"
              value={refDate}
              onChange={(e) => setRefDate(e.target.value)}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:shadow-slate-950/30"
            />
          </label>
          <Link
            to="/app/circuito/hoy"
            className="rounded border border-brand-800/30 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-900 shadow-sm transition hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-950/40 dark:text-brand-100 dark:hover:bg-brand-900/50"
          >
            Circuito del día
          </Link>
          <Link
            to="/app/modulos/administracion"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Informes detallados
          </Link>
        </div>
      </div>

      {/* Barra de progreso discreta para refrescos posteriores al inicial */}
      <div
        className={`h-px w-full overflow-hidden transition-opacity duration-300 ${refreshing ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      >
        <div className="h-full w-1/2 animate-progress-bar bg-brand-500/70 dark:bg-brand-400/80" />
      </div>

      {err && (
        <div
          className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          {err}
        </div>
      )}

      {loading && !data && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando indicadores…</p>
      )}

      {summary?.nonInstructionalDay && (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-100">
          El día de referencia está marcado como <strong>no lectivo</strong> en el calendario escolar. Los conteos de
          asistencia pueden ser bajos o nulos.
        </div>
      )}

      {summary && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <KpiCard
              title="Recogidas de hoy"
              value={summary.circuitToday.total}
              tone="brand"
              hint="Solicitudes registradas para el día"
            />
            <KpiCard title="Asistencia del día" value={summary.attendanceToday.total} hint="Estudiantes con asistencia tomada" />
            <KpiCard
              title="Pagos pendientes"
              value={summary.payments.pendingDebts}
              tone="amber"
              hint={
                summary.payments.overdueDebts > 0
                  ? `${summary.payments.overdueDebts} con la fecha vencida`
                  : 'Ninguna vencida hoy'
              }
            />
            <KpiCard title="Accesos del día" value={summary.accessToday.total} hint="Ingresos al plantel registrados" />
            <KpiCard
              title="Comunidad"
              value={summary.entities.students}
              hint={`${summary.entities.teachers} docentes · ${summary.entities.groups} grupos activos`}
            />
          </div>

          {summary.payments.pendingWithVoucher > 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-800 dark:text-slate-200">{summary.payments.pendingWithVoucher}</span>{' '}
              pago(s)
              pendiente(s) tienen comprobante cargado por la familia. Revíselos en Finanzas.
            </p>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/20">
              <h3 className="font-medium text-slate-900 dark:text-slate-100">Recogidas por día</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Solicitudes registradas durante los últimos 7 días
              </p>
              <div className="mt-6 flex justify-between gap-1 border-b border-slate-200 pb-1 dark:border-slate-700">
                {(data?.circuits.byDay ?? []).map((d) => {
                  const h = Math.round((d.total / maxDay) * 100);
                  return (
                    <div key={d.date} className="flex min-w-0 flex-1 flex-col items-stretch gap-1">
                      <div className="text-center text-[11px] font-semibold leading-none tabular-nums text-slate-800 dark:text-slate-200">
                        {d.total}
                      </div>
                      <div
                        className="flex h-32 w-full items-end justify-center"
                        title={`${d.total} solicitudes`}
                        aria-label={`${formatDayShort(d.date)}: ${d.total} solicitudes`}
                      >
                        <div
                          className="w-[85%] max-w-[2.75rem] rounded-t-md bg-brand-600 transition-all dark:bg-brand-500"
                          style={{ height: `${h}%`, minHeight: d.total > 0 ? '4px' : '0' }}
                        />
                      </div>
                      <span className="max-w-full truncate text-center text-[10px] font-medium uppercase leading-tight text-slate-500 dark:text-slate-400">
                        {formatDayShort(d.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/20">
              <h3 className="font-medium text-slate-900 dark:text-slate-100">Recogidas de hoy por estado</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                En qué etapa se encuentra cada solicitud del día
              </p>
              {circuitStatusEntries.length === 0 ? (
                <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">Sin solicitudes este día.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {circuitStatusEntries.map(([status, n]) => (
                    <li key={status}>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700 dark:text-slate-300">
                          {CIRCUIT_STATUS_LABEL[status] ?? status}
                        </span>
                        <span className="tabular-nums text-slate-900 dark:text-slate-100">{n}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-brand-500 dark:bg-brand-400"
                          style={{
                            width: `${Math.round((n / Math.max(1, summary.circuitToday.total)) * 100)}%`
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/20">
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Recogidas por grupo (últimos 7 días)</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Total de solicitudes de recogida agrupadas por curso o sección.
            </p>
            {groupsTop.length === 0 ? (
              <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Sin datos en el período.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {groupsTop.map((g) => {
                  const label = [g.groupName, g.grade].filter(Boolean).join(' · ');
                  const shift = g.shift ? SHIFT_LABEL[g.shift] ?? g.shift : null;
                  return (
                    <li key={`${g.groupId}-${label}-${shift ?? ''}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{label}</span>
                        <span className="tabular-nums text-slate-600 dark:text-slate-300">
                          {g.total}
                          {shift ? ` · ${shift}` : ''}
                        </span>
                      </div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-slate-700/80 dark:bg-slate-400/90"
                          style={{ width: `${Math.round((g.total / maxGroup) * 100)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

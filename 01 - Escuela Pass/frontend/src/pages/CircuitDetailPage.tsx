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

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { CIRCUIT_STATUS_LABEL, PICKUP_METHOD_LABEL, TEACHER_SIGNAL_LABEL } from '@/lib/circuit-labels';
import { getNextPedagogicalSignal, isCircuitTerminal } from '@/lib/circuit-utils';
import { STAFF_ALLOWED_NEXT, getPrimaryNextOperationalStatus } from '@/lib/circuit-transitions';
import {
  getOperationalAdvanceHint,
  getPedagogicalHint,
  getStaffTimelineModel
} from '@/lib/circuit-staff-flow';
import {
  CIRCUIT_FLOW_MUTE_STORAGE_KEY,
  circuitPartnerActivitySignature,
  playCircuitPartnerAlert
} from '@/lib/circuit-partner-sound';
import { useAuth } from '@/context/useAuth';
import { isStaff as userIsStaff } from '@/lib/roles';
import { useParentCircuitGpsOnDevice } from '@/lib/circuit-device-context';
import type { MapContextPayload } from '@/components/CircuitArrivalMap';
import { ParentTrackingMap } from '@/components/circuit/ParentTrackingMap';
import { useAdaptivePolling } from '@/hooks/use-adaptive-polling';

const CircuitArrivalMap = lazy(() =>
  import('@/components/CircuitArrivalMap').then((m) => ({ default: m.CircuitArrivalMap }))
);

type CircuitReq = {
  id: string;
  studentId: string;
  requestedByParentId: string;
  status: string;
  pickupMethod: string;
  requestTime: string;
  teacherSignal: string | null;
  vehicleId: string | null;
  pickupVehicleDescription?: string | null;
  pickupNotes?: string | null;
  parentConfirmDeadlineAt?: string | null;
  parentReceiptConfirmedAt?: string | null;
  arrivalSnapshotAt?: string | null;
  parentGpsLatitude?: string | null;
  parentGpsLongitude?: string | null;
  arrivalSnapshotLatitude?: string | null;
  arrivalSnapshotLongitude?: string | null;
};

const REMINDER_WINDOW_MIN = 15;
const CIRCUIT_AUTO_REFRESH_FOCUSED_MS = 10000;
const CIRCUIT_AUTO_REFRESH_BLURRED_MS = 60000;

/** Datos de escuela recuperados del endpoint /map para mostrar el mapa en vivo del padre. */
type SchoolGeoCtx = { schoolLatitude: number; schoolLongitude: number; arrivalRadiusKm: number } | null;

export function CircuitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [row, setRow] = useState<CircuitReq | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [reminderOpen, setReminderOpen] = useState(false);
  const [mapCtx, setMapCtx] = useState<MapContextPayload | null>(null);
  const [schoolGeo, setSchoolGeo] = useState<SchoolGeoCtx>(null);
  const [circuitFlowMuted, setCircuitFlowMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(CIRCUIT_FLOW_MUTE_STORAGE_KEY) === '1';
  });

  const suppressPartnerSoundRef = useRef(false);
  const circuitSoundHydratedRef = useRef(false);
  const lastCircuitSigRef = useRef<string | null>(null);

  const isParent = user?.role === 'PADRE';
  const isStaff = userIsStaff(user);
  const parentGpsOnThisDevice = useParentCircuitGpsOnDevice();

  const reload = useCallback(async (signal?: AbortSignal) => {
    if (!id) return;
    const cacheBust = { params: { _t: String(Date.now()) } };
    const { data } = await api.get<CircuitReq>(`/api/v1/circuit-requests/${id}`, {
      ...cacheBust,
      signal
    });
    setRow(data);
    try {
      const { data: m } = await api.get<MapContextPayload>(`/api/v1/circuit-requests/${id}/map`, {
        ...cacheBust,
        signal
      });
      setMapCtx(m);
      // Extraemos datos de escuela para el mapa en vivo del padre
      if (m.schoolLatitude && m.schoolLongitude) {
        setSchoolGeo({
          schoolLatitude: m.schoolLatitude,
          schoolLongitude: m.schoolLongitude,
          arrivalRadiusKm: m.arrivalRadiusKm ?? 0.3
        });
      }
    } catch {
      setMapCtx(null);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await reload();
      } catch (e) {
        if (!cancelled) setError(getUserFacingMessage(e, 'No se pudo cargar la solicitud.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reload]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CIRCUIT_FLOW_MUTE_STORAGE_KEY, circuitFlowMuted ? '1' : '0');
  }, [circuitFlowMuted]);

  useEffect(() => {
    circuitSoundHydratedRef.current = false;
    lastCircuitSigRef.current = null;
  }, [id]);

  useEffect(() => {
    if (!row || !id) return;
    if (row.id !== id) {
      circuitSoundHydratedRef.current = false;
      return;
    }
    const sig = circuitPartnerActivitySignature(row);
    if (!circuitSoundHydratedRef.current) {
      circuitSoundHydratedRef.current = true;
      lastCircuitSigRef.current = sig;
      return;
    }
    if (sig === lastCircuitSigRef.current) return;
    lastCircuitSigRef.current = sig;
    if (suppressPartnerSoundRef.current) return;
    if (circuitFlowMuted) return;
    playCircuitPartnerAlert();
  }, [row, circuitFlowMuted, id]);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const terminal = row ? isCircuitTerminal(row.status) : false;

  const reminderLogic = useMemo(() => {
    if (!row || row.status !== 'EN_CAMINO' || !row.parentConfirmDeadlineAt) {
      return { urgent: false, label: null as string | null };
    }
    const deadline = new Date(row.parentConfirmDeadlineAt).getTime();
    const start = deadline - REMINDER_WINDOW_MIN * 60_000;
    const elapsed = nowTick - start;
    const total = deadline - start;
    const urgent = elapsed >= total * 0.75 && nowTick < deadline;
    const leftSec = Math.max(0, Math.floor((deadline - nowTick) / 1000));
    const mm = Math.floor(leftSec / 60);
    const ss = leftSec % 60;
    return {
      urgent,
      label: `Plazo para confirmar recibimiento: ${mm}:${ss.toString().padStart(2, '0')}`
    };
  }, [row, nowTick]);

  const staffTimeline = useMemo(() => {
    if (!row) return null;
    return getStaffTimelineModel(row.status, row.pickupMethod);
  }, [row]);

  useEffect(() => {
    if (!id || !row || row.status !== 'EN_CAMINO') return;
    const key = `ep_reminder_${id}`;
    if (sessionStorage.getItem(key)) return;
    if (reminderLogic.urgent) {
      setReminderOpen(true);
    }
  }, [id, row, reminderLogic.urgent]);

  useAdaptivePolling({
    enabled: Boolean(id),
    intervalFocused: CIRCUIT_AUTO_REFRESH_FOCUSED_MS,
    intervalBlurred: CIRCUIT_AUTO_REFRESH_BLURRED_MS,
    onPoll: async ({ signal }) => {
      try {
        await reload(signal);
      } catch {
        // Polling silencioso: evita ruido de errores intermitentes de red.
      }
    }
  });

  function releasePartnerSoundSuppressionSoon() {
    if (typeof window === 'undefined') return;
    window.setTimeout(() => {
      suppressPartnerSoundRef.current = false;
    }, 850);
  }

  async function run(action: () => Promise<void>) {
    setMsg(null);
    setError(null);
    setBusy(true);
    suppressPartnerSoundRef.current = true;
    try {
      await action();
      await reload();
      setMsg('Actualizado.');
    } catch (e) {
      setError(getUserFacingMessage(e));
    } finally {
      setBusy(false);
      releasePartnerSoundSuppressionSoon();
    }
  }

  /** Aplica de inmediato la fila devuelta por PATCH parent-progress (misma forma que GET). */
  async function runWithCircuitBody(action: () => Promise<CircuitReq>) {
    setMsg(null);
    setError(null);
    setBusy(true);
    suppressPartnerSoundRef.current = true;
    try {
      const data = await action();
      setRow(data);
      await reload();
      setMsg('Actualizado.');
    } catch (e) {
      setError(getUserFacingMessage(e));
    } finally {
      setBusy(false);
      releasePartnerSoundSuppressionSoon();
    }
  }

  function dismissReminder() {
    if (id) sessionStorage.setItem(`ep_reminder_${id}`, '1');
    setReminderOpen(false);
  }

  if (!id) return null;
  if (loading) {
    return (
      <p className="text-sm tracking-wide uppercase text-slate-500 dark:text-slate-400">Cargando solicitud…</p>
    );
  }
  if (error && !row) {
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-100">
        {error}{' '}
        <Link to="/app" className="font-medium text-brand-800 underline dark:text-brand-300">
          Volver
        </Link>
      </div>
    );
  }
  if (!row) return null;

  const allowedStaff = STAFF_ALLOWED_NEXT[row.status] ?? [];
  const primaryOperational = getPrimaryNextOperationalStatus(row.status);
  const canStaffCancel = allowedStaff.includes('CANCELADO');
  const nextPedagogical = getNextPedagogicalSignal(row.teacherSignal);

  return (
    <div className="max-w-xl animate-fade-in">
      {reminderOpen && isParent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-serif text-lg font-semibold text-slate-900 dark:text-slate-100">Confirmación de recibimiento</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              El menor debería estar en camino al punto de salida. ¿Ya lo recibiste? Si no confirmas antes del plazo,
              el sistema cerrará el circuito indicando que no hubo confirmación final.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={dismissReminder}
              >
                Recordar más tarde
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
                onClick={() => {
                  dismissReminder();
                  void run(() => api.patch(`/api/v1/circuit-requests/${id}/confirm-delivered`, {}));
                }}
              >
                Sí, ya lo recibí
              </button>
            </div>
          </div>
        </div>
      )}

      {isStaff ? (
        <Link
          to="/app/circuito/hoy"
          className="text-xs font-medium uppercase tracking-wider text-brand-800 hover:underline dark:text-brand-300"
        >
          ← Volver al listado del día
        </Link>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium uppercase tracking-wider text-brand-800 dark:text-brand-300">
          <Link to="/app" className="hover:underline">
            ← Inicio
          </Link>
          {terminal && (
            <Link to="/app/circuito" className="hover:underline">
              Nueva solicitud
            </Link>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Circuito de recogida
        </h1>
        <button
          type="button"
          onClick={() => setCircuitFlowMuted((v) => !v)}
          className={`shrink-0 self-start rounded-full border px-3 py-1.5 text-xs font-medium ${
            circuitFlowMuted
              ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60'
              : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
          }`}
          title="Aviso cuando la familia o el plantel actualicen el circuito en esta pantalla (distinto al sonido de notificaciones)"
        >
          {circuitFlowMuted ? 'Activar aviso del circuito' : 'Silenciar aviso del circuito'}
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Registro {new Date(row.requestTime).toLocaleString('es')}
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Si deja esta vista abierta, sonará un aviso discreto cuando la otra parte avance el flujo (no es el mismo sonido
        que la campana de notificaciones).
      </p>

      <dl className="mt-8 space-y-4 rounded border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Estado</dt>
          <dd className="mt-1 text-lg font-medium text-slate-900 dark:text-slate-100">
            {CIRCUIT_STATUS_LABEL[row.status] ?? row.status}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Forma de retiro</dt>
          <dd className="mt-1 text-slate-800 dark:text-slate-200">{PICKUP_METHOD_LABEL[row.pickupMethod] ?? row.pickupMethod}</dd>
        </div>
        {row.pickupVehicleDescription && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Vehículo no registrado
            </dt>
            <dd className="mt-1 text-slate-800 dark:text-slate-200">{row.pickupVehicleDescription}</dd>
          </div>
        )}
        {row.pickupNotes && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Nota familia</dt>
            <dd className="mt-1 whitespace-pre-line text-slate-800 dark:text-slate-200">{row.pickupNotes}</dd>
          </div>
        )}
        {row.teacherSignal && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Señal docente</dt>
            <dd className="mt-1 text-slate-800 dark:text-slate-200">{TEACHER_SIGNAL_LABEL[row.teacherSignal] ?? row.teacherSignal}</dd>
          </div>
        )}
        {row.parentReceiptConfirmedAt && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Confirmación familia
            </dt>
            <dd className="mt-1 text-slate-800 dark:text-slate-200">
              {new Date(row.parentReceiptConfirmedAt).toLocaleString('es')}
            </dd>
          </div>
        )}
        {row.status === 'EN_CAMINO' && row.parentConfirmDeadlineAt && (
          <div className="rounded border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/35 dark:text-amber-100">
            {reminderLogic.label}
          </div>
        )}
      </dl>

      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-100" role="alert">
          {error}
        </div>
      )}
      {msg && (
        <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-950 dark:border-emerald-800/50 dark:bg-emerald-950/35 dark:text-emerald-100" role="status">
          {msg}
        </div>
      )}

      {isParent && !terminal && (
        <div className="mt-8 space-y-4">
          {row.status === 'PENDIENTE' && (
            <>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Cuando estés listo para salir, indica que vas en camino. Se activará el mapa en vivo y el plantel
                recibirá una notificación cuando llegues al radio de la escuela.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runWithCircuitBody(async () => {
                    const { data } = await api.patch<CircuitReq>(
                      `/api/v1/circuit-requests/${id}/parent-progress`,
                      { status: 'PADRE_EN_CAMINO' }
                    );
                    return data;
                  })
                }
                className="w-full rounded bg-brand-800 py-3 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
              >
                Voy en camino
              </button>
            </>
          )}

          {row.status === 'PADRE_EN_CAMINO' && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {parentGpsOnThisDevice
                  ? 'Mapa en vivo — tu ubicación se comparte automáticamente'
                  : 'Continúe el recorrido en su teléfono móvil'}
              </p>
              {!parentGpsOnThisDevice ? (
                <div className="rounded-xl border border-sky-200 bg-gradient-to-b from-sky-50 to-white px-4 py-5 shadow-sm ring-1 ring-sky-100 dark:border-sky-800/50 dark:from-sky-950/80 dark:to-slate-900">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                    <div className="mx-auto shrink-0 rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200 sm:mx-0">
                      <QRCodeSVG
                        value={typeof window !== 'undefined' ? window.location.href : ''}
                        size={132}
                        level="M"
                        marginSize={1}
                        className="block"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                      <p className="text-base font-semibold text-sky-950 dark:text-sky-100">Continúe en su teléfono móvil</p>
                      <p className="text-sm leading-relaxed text-sky-900/90 dark:text-sky-200/90">
                        El mapa en vivo y la detección automática de llegada requieren GPS del móvil. Abra este
                        enlace en su celular o escanee el código.
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(window.location.href);
                            setMsg('Enlace copiado. Péguelo en el navegador de su móvil.');
                          } catch {
                            setError('No pudimos copiar al portapapeles. Copie la dirección de la barra del navegador.');
                          }
                        }}
                        className="w-full rounded-lg border border-sky-300 bg-white px-4 py-2.5 text-sm font-medium text-sky-950 hover:bg-sky-50 sm:w-auto dark:border-sky-600 dark:bg-slate-800 dark:text-sky-100"
                      >
                        Copiar enlace de esta solicitud
                      </button>
                    </div>
                  </div>
                </div>
              ) : schoolGeo ? (
                <ParentTrackingMap
                  circuitRequestId={id}
                  schoolLatitude={schoolGeo.schoolLatitude}
                  schoolLongitude={schoolGeo.schoolLongitude}
                  arrivalRadiusKm={schoolGeo.arrivalRadiusKm}
                  onAutoTransitioned={() => void reload()}
                />
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">Cargando datos del mapa…</p>
              )}
            </div>
          )}

          {row.status === 'NOTIFICADO_LLEGADA' && (
            <div className="flex items-center gap-3 rounded-xl border-2 border-emerald-500 bg-emerald-50 px-4 py-4 dark:border-emerald-400 dark:bg-emerald-950/50">
              <span className="relative flex h-4 w-4 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500" />
              </span>
              <div>
                <p className="font-semibold text-emerald-900 dark:text-emerald-100">Llegada confirmada — en el radio del plantel</p>
                <p className="text-xs text-emerald-800 dark:text-emerald-200">El personal fue notificado. Espera la autorización de salida.</p>
              </div>
            </div>
          )}

          {row.status !== 'ENTREGADO' && row.status !== 'CANCELADO' && row.status !== 'CERRADO_SIN_CONFIRMACION_PADRE' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => api.patch(`/api/v1/circuit-requests/${id}/cancel`, {}))}
              className="w-full rounded border border-slate-300 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancelar solicitud
            </button>
          )}

          {row.status === 'EN_CAMINO' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => api.patch(`/api/v1/circuit-requests/${id}/confirm-delivered`, {}))}
              className="w-full rounded border border-slate-900 bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Confirmar que ya recibí a mi hijo o hija
            </button>
          )}
        </div>
      )}

      {isStaff && !terminal && staffTimeline && (
        <div className="mt-8 space-y-6">
          <div className="rounded border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-serif text-base font-semibold text-slate-900 dark:text-slate-100">
              Protocolo de retiro
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Referencia institucional del flujo. La línea gruesa indica el progreso; el paso resaltado corresponde al
              estado actual en el sistema.
            </p>

            {staffTimeline.cancelled && (
              <p
                className="mt-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-100"
                role="status"
              >
                Esta solicitud fue <strong>cancelada</strong>. No envíe nuevas señales ni cambios de estado.
              </p>
            )}
            {staffTimeline.closedWithoutConfirm && (
              <p
                className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/35 dark:text-amber-100"
                role="status"
              >
                Cierre automático: <strong>sin confirmación final de la familia</strong> dentro del plazo reglamentario.
              </p>
            )}

            <ol className="relative mt-5 ml-1 space-y-5 border-l-2 border-slate-200 pl-6 dark:border-slate-600">
              {staffTimeline.steps.map((step, i) => {
                const idx = staffTimeline.currentIndex;
                const isDone = !staffTimeline.cancelled && !staffTimeline.closedWithoutConfirm && idx >= 0 && i < idx;
                const isCurrent =
                  !staffTimeline.cancelled &&
                  !staffTimeline.closedWithoutConfirm &&
                  idx >= 0 &&
                  i === idx;
                const timelineMuted = staffTimeline.cancelled || staffTimeline.closedWithoutConfirm;
                return (
                  <li key={step.statusKey} className="relative">
                    <span
                      className={`absolute -left-[calc(0.625rem+2px)] top-1 flex h-3 w-3 items-center justify-center ${
                        isCurrent && !timelineMuted ? '' : 'top-1.5 h-2.5 w-2.5'
                      }`}
                      aria-hidden
                    >
                      {isCurrent && !timelineMuted && (
                        <span className="absolute h-3 w-3 rounded-full bg-brand-600/50 motion-safe:animate-circuit-step-live motion-reduce:animate-none dark:bg-brand-400/40" />
                      )}
                      <span
                        className={`relative z-[1] rounded-full border-2 ${
                          timelineMuted
                            ? 'h-2.5 w-2.5 border-slate-300 bg-slate-200 dark:border-slate-500 dark:bg-slate-700'
                            : isDone
                              ? 'h-2.5 w-2.5 border-emerald-600 bg-emerald-600'
                              : isCurrent
                                ? 'h-2.5 w-2.5 border-brand-800 bg-brand-800 ring-4 ring-brand-800/25 dark:border-brand-500 dark:bg-brand-500 dark:ring-brand-500/25'
                                : 'h-2.5 w-2.5 border-slate-300 bg-white dark:border-slate-500 dark:bg-slate-900'
                        }`}
                      />
                    </span>
                    <div
                      className={
                        isCurrent && !timelineMuted
                          ? 'rounded-r-md border-l-2 border-brand-700/55 pl-3 motion-safe:transition-[border-color,box-shadow] motion-safe:duration-500 dark:border-brand-400/45'
                          : 'pl-0.5'
                      }
                    >
                      <p
                        className={`text-sm font-semibold ${
                          isCurrent
                            ? 'text-brand-900 motion-safe:animate-circuit-step-title motion-reduce:animate-none dark:text-brand-200'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {step.caption}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {staffTimeline.isConsentOnly && (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                Flujo de solo consentimiento: no hay verificación de llegada ni tránsito a la salida en esta solicitud.
              </p>
            )}
          </div>

          <div className="rounded border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-serif text-base font-semibold text-slate-900 dark:text-slate-100">
              Ubicación declarada por la familia
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Posición registrada cuando el sistema detectó la llegada dentro del área autorizada (GPS). Si la ubicación no es coherente con el protocolo, puede solicitar
              una nueva confirmación con GPS (acción bajo el mapa).
            </p>
            <div className="mt-4">
              {mapCtx ? (
                <Suspense
                  fallback={<p className="text-sm text-slate-500 dark:text-slate-400">Cargando mapa…</p>}
                >
                  <CircuitArrivalMap ctx={mapCtx} />
                </Suspense>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {loading ? 'Cargando…' : 'Aún no hay llegada verificada con ubicación para este retiro.'}
                </p>
              )}
            </div>
            {row.status === 'NOTIFICADO_LLEGADA' && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-700/50 dark:bg-emerald-950/35">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                  </span>
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Padre en radio del plantel</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() => api.patch(`/api/v1/circuit-requests/${id}/status`, { status: 'AUTORIZADO_SALIR' }))
                  }
                  className="w-full rounded bg-brand-800 py-3 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
                >
                  Autorizar salida del alumno
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() => api.patch(`/api/v1/circuit-requests/${id}/status`, { status: 'PADRE_EN_CAMINO' }))
                  }
                  className="w-full rounded border border-amber-600 bg-amber-50 py-2.5 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  Solicitar nueva verificación de llegada (GPS)
                </button>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Al autorizar la salida, el alumno queda registrado como en camino a la salida automáticamente.
                  Solo solicite nueva verificación si la ubicación del padre no es coherente.
                </p>
              </div>
            )}
          </div>

          <div className="rounded border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-serif text-base font-semibold text-slate-900 dark:text-slate-100">
              Acciones del plantel
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Separe la <strong>comunicación al acudiente</strong> (mensajes de aula) del <strong>estado oficial</strong>{' '}
              del retiro. Ambas pueden usarse en paralelo según el protocolo de su institución.
            </p>

            <div className="mt-5 space-y-4">
              {nextPedagogical && !staffTimeline.isConsentOnly && (
                <div className="rounded-lg border border-slate-200/90 bg-slate-50/90 p-4 dark:border-slate-600 dark:bg-slate-800/50">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Comunicación al acudiente (aula)
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {getPedagogicalHint(nextPedagogical)}{' '}
                    <span className="text-slate-500 dark:text-slate-500">
                      Orden obligatorio: primero «Preparar salida», luego «Alumno en camino a salida».
                    </span>
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        api.patch(`/api/v1/circuit-requests/${id}/teacher-signal`, { signal: nextPedagogical })
                      )
                    }
                    className="mt-3 w-full rounded bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50 sm:w-auto"
                  >
                    Enviar aviso: {TEACHER_SIGNAL_LABEL[nextPedagogical]}
                  </button>
                </div>
              )}

              {!nextPedagogical && !staffTimeline.isConsentOnly && (
                <p className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                  Comunicaciones de aula completas para esta solicitud (ambas señales ya enviadas).
                </p>
              )}

              {primaryOperational ? (
                <div className="rounded-lg border border-slate-200/90 bg-slate-50/90 p-4 dark:border-slate-600 dark:bg-slate-800/50">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Estado oficial del retiro
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {getOperationalAdvanceHint(primaryOperational)}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        api.patch(`/api/v1/circuit-requests/${id}/status`, { status: primaryOperational })
                      )
                    }
                    className="mt-3 w-full rounded bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white sm:w-auto"
                  >
                    Registrar: {CIRCUIT_STATUS_LABEL[primaryOperational] ?? primaryOperational}
                  </button>
                </div>
              ) : row.status === 'EN_CAMINO' ? (
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  El menor está en tránsito hacia la salida. La familia debe <strong>confirmar el recibimiento</strong> en
                  su app; no hay otro avance de estado del plantel en el flujo normal.
                </p>
              ) : row.status === 'PADRE_EN_CAMINO' ? (
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  El padre está en camino. Cuando entre al radio del plantel, el sistema lo notificará automáticamente
                  y podrá autorizar el retiro aquí.
                </p>
              ) : row.status === 'NOTIFICADO_LLEGADA' ? null : (
                !nextPedagogical &&
                !staffTimeline.isConsentOnly && (
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    No hay un cambio de estado pendiente para el plantel en este momento.
                  </p>
                )
              )}
            </div>
          </div>

          <details className="group rounded border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-800 outline-none marker:content-none dark:text-slate-100 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                Más opciones del protocolo
                <span
                  className="text-xs font-normal text-slate-500 group-open:rotate-180 dark:text-slate-400"
                  aria-hidden
                >
                  ▼
                </span>
              </span>
            </summary>
            <div className="space-y-4 border-t border-slate-200 px-5 py-4 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:text-slate-400">
              <ul className="list-inside list-disc space-y-2">
                <li>
                  Los avisos «al acudiente» informan al aula/familia; el «estado oficial» deja constancia en el sistema
                  para portería y seguimiento.
                </li>
                <li>La entrega física la confirma la familia cuando el estado es «Menor en tránsito a la salida».</li>
                <li>
                  Use <strong>Solicitar nueva verificación de llegada</strong> solo cuando deba corregirse la
                  ubicación declarada.
                </li>
              </ul>
              {canStaffCancel && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Anular solicitud
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => api.patch(`/api/v1/circuit-requests/${id}/status`, { status: 'CANCELADO' }))}
                    className="mt-2 w-full rounded border border-slate-300 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancelar solicitud
                  </button>
                </div>
              )}
            </div>
          </details>
        </div>
      )}

      {terminal && (
        <p className="mt-8 rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
          Este circuito está cerrado. No se envían más señales ni cambios de estado.
        </p>
      )}
    </div>
  );
}

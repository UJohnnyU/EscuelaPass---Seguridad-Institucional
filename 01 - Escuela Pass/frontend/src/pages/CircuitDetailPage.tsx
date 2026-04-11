import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { CIRCUIT_STATUS_LABEL, PICKUP_METHOD_LABEL, TEACHER_SIGNAL_LABEL } from '@/lib/circuit-labels';
import { getNextPedagogicalSignal, isCircuitTerminal } from '@/lib/circuit-utils';
import { STAFF_ALLOWED_NEXT } from '@/lib/circuit-transitions';
import { useAuth } from '@/context/useAuth';
import { isStaff as userIsStaff } from '@/lib/roles';

type CircuitReq = {
  id: string;
  studentId: string;
  requestedByParentId: string;
  status: string;
  pickupMethod: string;
  requestTime: string;
  teacherSignal: string | null;
  vehicleId: string | null;
  parentConfirmDeadlineAt?: string | null;
  parentReceiptConfirmedAt?: string | null;
};

const REMINDER_WINDOW_MIN = 15;

export function CircuitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [row, setRow] = useState<CircuitReq | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [staffNext, setStaffNext] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());
  const [reminderOpen, setReminderOpen] = useState(false);

  const isParent = user?.role === 'PADRE';
  const isStaff = userIsStaff(user);

  const reload = useCallback(async () => {
    if (!id) return;
    const { data } = await api.get<CircuitReq>(`/api/v1/circuit-requests/${id}`);
    setRow(data);
    const allowed = STAFF_ALLOWED_NEXT[data.status] ?? [];
    setStaffNext(allowed[0] ?? '');
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

  useEffect(() => {
    if (!id || !row || row.status !== 'EN_CAMINO') return;
    const key = `ep_reminder_${id}`;
    if (sessionStorage.getItem(key)) return;
    if (reminderLogic.urgent) {
      setReminderOpen(true);
    }
  }, [id, row, reminderLogic.urgent]);

  async function run(action: () => Promise<void>) {
    setMsg(null);
    setError(null);
    setBusy(true);
    try {
      await action();
      await reload();
      setMsg('Actualizado.');
    } catch (e) {
      setError(getUserFacingMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function dismissReminder() {
    if (id) sessionStorage.setItem(`ep_reminder_${id}`, '1');
    setReminderOpen(false);
  }

  if (!id) return null;
  if (loading) {
    return (
      <p className="text-slate-500 text-sm tracking-wide uppercase">Cargando solicitud…</p>
    );
  }
  if (error && !row) {
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-900 text-sm">
        {error}{' '}
        <Link to="/app" className="font-medium text-brand-800 underline">
          Volver
        </Link>
      </div>
    );
  }
  if (!row) return null;

  const allowedStaff = STAFF_ALLOWED_NEXT[row.status] ?? [];
  const nextPedagogical = getNextPedagogicalSignal(row.teacherSignal);

  return (
    <div className="max-w-xl animate-fade-in">
      {reminderOpen && isParent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="font-serif text-lg font-semibold text-slate-900">Confirmación de recibimiento</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              El menor debería estar en camino al punto de salida. ¿Ya lo recibiste? Si no confirmas antes del plazo,
              el sistema cerrará el circuito indicando que no hubo confirmación final.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
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
          className="text-xs font-medium uppercase tracking-wider text-brand-800 hover:underline"
        >
          ← Volver al listado del día
        </Link>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium uppercase tracking-wider text-brand-800">
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
      <h1 className="mt-4 font-serif text-2xl font-semibold tracking-tight text-slate-900">
        Circuito de recogida
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Registro {new Date(row.requestTime).toLocaleString('es')}
      </p>

      <dl className="mt-8 space-y-4 rounded border border-slate-200/80 bg-white p-6 shadow-sm">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Estado</dt>
          <dd className="mt-1 text-lg font-medium text-slate-900">
            {CIRCUIT_STATUS_LABEL[row.status] ?? row.status}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Forma de retiro</dt>
          <dd className="mt-1 text-slate-800">{PICKUP_METHOD_LABEL[row.pickupMethod] ?? row.pickupMethod}</dd>
        </div>
        {row.teacherSignal && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Señal docente</dt>
            <dd className="mt-1 text-slate-800">{TEACHER_SIGNAL_LABEL[row.teacherSignal] ?? row.teacherSignal}</dd>
          </div>
        )}
        {row.parentReceiptConfirmedAt && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Confirmación familia
            </dt>
            <dd className="mt-1 text-slate-800">
              {new Date(row.parentReceiptConfirmedAt).toLocaleString('es')}
            </dd>
          </div>
        )}
        {row.status === 'EN_CAMINO' && row.parentConfirmDeadlineAt && (
          <div className="rounded border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
            {reminderLogic.label}
          </div>
        )}
      </dl>

      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900" role="alert">
          {error}
        </div>
      )}
      {msg && (
        <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-950" role="status">
          {msg}
        </div>
      )}

      {isParent && !terminal && (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-slate-600 leading-relaxed">
            Avanza el circuito cuando corresponda. El GPS no cambia el estado automáticamente. Podrás confirmar que ya
            recibiste a tu hijo o hija solo cuando el plantel haya indicado que va en camino hacia la salida (en
            tránsito).
          </p>
          {row.status === 'PENDIENTE' && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(() =>
                  api.patch(`/api/v1/circuit-requests/${id}/parent-progress`, { status: 'PADRE_EN_CAMINO' })
                )
              }
              className="w-full rounded bg-brand-800 py-3 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
            >
              Voy en camino
            </button>
          )}
          {row.status === 'PADRE_EN_CAMINO' && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(() =>
                  api.patch(`/api/v1/circuit-requests/${id}/parent-progress`, { status: 'NOTIFICADO_LLEGADA' })
                )
              }
              className="w-full rounded bg-brand-800 py-3 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
            >
              Ya llegué
            </button>
          )}
          {row.status !== 'ENTREGADO' && row.status !== 'CANCELADO' && row.status !== 'CERRADO_SIN_CONFIRMACION_PADRE' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => api.patch(`/api/v1/circuit-requests/${id}/cancel`, {}))}
              className="w-full rounded border border-slate-300 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar solicitud
            </button>
          )}
          {row.status === 'EN_CAMINO' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => api.patch(`/api/v1/circuit-requests/${id}/confirm-delivered`, {}))}
              className="w-full rounded border border-slate-900 bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Confirmar que ya recibí a mi hijo o hija
            </button>
          )}
        </div>
      )}

      {isStaff && !terminal && (
        <div className="mt-8 space-y-6 rounded border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="font-serif text-base font-semibold text-slate-900">Señal pedagógica a la familia</h2>
            <p className="mt-1 text-xs text-slate-500">
              Orden fijo: primero solo &quot;Preparando salida&quot;; después solo &quot;Alumno en camino a salida&quot;. No
              se puede saltar ni alternar libremente.
            </p>
            {nextPedagogical ? (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      api.patch(`/api/v1/circuit-requests/${id}/teacher-signal`, { signal: nextPedagogical })
                    )
                  }
                  className="rounded bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
                >
                  Enviar: {TEACHER_SIGNAL_LABEL[nextPedagogical]}
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">
                Ya se enviaron las dos señales pedagógicas de esta solicitud.
              </p>
            )}
          </div>

          <div>
            <h2 className="font-serif text-base font-semibold text-slate-900">Estado operativo</h2>
            <p className="mt-1 text-xs text-slate-500">
              La entrega final la confirma la familia. Si el alumno va hacia salida, use el flujo hasta EN_CAMINO.
            </p>
            {allowedStaff.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No hay transiciones disponibles desde este estado.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={staffNext}
                  onChange={(e) => setStaffNext(e.target.value)}
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {allowedStaff.map((s) => (
                    <option key={s} value={s}>
                      {CIRCUIT_STATUS_LABEL[s] ?? s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy || !staffNext}
                  onClick={() =>
                    run(() => api.patch(`/api/v1/circuit-requests/${id}/status`, { status: staffNext }))
                  }
                  className="rounded border border-slate-800 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                >
                  Aplicar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {terminal && (
        <p className="mt-8 rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Este circuito está cerrado. No se envían más señales ni cambios de estado.
        </p>
      )}
    </div>
  );
}

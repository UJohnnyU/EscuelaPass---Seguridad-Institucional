import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { CIRCUIT_STATUS_LABEL, PICKUP_METHOD_LABEL } from '@/lib/circuit-labels';
import { useAuth } from '@/context/useAuth';

type CircuitRow = {
  id: string;
  studentId: string;
  status: string;
  pickupMethod: string;
  requestTime: string;
};

export function CircuitTodayPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CircuitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [circuitEnabled, setCircuitEnabled] = useState<boolean>(true);
  const [savingCircuit, setSavingCircuit] = useState(false);

  const allowed =
    user?.role === 'DOCENTE' || user?.role === 'ADMIN' || user?.role === 'ADMINISTRATIVO';
  const canManageCircuit = user?.role === 'ADMIN' || user?.role === 'ADMINISTRATIVO';

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<CircuitRow[]>('/api/v1/circuit-requests/today');
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) setError(getUserFacingMessage(e, 'No se pudo cargar el listado.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ enabled: boolean }>('/api/v1/settings/circuit');
        if (!cancelled) setCircuitEnabled(Boolean(data?.enabled));
      } catch {
        if (!cancelled) setCircuitEnabled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  async function toggleCircuit(next: boolean) {
    if (!canManageCircuit) return;
    setSavingCircuit(true);
    setError(null);
    try {
      const { data } = await api.patch<{ enabled: boolean }>('/api/v1/settings/circuit', { enabled: next });
      setCircuitEnabled(Boolean(data?.enabled));
    } catch (e) {
      setError(getUserFacingMessage(e, 'No se pudo actualizar el estado del circuito.'));
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

  if (loading) return <p className="text-slate-600">Cargando solicitudes del día…</p>;

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-red-800 ring-1 ring-red-200" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <h1 className="text-2xl font-bold text-slate-900">Circuito de hoy</h1>
      <p className="mt-1 text-slate-600">Solicitudes con fecha de hoy. Abre una para señales y estado.</p>
      {canManageCircuit && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-sm text-slate-700">
            Estado del circuito:{' '}
            <span className={circuitEnabled ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>
              {circuitEnabled ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </p>
          <button
            type="button"
            disabled={savingCircuit}
            onClick={() => void toggleCircuit(!circuitEnabled)}
            className="rounded bg-brand-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {circuitEnabled ? 'Desactivar circuito' : 'Activar circuito'}
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          No hay solicitudes registradas para hoy.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to={`/app/circuito/${r.id}`}
                className="flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {CIRCUIT_STATUS_LABEL[r.status] ?? r.status}
                  </p>
                  <p className="text-sm text-slate-600">
                    {PICKUP_METHOD_LABEL[r.pickupMethod] ?? r.pickupMethod} ·{' '}
                    {new Date(r.requestTime).toLocaleString('es')}
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

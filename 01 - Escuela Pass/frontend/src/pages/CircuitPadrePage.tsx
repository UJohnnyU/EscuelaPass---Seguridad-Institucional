import { type FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { PICKUP_METHOD_LABEL } from '@/lib/circuit-labels';
import { useAuth } from '@/context/useAuth';

type StudentRow = { id: string; matricula: string; fullName: string };
type ParentStudents = { parentId: string; students: StudentRow[] };
type Vehicle = { id: string; plate: string; description?: string | null };

const METHODS = ['VEHICULO_REGISTRADO', 'OTRO_VEHICULO', 'A_PIE', 'SOLO_CONSENTIMIENTO'] as const;

export function CircuitPadrePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<ParentStudents | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [studentId, setStudentId] = useState('');
  const [pickupMethod, setPickupMethod] = useState<(typeof METHODS)[number]>('A_PIE');
  const [vehicleId, setVehicleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Si hay solicitud abierta, ir directo al seguimiento (evita perder el hilo al volver desde el perfil). */
  const [activeCircuitId, setActiveCircuitId] = useState<string | null>(null);
  const [consentActive, setConsentActive] = useState<Record<string, boolean>>({});
  const [consentSaving, setConsentSaving] = useState(false);

  useEffect(() => {
    if (user?.role !== 'PADRE') return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        try {
          const activeRes = await api.get<{ active: { id: string } | null }>(
            '/api/v1/circuit-requests/parent/active'
          );
          if (cancelled) return;
          if (activeRes.data.active?.id) {
            setActiveCircuitId(activeRes.data.active.id);
            setLoading(false);
            return;
          }
        } catch {
          /* Sin redirección: mostrar formulario si el endpoint no existe o falla */
        }
        const [{ data: ps }, { data: vh }, consentRes] = await Promise.all([
          api.get<ParentStudents>('/api/v1/attendance/parent/my-students'),
          api.get<Vehicle[]>('/api/v1/parents/vehicles'),
          api
            .get<Array<{ studentId: string; autonomousToday: boolean }>>(
              '/api/v1/departure-consent/parent/today'
            )
            .catch(() => ({ data: [] as Array<{ studentId: string; autonomousToday: boolean }> }))
        ]);
        if (cancelled) return;
        setData(ps);
        setVehicles(vh);
        const map: Record<string, boolean> = {};
        for (const c of consentRes.data ?? []) {
          map[c.studentId] = c.autonomousToday;
        }
        setConsentActive(map);
        if (ps.students.length) setStudentId((prev) => prev || ps.students[0].id);
      } catch (e) {
        if (!cancelled) setError(getUserFacingMessage(e, 'No se pudieron cargar los datos.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  async function toggleAutonomousConsent(next: boolean) {
    if (!studentId) return;
    setConsentSaving(true);
    setError(null);
    try {
      await api.post('/api/v1/departure-consent/parent/set', {
        studentId,
        active: next
      });
      setConsentActive((prev) => ({ ...prev, [studentId]: next }));
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo actualizar el permiso de salida.'));
    } finally {
      setConsentSaving(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data?.parentId || !studentId) {
      setError('Selecciona un estudiante.');
      return;
    }
    if (consentActive[studentId]) {
      setError('Desactive primero “Salida autónoma” para usar el circuito de recogida con seguimiento.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        studentId,
        requestedByParentId: data.parentId,
        pickupMethod
      };
      if (pickupMethod === 'VEHICULO_REGISTRADO') {
        if (!vehicleId) {
          setError('Elige un vehículo registrado o cambia el método de retiro.');
          setSubmitting(false);
          return;
        }
        body.vehicleId = vehicleId;
      }
      const { data: res } = await api.post<{ requestId: string }>('/api/v1/circuit-requests', body);
      navigate(`/app/circuito/${res.requestId}`, { replace: true });
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo crear la solicitud.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (user?.role !== 'PADRE' && user?.role !== 'ADMIN' && user?.role !== 'ADMINISTRATIVO') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <p className="font-medium">Esta sección es para familias o administración.</p>
        <Link to="/app" className="mt-3 inline-block text-brand-800 underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (user?.role !== 'PADRE') {
    return <Navigate to="/app/circuito/hoy" replace />;
  }

  if (activeCircuitId) {
    return <Navigate to={`/app/circuito/${activeCircuitId}`} replace />;
  }

  if (loading) return <p className="text-slate-600">Cargando…</p>;

  if (!data?.students.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Circuito de recogida</h1>
        <p className="mt-2 text-slate-600">
          Aún no hay alumnos vinculados a su cuenta. Si cree que es un error, comuníquese con secretaría.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg animate-slide-up">
      <h1 className="text-2xl font-bold text-slate-900">Nueva solicitud de recogida</h1>
      <p className="mt-1 text-sm text-slate-600">
        Indique cómo va a recoger a su hijo o hija. Después podrá avisar que va en camino y marcar su llegada desde
        la misma solicitud.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <p className="text-sm font-medium text-slate-800">Salida autónoma</p>
        <p className="mt-1 text-xs text-slate-600">
          Si su hijo o hija puede retirarse solo sin recogida coordinada, active esta opción. Quedará activa todos los
          días hasta que la desmarque.
        </p>
        <label className="mt-3 flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={!!consentActive[studentId]}
            disabled={consentSaving || !studentId}
            onChange={(e) => void toggleAutonomousConsent(e.target.checked)}
          />
          <span className="text-sm text-slate-800">
            {consentActive[studentId]
              ? 'Puede irse solo (sin circuito de recogida) hasta que lo desmarque'
              : 'Activar permiso de salida autónoma'}
          </span>
        </label>
      </div>

      {consentActive[studentId] ? (
        <div
          className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          Tiene activa la salida autónoma para el alumno seleccionado. Para iniciar una recogida con seguimiento (en
          camino, llegada, etc.), desactive la casilla arriba.
        </div>
      ) : null}

      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="student">
            Estudiante
          </label>
          <select
            id="student"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none ring-brand-500/30 focus:ring-2"
          >
            {data.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} ({s.matricula})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="method">
            Forma de retiro
          </label>
          <select
            id="method"
            value={pickupMethod}
            onChange={(e) => setPickupMethod(e.target.value as (typeof METHODS)[number])}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none ring-brand-500/30 focus:ring-2"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {PICKUP_METHOD_LABEL[m] ?? m}
              </option>
            ))}
          </select>
        </div>

        {pickupMethod === 'VEHICULO_REGISTRADO' && (
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="vehicle">
              Vehículo
            </label>
            <select
              id="vehicle"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none ring-brand-500/30 focus:ring-2"
            >
              <option value="">— Elegir —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate}
                  {v.description ? ` · ${v.description}` : ''}
                </option>
              ))}
            </select>
            {vehicles.length === 0 && (
              <p className="mt-2 text-sm text-amber-800">
                Aún no tiene vehículos registrados. Pídale al plantel que dé de alta su vehículo o elija otra forma de
                recoger.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting || !!consentActive[studentId]}
          className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Enviando…' : 'Crear solicitud'}
        </button>
      </form>
    </div>
  );
}

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

  useEffect(() => {
    if (user?.role !== 'PADRE' && user?.role !== 'ADMIN' && user?.role !== 'ADMINISTRATIVO') return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (user?.role === 'PADRE') {
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
          const [{ data: ps }, { data: vh }] = await Promise.all([
            api.get<ParentStudents>('/api/v1/attendance/parent/my-students'),
            api.get<Vehicle[]>('/api/v1/parents/vehicles')
          ]);
          if (cancelled) return;
          setData(ps);
          setVehicles(vh);
          if (ps.students.length) setStudentId((prev) => prev || ps.students[0].id);
        } else {
          if (!cancelled) {
            setData({ parentId: '', students: [] });
            setVehicles([]);
          }
        }
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data?.parentId || !studentId) {
      setError('Selecciona un estudiante.');
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
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-700">
          Como administrador, el circuito se gestiona también desde <strong>Circuito hoy</strong> y el listado de
          solicitudes.
        </p>
        <Link to="/app/circuito/hoy" className="mt-4 inline-block font-medium text-brand-700">
          Ir a circuito de hoy →
        </Link>
      </div>
    );
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
          No hay estudiantes vinculados a tu cuenta. Si crees que es un error, contacta a secretaría.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg animate-slide-up">
      <h1 className="text-2xl font-bold text-slate-900">Nueva solicitud de circuito</h1>
      <p className="mt-1 text-sm text-slate-600">
        Indica cómo vendrás a retirar. El estado lo avanzas tú con los botones en la solicitud (en camino, llegada).
      </p>

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
                No tienes vehículos dados de alta. Registra uno desde la institución o elige otro método de retiro.
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
          disabled={submitting}
          className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Enviando…' : 'Crear solicitud'}
        </button>
      </form>
    </div>
  );
}

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { useAuth } from '@/context/useAuth';

type PickupRequest = {
  id: string;
  parentId: string;
  studentId: string;
  visitDatetime: string;
  reason: string | null;
  status: string;
  createdAt: string;
};

type StudentRow = { id: string; matricula: string; fullName: string };

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada'
};

const STATUS_COLOR: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-900',
  APROBADA: 'bg-emerald-100 text-emerald-900',
  RECHAZADA: 'bg-red-100 text-red-900',
  COMPLETADA: 'bg-slate-100 text-slate-800',
  CANCELADA: 'bg-slate-100 text-slate-500'
};

const STAFF_ROLES = ['ADMIN', 'ADMINISTRATIVO', 'DOCENTE'];

function isStaffRole(role: string | undefined) {
  return STAFF_ROLES.includes(role ?? '');
}

function minDatetimeLocal(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  return now.toISOString().slice(0, 16);
}

export function PickupRequestsPage() {
  const { user } = useAuth();
  const isStaff = isStaffRole(user?.role);
  const isParent = user?.role === 'PADRE';

  const [requests, setRequests] = useState<PickupRequest[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [studentId, setStudentId] = useState('');
  const [visitDatetime, setVisitDatetime] = useState(minDatetimeLocal());
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const endpoint = isStaff ? '/api/v1/pickup-requests' : '/api/v1/pickup-requests/me';
    const { data } = await api.get<PickupRequest[]>(endpoint);
    setRequests(data);
  }, [isStaff]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const loads: Promise<unknown>[] = [reload()];
        if (isParent) {
          loads.push(
            api.get<{ parentId: string; students: StudentRow[] }>('/api/v1/attendance/parent/my-students').then(
              ({ data }) => {
                if (!cancelled) {
                  setStudents(data.students);
                  if (data.students.length) setStudentId(data.students[0].id);
                }
              }
            )
          );
        }
        await Promise.all(loads);
      } catch (e) {
        if (!cancelled) setError(getUserFacingMessage(e, 'No se pudieron cargar los datos.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isStaff, isParent, reload]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!studentId) {
      setError('Selecciona un estudiante.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setMsg(null);
    try {
      await api.post('/api/v1/pickup-requests', {
        studentId,
        visitDatetime: new Date(visitDatetime).toISOString(),
        reason: reason.trim() || undefined
      });
      setMsg('Solicitud creada correctamente.');
      setReason('');
      setVisitDatetime(minDatetimeLocal());
      setShowForm(false);
      await reload();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo crear la solicitud.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatus(id: string, status: string) {
    setActionBusy(id);
    setError(null);
    setMsg(null);
    try {
      await api.patch(`/api/v1/pickup-requests/${id}/status`, { status });
      setMsg('Estado actualizado.');
      await reload();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo actualizar el estado.'));
    } finally {
      setActionBusy(null);
    }
  }

  if (!isStaff && !isParent) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <p className="font-medium">Esta sección no está disponible para su rol.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in space-y-8">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
          {isStaff ? 'Gestión de accesos' : 'Mi cuenta'}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">
          {isStaff ? 'Solicitudes de retiro anticipado' : 'Mis solicitudes de retiro'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
          {isStaff
            ? 'Revise y gestione las solicitudes de retiro anticipado de estudiantes. Apruebe o rechace según corresponda.'
            : 'Solicite retiro anticipado de su hijo o hija. El plantel revisará y aprobará o rechazará la solicitud.'}
        </p>
      </header>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950" role="status">
          {msg}
        </div>
      )}

      {isParent && (
        <div>
          {showForm ? (
            <form
              onSubmit={handleCreate}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
            >
              <h2 className="font-serif text-lg font-semibold text-slate-900">Nueva solicitud</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="student-pick">
                  Estudiante
                </label>
                <select
                  id="student-pick"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none ring-brand-500/30 focus:ring-2"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.matricula})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="visit-dt">
                  Fecha y hora del retiro
                </label>
                <input
                  id="visit-dt"
                  type="datetime-local"
                  value={visitDatetime}
                  min={minDatetimeLocal()}
                  onChange={(e) => setVisitDatetime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none ring-brand-500/30 focus:ring-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="reason">
                  Motivo (opcional)
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={400}
                  rows={3}
                  placeholder="Ej. cita médica, diligencia familiar…"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none ring-brand-500/30 focus:ring-2"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-950 disabled:opacity-50"
                >
                  {submitting ? 'Enviando…' : 'Enviar solicitud'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowForm(true);
                setMsg(null);
                setError(null);
              }}
              className="rounded-xl bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-950"
            >
              + Nueva solicitud de retiro
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : requests.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          {isParent ? 'Aún no tienes solicitudes de retiro.' : 'No hay solicitudes registradas.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {new Date(r.visitDatetime).toLocaleString('es', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </p>
                  {r.reason && (
                    <p className="text-sm text-slate-600">{r.reason}</p>
                  )}
                  <p className="text-xs text-slate-400">
                    Creada {new Date(r.createdAt).toLocaleDateString('es')}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[r.status] ?? 'bg-slate-100 text-slate-600'}`}
                >
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>

              {isStaff && r.status === 'PENDIENTE' && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    disabled={actionBusy === r.id}
                    onClick={() => void handleStatus(r.id, 'APROBADA')}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy === r.id}
                    onClick={() => void handleStatus(r.id, 'RECHAZADA')}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy === r.id}
                    onClick={() => void handleStatus(r.id, 'COMPLETADA')}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Marcar completada
                  </button>
                </div>
              )}

              {isParent && r.status === 'PENDIENTE' && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    disabled={actionBusy === r.id}
                    onClick={() => void handleStatus(r.id, 'CANCELADA')}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancelar solicitud
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

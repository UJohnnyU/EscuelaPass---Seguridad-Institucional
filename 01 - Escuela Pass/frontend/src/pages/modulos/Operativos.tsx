import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { Panel, ValueView } from '@/components/ValueView';
import { useAuth } from '@/context/useAuth';
import { hasRole, isAdmin, isStaff } from '@/lib/roles';
import axios from 'axios';

export function ModulosHubPage() {
  const { user } = useAuth();
  const cards: { to: string; title: string; desc: string; show: boolean }[] = [
    {
      to: '/app/modulos/comunicacion',
      title: 'Comunicación',
      desc: 'Comunicados institucionales y bandeja de avisos.',
      show: true
    },
    {
      to: '/app/modulos/finanzas',
      title: 'Finanzas y pagos',
      desc: 'Conceptos, deudas y comprobantes según su perfil.',
      show: true
    },
    {
      to: '/app/modulos/academico',
      title: 'Académico',
      desc: 'Asistencia y calificaciones vinculadas a su cuenta.',
      show: true
    },
    {
      to: '/app/modulos/visitas',
      title: 'Visitas y reuniones',
      desc: 'Visitas al plantel y citas con docentes.',
      show: hasRole(user, 'PADRE', 'DOCENTE', 'ADMIN', 'ADMINISTRATIVO')
    },
    {
      to: '/app/modulos/administracion',
      title: 'Administración e informes',
      desc: 'Tablero, auditoría, informes y calendario administrativo.',
      show: isAdmin(user) || hasRole(user, 'DOCENTE')
    },
    {
      to: '/app/modulos/herramientas',
      title: 'Herramientas',
      desc: 'Horarios, vehículos, privacidad y documentos PDF.',
      show: isStaff(user)
    },
    {
      to: '/app/horario',
      title: 'Mi horario',
      desc: 'Horario semanal del grupo, calendario sin clases y avisos recibidos.',
      show: user?.role === 'ALUMNO'
    }
  ];

  return (
    <div className="max-w-5xl animate-fade-in">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-slate-900">Módulos operativos</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
        Acceda a cada área para revisar datos en tiempo real. La información se presenta de forma clara; los errores
        se muestran como mensajes comprensibles.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {cards
          .filter((c) => c.show)
          .map((c) => (
            <li key={c.to}>
              <Link
                to={c.to}
                className="flex h-full flex-col rounded border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                <span className="font-medium text-slate-900">{c.title}</span>
                <span className="mt-2 flex-1 text-sm text-slate-600">{c.desc}</span>
                <span className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand-800">Abrir</span>
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}

export function ComunicacionPage() {
  const [notifications, setNotifications] = useState<unknown>(null);
  const [notices, setNotices] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const { user } = useAuth();
  const staff = hasRole(user, 'ADMIN', 'ADMINISTRATIVO', 'DOCENTE');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        const n = await api.get('/api/v1/notifications/me');
        if (!cancelled) setNotifications(n.data);
        if (staff) {
          const o = await api.get('/api/v1/notices?page=1&limit=10');
          if (!cancelled) setNotices(o.data);
        }
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staff]);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Comunicación</h1>
        <p className="mt-1 text-sm text-slate-600">Notificaciones personales y, si aplica, comunicados emitidos.</p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      <Panel title="Mis notificaciones" description="Avisos entregados a su usuario.">
        <ValueView data={notifications} />
      </Panel>
      {staff && (
        <Panel title="Comunicados (gestión)" description="Listado reciente para personal autorizado.">
          <ValueView data={notices} />
        </Panel>
      )}
    </div>
  );
}

export function FinanzasPage() {
  const [concepts, setConcepts] = useState<unknown>(null);
  const [debts, setDebts] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const { user } = useAuth();
  const padre = user?.role === 'PADRE';
  const admin = isAdmin(user);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        const c = await api.get('/api/v1/payments/concepts');
        if (!cancelled) setConcepts(c.data);
        if (padre) {
          const d = await api.get('/api/v1/payments/debts/mine');
          if (!cancelled) setDebts(d.data);
        } else if (admin) {
          const d = await api.get('/api/v1/payments/debts?page=1&limit=20');
          if (!cancelled) setDebts(d.data);
        }
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [padre, admin]);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Finanzas</h1>
        <p className="mt-1 text-sm text-slate-600">Conceptos de cobro y estado de obligaciones según su rol.</p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      <Panel title="Conceptos">
        <ValueView data={concepts} />
      </Panel>
      {(padre || admin) && (
        <Panel title={padre ? 'Mis obligaciones' : 'Deudas (administración)'}>
          <ValueView data={debts} />
        </Panel>
      )}
    </div>
  );
}

export function AcademicoPage() {
  const [att, setAtt] = useState<unknown>(null);
  const [grades, setGrades] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const { user } = useAuth();
  const padre = user?.role === 'PADRE';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        if (padre) {
          const [a, g] = await Promise.all([
            api.get('/api/v1/attendance/parent/my-children'),
            api.get('/api/v1/grades/parent/my-children')
          ]);
          if (!cancelled) {
            setAtt(a.data);
            setGrades(g.data);
          }
        }
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [padre]);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Académico</h1>
        <p className="mt-1 text-sm text-slate-600">
          {padre
            ? 'Asistencia y calificaciones de los estudiantes vinculados a su cuenta.'
            : 'Esta vista está orientada a familias. Docentes y administración usan informes y exportaciones.'}
        </p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      {padre ? (
        <>
          <Panel title="Asistencia (familia)">
            <ValueView data={att} />
          </Panel>
          <Panel title="Calificaciones (familia)">
            <ValueView data={grades} />
          </Panel>
        </>
      ) : (
        <Panel title="Información">
          <p className="text-sm text-slate-600">
            Use el módulo <strong>Administración e informes</strong> para reportes por grupo o las exportaciones en
            Excel.
          </p>
        </Panel>
      )}
    </div>
  );
}

export function VisitasPage() {
  const [visits, setVisits] = useState<unknown>(null);
  const [meetings, setMeetings] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const { user } = useAuth();
  const padre = user?.role === 'PADRE';
  const staff = hasRole(user, 'DOCENTE', 'ADMIN', 'ADMINISTRATIVO');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        if (padre) {
          const [v, m] = await Promise.all([
            api.get('/api/v1/visits/me'),
            api.get('/api/v1/meetings/me')
          ]);
          if (!cancelled) {
            setVisits(v.data);
            setMeetings(m.data);
          }
        } else if (staff) {
          const [v, m] = await Promise.all([api.get('/api/v1/visits'), api.get('/api/v1/meetings')]);
          if (!cancelled) {
            setVisits(v.data);
            setMeetings(m.data);
          }
        }
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [padre, staff]);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Visitas y reuniones</h1>
        <p className="mt-1 text-sm text-slate-600">Solicitudes y seguimiento según corresponda a su rol.</p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      {!padre && !staff ? (
        <p className="text-sm text-slate-600">No hay datos disponibles para su perfil en esta sección.</p>
      ) : (
        <>
          <Panel title="Visitas">
            <ValueView data={visits} />
          </Panel>
          <Panel title="Reuniones padre–docente">
            <ValueView data={meetings} />
          </Panel>
        </>
      )}
    </div>
  );
}

export function AdministracionPage() {
  const [summary, setSummary] = useState<unknown>(null);
  const [audit, setAudit] = useState<unknown>(null);
  const [calendar, setCalendar] = useState<unknown>(null);
  const [repAtt, setRepAtt] = useState<unknown>(null);
  const [circuit, setCircuit] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const { user } = useAuth();
  const admin = isAdmin(user);
  const docente = user?.role === 'DOCENTE';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        if (admin) {
          const s = await api.get('/api/v1/dashboard/summary');
          const a = await api.get('/api/v1/audit/logs?limit=30');
          const cal = await api.get('/api/v1/calendar/non-instructional-days');
          if (!cancelled) {
            setSummary(s.data);
            setAudit(a.data);
            setCalendar(cal.data);
          }
        }
        if (admin || docente) {
          const cToday = await api.get('/api/v1/reports/circuit/today');
          if (!cancelled) setCircuit(cToday.data);
          if (admin) {
            const rPay = await api.get('/api/v1/reports/payments/pending');
            if (!cancelled) setRepAtt(rPay.data);
          }
        }
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [admin, docente]);

  if (!admin && !docente) {
    return (
      <p className="text-sm text-slate-600">
        Esta sección es para personal autorizado. Si necesita un informe, solicítelo a secretaría.
      </p>
    );
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Administración e informes</h1>
        <p className="mt-1 text-sm text-slate-600">Resumen operativo y trazas para evaluación en ejecución.</p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      {admin && (
        <>
          <Panel title="Tablero general">
            <ValueView data={summary} />
          </Panel>
          <Panel title="Auditoría reciente">
            <ValueView data={audit} />
          </Panel>
          <Panel title="Días no lectivos (calendario)">
            <ValueView data={calendar} />
          </Panel>
          <Panel title="Pagos pendientes (informe)">
            <ValueView data={repAtt} />
          </Panel>
        </>
      )}
      <Panel title="Circuito del día (informe)">
        <ValueView data={circuit} />
      </Panel>
    </div>
  );
}

export function HerramientasPage() {
  const [privacy, setPrivacy] = useState<unknown>(null);
  const [policy, setPolicy] = useState<unknown>(null);
  const [policyHint, setPolicyHint] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<unknown>(null);
  const [schedule, setSchedule] = useState<unknown>(null);
  const [scheduleHint, setScheduleHint] = useState<string | null>(null);
  const [errAcceptances, setErrAcceptances] = useState<string | null>(null);
  const [errPolicy, setErrPolicy] = useState<string | null>(null);
  const [errVehicles, setErrVehicles] = useState<string | null>(null);
  const [errSchedule, setErrSchedule] = useState<string | null>(null);
  const { user } = useAuth();
  const padre = user?.role === 'PADRE';
  const docente = user?.role === 'DOCENTE';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErrAcceptances(null);
      setErrPolicy(null);
      setErrVehicles(null);
      setErrSchedule(null);
      setPolicyHint(null);
      setScheduleHint(null);
      try {
        const acc = await api.get('/api/v1/privacy/me/acceptances');
        if (!cancelled) setPrivacy(acc.data);
      } catch (e) {
        if (!cancelled) setErrAcceptances(getUserFacingMessage(e));
      }
      try {
        const pol = await api.get('/api/v1/privacy/policy/latest');
        if (!cancelled) setPolicy(pol.data);
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          if (!cancelled) {
            setPolicy(null);
            setPolicyHint('La institución aún no ha publicado el texto de política en el sistema.');
          }
        } else if (!cancelled) {
          setErrPolicy(getUserFacingMessage(e));
        }
      }
      try {
        if (padre) {
          const v = await api.get('/api/v1/parents/vehicles');
          if (!cancelled) setVehicles(v.data);
        }
      } catch (e) {
        if (!cancelled) setErrVehicles(getUserFacingMessage(e));
      }
      try {
        if (docente) {
          const s = await api.get('/api/v1/schedules/me/teacher');
          if (!cancelled) setSchedule(s.data);
        }
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 403) {
          if (!cancelled) {
            setSchedule(null);
            setScheduleHint('No hay perfil docente asociado a esta cuenta. Contacte a secretaría.');
          }
        } else if (!cancelled) {
          setErrSchedule(getUserFacingMessage(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [padre, docente]);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Herramientas</h1>
        <p className="mt-1 text-sm text-slate-600">
          Privacidad, horarios y vehículos según su perfil. Para importar o exportar archivos use el apartado
          correspondiente en el menú.
        </p>
      </div>
      <Panel title="Política de privacidad vigente" description="Texto institucional y tratamiento de datos.">
        {errPolicy && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{errPolicy}</div>
        )}
        {policyHint && <p className="mb-4 text-sm text-slate-600">{policyHint}</p>}
        <ValueView data={policy} />
      </Panel>
      <Panel title="Mis aceptaciones de privacidad">
        {errAcceptances && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {errAcceptances}
          </div>
        )}
        <ValueView data={privacy} />
      </Panel>
      {padre && (
        <Panel title="Vehículos registrados" description="Vehículos dados de alta para el circuito de recogida.">
          {errVehicles && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{errVehicles}</div>
          )}
          <ValueView data={vehicles} />
        </Panel>
      )}
      {docente && (
        <Panel title="Mis franjas de horario" description="Horario asignado en el sistema.">
          {errSchedule && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{errSchedule}</div>
          )}
          {scheduleHint && <p className="mb-4 text-sm text-amber-800">{scheduleHint}</p>}
          <ValueView data={schedule} />
        </Panel>
      )}
      <Panel title="Acceso al plantel">
        <p className="text-sm leading-relaxed text-slate-600">
          Su credencial QR de campus está en <strong>Mi perfil</strong>. El personal autorizado puede registrar
          ingresos en <strong>Escáner de acceso</strong>.
        </p>
      </Panel>
    </div>
  );
}

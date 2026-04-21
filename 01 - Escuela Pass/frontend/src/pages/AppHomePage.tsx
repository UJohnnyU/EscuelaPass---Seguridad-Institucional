import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminDashboardPanel } from '@/components/admin/AdminDashboardPanel';
import { useAuth } from '@/context/useAuth';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { publicAssetUrl } from '@/lib/asset-url';

type UnknownObj = Record<string, unknown>;

function extractArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as UnknownObj;
    for (const key of ['data', 'items', 'results', 'rows']) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

function firstName(name?: string | null) {
  if (!name) return '';
  return name.trim().split(/\s+/)[0] ?? '';
}

function formatISO(dateStr?: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('es', opts ?? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function Card({
  title,
  subtitle,
  to,
  children,
  accent
}: {
  title: string;
  subtitle?: string;
  to?: string;
  children: React.ReactNode;
  accent?: 'slate' | 'emerald' | 'amber' | 'indigo' | 'rose';
}) {
  const accents: Record<string, string> = {
    slate: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-400/40 dark:bg-emerald-900/30',
    amber: 'border-amber-200 bg-amber-50/30 dark:border-amber-400/40 dark:bg-amber-900/30',
    indigo: 'border-indigo-200 bg-indigo-50/30 dark:border-indigo-400/40 dark:bg-indigo-900/30',
    rose: 'border-rose-200 bg-rose-50/30 dark:border-rose-400/40 dark:bg-rose-900/30'
  };
  return (
    <section className={`flex flex-col rounded-2xl border p-5 shadow-sm ${accents[accent ?? 'slate']}`}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-base font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {to ? (
          <Link
            to={to}
            className="shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:border-slate-400"
          >
            Abrir
          </Link>
        ) : null}
      </header>
      <div className="flex-1 text-sm text-slate-700">{children}</div>
    </section>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-900 ${tone ?? ''}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

// --- Home: Alumno -----------------------------------------------------------

type StudentActivity = {
  id: string;
  title: string;
  subjectName?: string;
  groupName?: string;
  dueDate?: string | null;
  status?: string;
  myScore?: string | number | null;
  maxScore?: string | number | null;
  period?: string;
};

type Notification = {
  id: string;
  title?: string;
  message?: string;
  createdAt?: string;
  readAt?: string | null;
};

type ReportCard = {
  id: string;
  schoolYear: string;
  type: string;
  publishedAt?: string | null;
  overallAverage?: string | number | null;
};

function HomeAlumno() {
  const [activities, setActivities] = useState<StudentActivity[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [act, notif, rc] = await Promise.all([
          api.get('/api/v1/activities/student/me').catch(() => ({ data: [] })),
          api.get('/api/v1/notifications/me?limit=6').catch(() => ({ data: [] })),
          api.get('/api/v1/report-cards/me').catch(() => ({ data: [] }))
        ]);
        if (cancelled) return;
        setActivities(extractArray<StudentActivity>(act.data));
        setNotifications(extractArray<Notification>(notif.data));
        setReportCards(extractArray<ReportCard>(rc.data));
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const latestGraded = useMemo(() => {
    return activities
      .filter((a) => a.myScore !== null && a.myScore !== undefined && a.myScore !== '')
      .slice(0, 5);
  }, [activities]);

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return activities
      .filter((a) => !a.myScore && a.dueDate && a.dueDate >= today)
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
      .slice(0, 4);
  }, [activities]);

  const latestReportCards = useMemo(() => reportCards.slice(0, 3), [reportCards]);
  const latestNotifs = useMemo(() => notifications.slice(0, 5), [notifications]);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {err ? (
        <div className="md:col-span-2 xl:col-span-3 rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {err}
        </div>
      ) : null}
      <Card title="Últimas calificaciones" to="/app/modulos/mis-calificaciones" accent="emerald">
        {latestGraded.length === 0 ? (
          <p className="text-slate-500">Aún no hay notas publicadas.</p>
        ) : (
          <ul className="space-y-2">
            {latestGraded.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{a.title}</p>
                  <p className="truncate text-xs text-slate-500">
                    {a.subjectName} · {a.period ?? ''}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  {a.myScore}
                  {a.maxScore ? `/${a.maxScore}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Próximas entregas" to="/app/modulos/mis-calificaciones" accent="amber">
        {upcoming.length === 0 ? (
          <p className="text-slate-500">Nada urgente por entregar.</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((a) => (
              <li key={a.id} className="rounded-lg bg-white px-3 py-2 text-sm">
                <p className="truncate font-medium text-slate-900">{a.title}</p>
                <p className="text-xs text-slate-500">
                  {a.subjectName} · entrega {formatISO(a.dueDate, { day: '2-digit', month: 'short' })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Mis boletines" to="/app/modulos/boletines" accent="indigo">
        {latestReportCards.length === 0 ? (
          <p className="text-slate-500">Los boletines aparecerán al cerrar cada periodo.</p>
        ) : (
          <ul className="space-y-2">
            {latestReportCards.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900">
                    {r.type === 'FINAL' ? `Boletín final ${r.schoolYear}` : `Periodo ${r.schoolYear}`}
                  </p>
                  <p className="text-xs text-slate-500">
                    Publicado {formatISO(r.publishedAt, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                {r.overallAverage ? (
                  <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800">
                    {Number(r.overallAverage).toFixed(2)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Notificaciones recientes" to="/app/modulos/comunicacion" accent="slate">
        {latestNotifs.length === 0 ? (
          <p className="text-slate-500">Aún no hay avisos recientes.</p>
        ) : (
          <ul className="space-y-2">
            {latestNotifs.map((n) => (
              <li key={n.id} className="rounded-lg bg-white px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium text-slate-900">{n.title ?? 'Aviso'}</p>
                  {!n.readAt ? <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-label="nueva" /> : null}
                </div>
                <p className="truncate text-xs text-slate-500">{n.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// --- Home: Padre ------------------------------------------------------------

type ChildAttendanceSummary = {
  studentId: string;
  studentName: string;
  matricula?: string;
  records?: Array<{ status: string; attendanceDate: string }>;
  summary?: { PRESENTE?: number; AUSENTE?: number; RETARDO?: number };
};

type Debt = {
  id: string;
  concept?: string;
  amount?: string | number;
  dueDate?: string;
  status?: string;
};

type Meeting = {
  id: string;
  title: string;
  startAt: string;
  status?: string;
  purpose?: string | null;
};

function HomePadre() {
  const [children, setChildren] = useState<ChildAttendanceSummary[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [att, deb, mts, notif] = await Promise.all([
          api.get('/api/v1/attendance/parent/my-children').catch(() => ({ data: { children: [] } })),
          api.get('/api/v1/payments/debts/mine').catch(() => ({ data: [] })),
          api.get('/api/v1/meetings/me').catch(() => ({ data: [] })),
          api.get('/api/v1/notifications/me?limit=6').catch(() => ({ data: [] }))
        ]);
        if (cancelled) return;
        const kids = (att.data as UnknownObj)?.children;
        setChildren(Array.isArray(kids) ? (kids as ChildAttendanceSummary[]) : []);
        setDebts(extractArray<Debt>(deb.data));
        setMeetings(extractArray<Meeting>(mts.data));
        setNotifications(extractArray<Notification>(notif.data));
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingDebts = useMemo(() => debts.filter((d) => (d.status ?? 'PENDIENTE') !== 'PAGADO'), [debts]);
  const upcomingMeetings = useMemo(() => {
    const now = new Date().toISOString();
    return meetings
      .filter((m) => m.startAt >= now && m.status !== 'CANCELADA')
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, 3);
  }, [meetings]);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {err ? (
        <div className="md:col-span-2 xl:col-span-3 rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {err}
        </div>
      ) : null}

      <Card title="Mis hijos — últimos 30 días" to="/app/modulos/academico" accent="emerald">
        {children.length === 0 ? (
          <p className="text-slate-500">No tiene hijos vinculados a su cuenta.</p>
        ) : (
          <ul className="space-y-3">
            {children.slice(0, 3).map((c) => {
              const s = c.summary ?? {};
              const total = (s.PRESENTE ?? 0) + (s.AUSENTE ?? 0) + (s.RETARDO ?? 0);
              const attPct = total > 0 ? Math.round(((s.PRESENTE ?? 0) * 100) / total) : 0;
              return (
                <li key={c.studentId} className="rounded-lg bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-slate-900">{c.studentName}</p>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      {attPct}% asistencia
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Presentes {s.PRESENTE ?? 0} · Faltas {s.AUSENTE ?? 0} · Retardos {s.RETARDO ?? 0}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Pagos pendientes" to="/app/modulos/finanzas" accent="amber">
        {pendingDebts.length === 0 ? (
          <p className="text-slate-500">Sin pagos pendientes.</p>
        ) : (
          <ul className="space-y-2">
            {pendingDebts.slice(0, 4).map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{d.concept ?? 'Concepto'}</p>
                  <p className="text-xs text-slate-500">
                    Vence {formatISO(d.dueDate, { day: '2-digit', month: 'short' })}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-amber-700">${Number(d.amount ?? 0).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Próximas reuniones" to="/app/modulos/reuniones" accent="indigo">
        {upcomingMeetings.length === 0 ? (
          <p className="text-slate-500">No hay reuniones programadas próximamente.</p>
        ) : (
          <ul className="space-y-2">
            {upcomingMeetings.map((m) => (
              <li key={m.id} className="rounded-lg bg-white px-3 py-2 text-sm">
                <p className="truncate font-medium text-slate-900">{m.title}</p>
                <p className="text-xs text-slate-500">{formatISO(m.startAt, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                {m.purpose ? <p className="mt-0.5 truncate text-xs text-slate-500">{m.purpose}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Notificaciones recientes" to="/app/modulos/comunicacion" accent="slate">
        {notifications.length === 0 ? (
          <p className="text-slate-500">Sin avisos recientes.</p>
        ) : (
          <ul className="space-y-2">
            {notifications.slice(0, 5).map((n) => (
              <li key={n.id} className="rounded-lg bg-white px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium text-slate-900">{n.title ?? 'Aviso'}</p>
                  {!n.readAt ? <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" /> : null}
                </div>
                <p className="truncate text-xs text-slate-500">{n.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// --- Home: Docente ----------------------------------------------------------

type TeacherAssignment = {
  groupId: string;
  groupName: string;
  subjectId: string;
  subjectName: string;
};

function HomeDocente() {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [asg, mts, notif] = await Promise.all([
          api.get('/api/v1/activities/teacher/my-assignments').catch(() => ({ data: [] })),
          api.get('/api/v1/meetings/me').catch(() => ({ data: [] })),
          api.get('/api/v1/notifications/me?limit=6').catch(() => ({ data: [] }))
        ]);
        if (cancelled) return;
        setAssignments(extractArray<TeacherAssignment>(asg.data));
        setMeetings(extractArray<Meeting>(mts.data));
        setNotifications(extractArray<Notification>(notif.data));
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const todayAndTomorrow = useMemo(() => {
    const from = new Date();
    const to = new Date(from);
    to.setDate(to.getDate() + 2);
    return meetings
      .filter((m) => {
        const t = new Date(m.startAt);
        return t >= from && t < to && m.status !== 'CANCELADA';
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [meetings]);

  const uniqueGroups = useMemo(() => {
    const seen = new Map<string, TeacherAssignment>();
    for (const a of assignments) if (!seen.has(a.groupId)) seen.set(a.groupId, a);
    return Array.from(seen.values()).slice(0, 6);
  }, [assignments]);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {err ? (
        <div className="md:col-span-2 xl:col-span-3 rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {err}
        </div>
      ) : null}

      <Card title="Reuniones de hoy y mañana" to="/app/modulos/reuniones" accent="indigo">
        {todayAndTomorrow.length === 0 ? (
          <p className="text-slate-500">Sin reuniones programadas en las próximas 48 h.</p>
        ) : (
          <ul className="space-y-2">
            {todayAndTomorrow.map((m) => (
              <li key={m.id} className="rounded-lg bg-white px-3 py-2 text-sm">
                <p className="truncate font-medium text-slate-900">{m.title}</p>
                <p className="text-xs text-slate-500">{formatISO(m.startAt, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Mis grupos y materias" to="/app/modulos/calificaciones-docente" accent="emerald">
        {uniqueGroups.length === 0 ? (
          <p className="text-slate-500">Aún no tiene grupos asignados.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {uniqueGroups.map((g) => (
              <li key={`${g.groupId}-${g.subjectId}`} className="rounded-lg bg-white px-3 py-2 text-sm">
                <p className="truncate font-medium text-slate-900">{g.groupName}</p>
                <p className="truncate text-xs text-slate-500">{g.subjectName}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Acceso rápido" accent="slate">
        <div className="grid grid-cols-2 gap-2">
          <Link to="/app/circuito/hoy" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-300">
            Circuito de hoy
          </Link>
          <Link to="/app/modulos/anotaciones-docente" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-300">
            Anotaciones
          </Link>
          <Link to="/app/modulos/academico" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-300">
            Asistencia
          </Link>
          <Link to="/app/horario" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-300">
            Mi horario
          </Link>
        </div>
      </Card>

      <Card title="Notificaciones recientes" to="/app/modulos/comunicacion" accent="slate">
        {notifications.length === 0 ? (
          <p className="text-slate-500">Sin avisos recientes.</p>
        ) : (
          <ul className="space-y-2">
            {notifications.slice(0, 5).map((n) => (
              <li key={n.id} className="rounded-lg bg-white px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium text-slate-900">{n.title ?? 'Aviso'}</p>
                  {!n.readAt ? <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" /> : null}
                </div>
                <p className="truncate text-xs text-slate-500">{n.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// --- Home: Admin / Administrativo -------------------------------------------

function HomeInstitutional() {
  return (
    <div className="mt-2">
      <AdminDashboardPanel />
    </div>
  );
}

// --- Dispatcher -------------------------------------------------------------

export function AppHomePage() {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const institutional = role === 'ADMIN' || role === 'ADMINISTRATIVO';

  const todayLong = useMemo(
    () =>
      new Date().toLocaleDateString('es', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }),
    []
  );

  const intro = useMemo(() => {
    if (role === 'ALUMNO')
      return 'Este es el resumen de tu vida escolar: calificaciones, entregas, boletines y avisos.';
    if (role === 'PADRE')
      return 'Un vistazo al día a día de sus hijos: asistencia, pagos, reuniones y avisos.';
    if (role === 'DOCENTE')
      return 'Sus reuniones del día, los grupos y materias a su cargo, y los avisos recientes.';
    if (institutional) return 'Aquí tiene el pulso operativo de su plantel: accesos, circuito, pagos y más.';
    return 'Este es su punto de partida; abra cualquier opción del menú lateral para entrar.';
  }, [role, institutional]);

  const avatarSrc = publicAssetUrl(user?.avatarUrl ?? null);
  const first = firstName(user?.fullName ?? '');

  return (
    <div className="mx-auto max-w-6xl animate-fade-in">
      <header className="flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-slate-900">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
              {first ? first.slice(0, 2).toUpperCase() : '?'}
            </div>
          )}
        </div>
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Hola{first ? `, ${first}` : ''}
          </h1>
          <p className="mt-0.5 text-sm capitalize text-slate-500">{todayLong}</p>
        </div>
      </header>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">{intro}</p>

      <div className="mt-8">
        {role === 'ALUMNO' ? <HomeAlumno /> : null}
        {role === 'PADRE' ? <HomePadre /> : null}
        {role === 'DOCENTE' ? <HomeDocente /> : null}
        {institutional ? <HomeInstitutional /> : null}
      </div>
    </div>
  );
}

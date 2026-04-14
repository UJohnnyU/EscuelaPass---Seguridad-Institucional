import { useEffect, useMemo, useState } from 'react';
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
  const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
  const weekRangeISO = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  };
  type ParentScheduleSlot = {
    id: string;
    weekday: number;
    startTime: string;
    endTime: string;
    room: string | null;
    subjectName: string | null;
  };
  type ParentScheduleChild = {
    studentId: string;
    studentName: string;
    groupId: string | null;
    group: { id: string; name: string | null; grade: string | null; schoolYear: string | null } | null;
    slots: ParentScheduleSlot[];
  };
  type ParentCalendarChild = {
    studentId: string;
    studentName: string;
    groupId: string | null;
    days: Array<{ id: string; exceptionDate: string; reason: string | null }>;
  };
  const [att, setAtt] = useState<unknown>(null);
  const [grades, setGrades] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const [downloadingPeriod, setDownloadingPeriod] = useState<string | null>(null);
  const [downloadingChildBulletin, setDownloadingChildBulletin] = useState<string | null>(null);
  const [childrenSchedule, setChildrenSchedule] = useState<ParentScheduleChild[] | null>(null);
  const [childrenCalendar, setChildrenCalendar] = useState<ParentCalendarChild[] | null>(null);
  const [childrenNotifications, setChildrenNotifications] = useState<unknown>(null);
  const [attentionNotes, setAttentionNotes] = useState<unknown>(null);
  const [myNotifications, setMyNotifications] = useState<unknown>(null);
  const [meetings, setMeetings] = useState<unknown>(null);
  const { user } = useAuth();
  const padre = user?.role === 'PADRE';
  const alumno = user?.role === 'ALUMNO';
  const { from, to } = useMemo(() => weekRangeISO(), []);
  const studentGrades = Array.isArray(grades) ? (grades as Array<{ period?: string | null }>) : [];
  const periods = Array.from(
    new Set(studentGrades.map((g) => (g.period ?? '').trim()).filter((p) => p.length > 0))
  ).sort((a, b) => b.localeCompare(a));
  const parentBulletinTargets = useMemo(() => {
    if (!padre || !Array.isArray(grades)) return [];
    type ParentGradeRow = { studentId?: string; period?: string | null };
    const rows = grades as ParentGradeRow[];
    const map = new Map<string, Set<string>>();
    for (const row of rows) {
      const studentId = row.studentId;
      if (!studentId) continue;
      if (!map.has(studentId)) map.set(studentId, new Set<string>());
      const p = (row.period ?? '').trim();
      if (p) map.get(studentId)?.add(p);
    }
    const nameByStudent = new Map<string, string>();
    for (const c of childrenSchedule ?? []) {
      nameByStudent.set(c.studentId, c.studentName);
    }
    for (const c of childrenCalendar ?? []) {
      if (!nameByStudent.has(c.studentId)) nameByStudent.set(c.studentId, c.studentName);
    }
    return [...map.entries()].map(([studentId, periodsSet]) => ({
      studentId,
      studentName: nameByStudent.get(studentId) ?? `Estudiante ${studentId.slice(0, 8)}`,
      periods: [...periodsSet].sort((a, b) => b.localeCompare(a))
    }));
  }, [padre, grades, childrenSchedule, childrenCalendar]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        if (padre) {
          const [a, g, s, c, childNotifs, alerts, mineNotifs, m] = await Promise.all([
            api.get('/api/v1/attendance/parent/my-children'),
            api.get('/api/v1/grades/parent/my-children'),
            api.get<{ children: ParentScheduleChild[] }>('/api/v1/schedules/parent/my-children'),
            api.get<{ children: ParentCalendarChild[] }>(
              `/api/v1/calendar/parent/my-children?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
            ),
            api.get('/api/v1/notifications/parent/my-children?limit=25'),
            api.get('/api/v1/attention-notes/parent/my-children'),
            api.get('/api/v1/notifications/me?limit=25'),
            api.get('/api/v1/meetings/me')
          ]);
          if (!cancelled) {
            setAtt(a.data);
            setGrades(g.data);
            setChildrenSchedule(s.data.children ?? []);
            setChildrenCalendar(c.data.children ?? []);
            setChildrenNotifications(childNotifs.data);
            setAttentionNotes(alerts.data);
            setMyNotifications(mineNotifs.data);
            setMeetings(m.data);
          }
        }
        if (alumno) {
          const g = await api.get('/api/v1/grades/me/student');
          if (!cancelled) {
            setAtt(null);
            setGrades(g.data);
            setChildrenSchedule(null);
            setChildrenCalendar(null);
            setChildrenNotifications(null);
            setAttentionNotes(null);
            setMyNotifications(null);
            setMeetings(null);
          }
        }
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [padre, alumno, from, to]);

  const downloadBulletin = async (period?: string) => {
    try {
      setErr(null);
      setDownloadingPeriod(period ?? '__all__');
      const query = period ? `?period=${encodeURIComponent(period)}` : '';
      const res = await api.get(`/api/v1/documents/bulletin/me/student${query}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = period ? `boletin-${period}.pdf` : 'boletin-completo.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setDownloadingPeriod(null);
    }
  };

  const downloadChildBulletin = async (studentId: string, studentName: string, period?: string) => {
    try {
      setErr(null);
      setDownloadingChildBulletin(`${studentId}:${period ?? '__all__'}`);
      const query = period ? `?period=${encodeURIComponent(period)}` : '';
      const res = await api.get(`/api/v1/documents/bulletin/${studentId}${query}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const safeName = studentName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
      a.download = period ? `boletin-${safeName}-${period}.pdf` : `boletin-${safeName}-completo.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setDownloadingChildBulletin(null);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Académico</h1>
        <p className="mt-1 text-sm text-slate-600">
          {padre
            ? 'Asistencia y calificaciones de los estudiantes vinculados a su cuenta.'
            : alumno
              ? 'Revise sus calificaciones y descargue boletines del período actual o anteriores.'
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
          <Panel
            title="Boletines de sus hijos (incluye anteriores)"
            description="Descargue el boletín completo o por período académico para cada hijo."
          >
            {parentBulletinTargets.length === 0 ? (
              <p className="text-sm text-slate-600">Aún no hay períodos de calificaciones disponibles para descargar.</p>
            ) : (
              <div className="space-y-4">
                {parentBulletinTargets.map((target) => (
                  <div key={target.studentId} className="rounded border border-slate-200 bg-white p-4">
                    <p className="font-medium text-slate-900">{target.studentName}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void downloadChildBulletin(target.studentId, target.studentName)}
                        disabled={downloadingChildBulletin !== null}
                        className="rounded border border-slate-900 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {downloadingChildBulletin === `${target.studentId}:__all__`
                          ? 'Generando…'
                          : 'Boletín completo'}
                      </button>
                      {target.periods.map((period) => (
                        <button
                          key={`${target.studentId}-${period}`}
                          type="button"
                          onClick={() => void downloadChildBulletin(target.studentId, target.studentName, period)}
                          disabled={downloadingChildBulletin !== null}
                          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {downloadingChildBulletin === `${target.studentId}:${period}`
                            ? `Generando ${period}…`
                            : `Boletín ${period}`}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Horarios semanales de sus hijos">
            {!childrenSchedule || childrenSchedule.length === 0 ? (
              <p className="text-sm text-slate-600">No hay estudiantes vinculados a su cuenta.</p>
            ) : (
              <div className="space-y-5">
                {childrenSchedule.map((child) => {
                  const byDay = new Map<number, ParentScheduleSlot[]>();
                  for (const slot of child.slots ?? []) {
                    const list = byDay.get(slot.weekday) ?? [];
                    list.push(slot);
                    byDay.set(slot.weekday, list);
                  }
                  for (const wd of WEEKDAY_ORDER) {
                    const rows = byDay.get(wd);
                    if (rows) rows.sort((a, b) => a.startTime.localeCompare(b.startTime));
                  }
                  return (
                    <div key={child.studentId} className="rounded border border-slate-200 bg-white p-4">
                      <p className="font-semibold text-slate-900">{child.studentName}</p>
                      {child.group ? (
                        <p className="mt-1 text-xs text-slate-600">
                          Grupo {child.group.name ?? '—'} · {child.group.grade ?? '—'} · {child.group.schoolYear ?? '—'}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-amber-800">Sin grupo asignado.</p>
                      )}
                      {child.slots.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-600">No hay franjas horarias registradas.</p>
                      ) : (
                        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                          <table className="min-w-full border-collapse text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="px-3 py-2 font-semibold text-slate-700">Día</th>
                                <th className="px-3 py-2 font-semibold text-slate-700">Horario</th>
                                <th className="px-3 py-2 font-semibold text-slate-700">Materia</th>
                                <th className="px-3 py-2 font-semibold text-slate-700">Aula</th>
                              </tr>
                            </thead>
                            <tbody>
                              {WEEKDAY_ORDER.flatMap((wd) => {
                                const rows = byDay.get(wd) ?? [];
                                if (rows.length === 0) return [];
                                return rows.map((slot, i) => (
                                  <tr key={slot.id} className="border-b border-slate-100">
                                    {i === 0 ? (
                                      <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800" rowSpan={rows.length}>
                                        {WEEKDAY_SHORT[wd]}
                                      </td>
                                    ) : null}
                                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                                      {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
                                    </td>
                                    <td className="px-3 py-2 text-slate-800">{slot.subjectName ?? '—'}</td>
                                    <td className="px-3 py-2 text-slate-600">{slot.room ?? '—'}</td>
                                  </tr>
                                ));
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
          <Panel title="Eventos de sus hijos (calendario semanal)">
            <ValueView data={childrenCalendar} />
          </Panel>
          <Panel title="Avisos notificados para sus hijos">
            <ValueView data={childrenNotifications} />
          </Panel>
          <Panel title="Anotaciones y llamados de atención de sus hijos">
            <ValueView data={attentionNotes} />
          </Panel>
          <Panel title="Sus avisos personales">
            <ValueView data={myNotifications} />
          </Panel>
          <Panel title="Reuniones con docentes">
            <ValueView data={meetings} />
          </Panel>
        </>
      ) : alumno ? (
        <>
          <Panel title="Mis calificaciones">
            <ValueView data={grades} />
          </Panel>
          <Panel
            title="Boletines PDF"
            description="Puede descargar su boletín completo o por cada período disponible."
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void downloadBulletin()}
                disabled={downloadingPeriod !== null}
                className="rounded border border-slate-900 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {downloadingPeriod === '__all__' ? 'Generando…' : 'Boletín completo'}
              </button>
              {periods.map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => void downloadBulletin(period)}
                  disabled={downloadingPeriod !== null}
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloadingPeriod === period ? `Generando ${period}…` : `Boletín ${period}`}
                </button>
              ))}
            </div>
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

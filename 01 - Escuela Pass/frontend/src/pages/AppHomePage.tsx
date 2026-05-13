import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminDashboardPanel } from '@/components/admin/AdminDashboardPanel';
import { AuthImage } from '@/components/AuthImage';
import { DetailModal } from '@/components/DetailModal';
import { useAuth } from '@/context/useAuth';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { openProtectedFile } from '@/lib/protected-files';
import { useAdaptivePolling } from '@/hooks/use-adaptive-polling';

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

/** Pastilla de nota: verde (alta) → rojo (baja), según score/maxScore (si no hay max, se asume 10). */
function gradeScoreBadgeClass(
  myScore: string | number | null | undefined,
  maxScore: string | number | null | undefined
): string {
  const score = typeof myScore === 'string' ? parseFloat(myScore) : Number(myScore);
  if (!Number.isFinite(score)) {
    return 'bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600';
  }
  let max = typeof maxScore === 'string' ? parseFloat(maxScore) : Number(maxScore);
  if (!Number.isFinite(max) || max <= 0) max = 10;
  const ratio = Math.max(0, Math.min(1, score / max));
  if (ratio >= 0.98) {
    return 'bg-emerald-100 text-emerald-900 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-700/50';
  }
  if (ratio >= 0.9) {
    return 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700/50';
  }
  if (ratio >= 0.75) {
    return 'bg-sky-100 text-sky-900 border border-sky-200 dark:bg-sky-900/40 dark:text-sky-100 dark:border-sky-700/50';
  }
  if (ratio >= 0.6) {
    return 'bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700/50';
  }
  if (ratio >= 0.4) {
    return 'bg-orange-100 text-orange-900 border border-orange-200 dark:bg-orange-900/40 dark:text-orange-100 dark:border-orange-700/50';
  }
  return 'bg-rose-100 text-rose-900 border border-rose-200 dark:bg-rose-900/40 dark:text-rose-100 dark:border-rose-700/50';
}

function activityHasPublishedScore(a: { myScore?: string | number | null }): boolean {
  const s = a.myScore;
  if (s === null || s === undefined) return false;
  if (typeof s === 'string' && s.trim() === '') return false;
  return true;
}

/** Días hasta la fecha límite (calendario local); negativo = vencida; sin fecha válida → null */
function daysUntilDueYmd(dueYmd: string | null | undefined): number | null {
  if (!dueYmd || !/^\d{4}-\d{2}-\d{2}/.test(dueYmd)) return null;
  const parts = dueYmd.slice(0, 10).split('-').map(Number);
  const [yy, mm, dd] = parts;
  if (!yy || !mm || !dd) return null;
  const due = new Date(yy, mm - 1, dd);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

/** Fecha límite YYYY-MM-DD mostrada en día calendario local (sin desfase UTC). */
function formatDueDateLocalYmd(dueYmd: string | null | undefined): string {
  if (!dueYmd || !/^\d{4}-\d{2}-\d{2}/.test(dueYmd)) return '—';
  const [yy, mm, dd] = dueYmd.slice(0, 10).split('-').map(Number);
  if (!yy || !mm || !dd) return '—';
  const d = new Date(yy, mm - 1, dd);
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

type DueUrgency = {
  emoji: string;
  message: string;
  rowClass: string;
  bandClass: string;
};

/** Mensaje y estilo según cercanía de la entrega (cualquier tipo de actividad). */
function dueDateUrgency(dueYmd: string | null | undefined): DueUrgency {
  const d = daysUntilDueYmd(dueYmd);
  if (d === null) {
    return {
      emoji: '📌',
      message:
        'Sin fecha límite en el sistema — confirma en clase o con tu docente cuándo debes entregar o presentar el trabajo.',
      rowClass: 'rounded-lg border-l-4 border-slate-300 bg-slate-50/90 dark:border-slate-500 dark:bg-slate-800/50',
      bandClass: 'text-slate-700 dark:text-slate-200'
    };
  }
  if (d < 0) {
    return {
      emoji: '🆘',
      message:
        'La fecha límite ya pasó y aún no aparece calificación. Entrega cuanto antes o consulta con tu docente.',
      rowClass: 'rounded-lg border-l-4 border-red-600 bg-red-50/95 dark:border-red-500 dark:bg-red-950/40',
      bandClass: 'text-red-900 dark:text-red-100'
    };
  }
  if (d === 0) {
    return {
      emoji: '🔥',
      message: 'Vence hoy: prioridad máxima. Revisa el enunciado y deja todo listo con tiempo.',
      rowClass: 'rounded-lg border-l-4 border-rose-500 bg-rose-50/95 dark:border-rose-400 dark:bg-rose-950/35',
      bandClass: 'text-rose-900 font-medium dark:text-rose-100'
    };
  }
  if (d === 1) {
    return {
      emoji: '⚡',
      message: 'Vence mañana: organiza hoy tu tiempo y avanza lo antes posible.',
      rowClass: 'rounded-lg border-l-4 border-orange-500 bg-orange-50/90 dark:border-orange-400 dark:bg-orange-950/30',
      bandClass: 'text-orange-900 font-medium dark:text-orange-100'
    };
  }
  if (d < 3) {
    return {
      emoji: '🚨',
      message: `Quedan ${d} días: es muy poco tiempo; evita dejarlo para el último momento.`,
      rowClass: 'rounded-lg border-l-4 border-amber-500 bg-amber-50/90 dark:border-amber-400 dark:bg-amber-950/30',
      bandClass: 'text-amber-950 font-medium dark:text-amber-100'
    };
  }
  if (d < 7) {
    return {
      emoji: '⏰',
      message: 'Vence esta semana: adelanta lo que puedas y reparte el trabajo día a día.',
      rowClass: 'rounded-lg border-l-4 border-amber-400 bg-amber-50/60 dark:border-amber-500/60 dark:bg-amber-950/20',
      bandClass: 'text-amber-900 dark:text-amber-100'
    };
  }
  if (d < 14) {
    return {
      emoji: '📅',
      message: 'Tienes alrededor de una o dos semanas: planifica y aprovecha para hacerlo con calma y bien.',
      rowClass: 'rounded-lg border-l-4 border-sky-400 bg-sky-50/70 dark:border-sky-500 dark:bg-sky-950/30',
      bandClass: 'text-sky-900 dark:text-sky-100'
    };
  }
  return {
    emoji: '🌱',
    message:
      'Aún tienes tiempo: úsalo bien — investiga, repasa y entrega un trabajo completo; no lo dejes para el final.',
    rowClass: 'rounded-lg border-l-4 border-emerald-400 bg-emerald-50/65 dark:border-emerald-500 dark:bg-emerald-950/25',
    bandClass: 'text-emerald-900 dark:text-emerald-100'
  };
}

function Card({
  title,
  subtitle,
  to,
  children,
  accent,
  ctaLabel
}: {
  title: string;
  subtitle?: string;
  to?: string;
  children: React.ReactNode;
  accent?: 'slate' | 'emerald' | 'amber' | 'indigo' | 'rose';
  ctaLabel?: string;
}) {
  const accents: Record<string, string> = {
    slate: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-400/40 dark:bg-emerald-900/30',
    amber: 'border-amber-200 bg-amber-50/30 dark:border-amber-400/40 dark:bg-amber-900/30',
    indigo: 'border-indigo-200 bg-indigo-50/30 dark:border-indigo-400/40 dark:bg-indigo-900/30',
    rose: 'border-rose-200 bg-rose-50/30 dark:border-rose-400/40 dark:bg-rose-900/30'
  };
  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border p-5 shadow-sm ${accents[accent ?? 'slate']}`}>
      <header className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h2 className="break-words font-serif text-base font-semibold leading-tight text-slate-900">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 break-words text-xs text-slate-500 [overflow-wrap:anywhere]">{subtitle}</p>
          ) : null}
        </div>
        {to ? (
          <Link
            to={to}
            className="self-start rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:border-slate-400 sm:shrink-0"
          >
            {ctaLabel ?? 'Abrir'}
          </Link>
        ) : null}
      </header>
      <div className="min-w-0 flex-1 text-sm text-slate-700">{children}</div>
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
  closedAt?: string | null;
  publishedAt?: string | null;
};

/** Solo hoy o futuras: fecha más cercana primero; sin fecha al final. */
function compareUpcomingNonOverdue(a: StudentActivity, b: StudentActivity): number {
  const daysA = daysUntilDueYmd(a.dueDate);
  const daysB = daysUntilDueYmd(b.dueDate);
  const da = a.dueDate?.slice(0, 10) ?? '';
  const db = b.dueDate?.slice(0, 10) ?? '';

  if (daysA === null && daysB === null) return (a.title ?? '').localeCompare(b.title ?? '', 'es');
  if (daysA === null) return 1;
  if (daysB === null) return -1;
  return da.localeCompare(db);
}

type Notification = {
  id: string;
  title?: string;
  message?: string;
  createdAt?: string;
  readAt?: string | null;
};

type OperationalSummary = {
  entities?: {
    students?: number;
    teachers?: number;
    groups?: number;
    usersActive?: number;
    usersByRole?: Record<string, number>;
  };
  attendanceToday?: { total?: number; byStatus?: Record<string, number> };
  payments?: { pendingDebts?: number; overdueDebts?: number; pendingWithVoucher?: number };
  circuitToday?: { total?: number; byStatus?: Record<string, number> };
  accessToday?: { total?: number; byType?: Record<string, number> };
};

type AdminPanelApiPayload = {
  window?: { label?: string; startDate?: string; endDate?: string };
  summary?: OperationalSummary;
  comparison?: {
    currentWindow?: { startDate?: string; endDate?: string; label?: string };
    previousWindow?: { startDate?: string; endDate?: string; label?: string };
    metrics?: {
      attendanceRecords?: { current?: number; previous?: number; delta?: number; deltaPct?: number };
      accessEvents?: { current?: number; previous?: number; delta?: number; deltaPct?: number };
      circuitRequests?: { current?: number; previous?: number; delta?: number; deltaPct?: number };
    };
  };
  circuits?: { byDay?: Array<{ date: string; total: number }> };
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
          api.get('/api/v1/report-cards/student/me').catch(() => ({ data: [] }))
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
      .filter((a) => activityHasPublishedScore(a))
      .sort((a, b) => {
        const tb = (b.closedAt ?? b.publishedAt ?? '') as string;
        const ta = (a.closedAt ?? a.publishedAt ?? '') as string;
        const byDate = tb.localeCompare(ta);
        if (byDate !== 0) return byDate;
        return (b.id ?? '').localeCompare(a.id ?? '');
      })
      .slice(0, 5);
  }, [activities]);

  const upcoming = useMemo(() => {
    return activities
      .filter((a) => !activityHasPublishedScore(a))
      .filter((a) => {
        const d = daysUntilDueYmd(a.dueDate);
        if (d === null) return true;
        return d >= 0;
      })
      .sort(compareUpcomingNonOverdue)
      .slice(0, 18);
  }, [activities]);

  const latestReportCards = useMemo(() => reportCards.slice(0, 3), [reportCards]);
  const latestNotifs = useMemo(() => notifications.slice(0, 5), [notifications]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {err ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 md:col-span-3">
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
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${gradeScoreBadgeClass(a.myScore, a.maxScore)}`}
                  >
                    {a.myScore}
                    {a.maxScore ? `/${a.maxScore}` : ''}
                  </span>
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

      <div className="min-w-0">
        <Card
          title="Próximas entregas"
          subtitle="De un vistazo, lo que tienes por entregar sin calificar: arriba lo que vence antes, para organizarte mejor."
          to="/app/modulos/mis-calificaciones"
          accent="amber"
        >
          {upcoming.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400">
              No tienes actividades pendientes sin calificar. Cuando tu docente asigne trabajo nuevo, aparecerá aquí con la
              fecha límite y un recordatorio según el tiempo que quede.
            </p>
          ) : (
            <div className="max-h-[min(70vh,32rem)] overflow-y-auto overflow-x-hidden pr-1">
              <ul className="flex flex-col gap-3">
                {upcoming.map((a) => {
                  const u = dueDateUrgency(a.dueDate);
                  return (
                    <li
                      key={a.id}
                      className={`flex w-full flex-col gap-3 px-3 py-3 text-sm sm:flex-row sm:items-center sm:gap-4 ${u.rowClass}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{a.title}</p>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                          {a.subjectName}
                          {a.dueDate
                            ? ` · entrega ${formatDueDateLocalYmd(a.dueDate)}`
                            : ' · sin fecha límite en el sistema'}
                        </p>
                      </div>
                      <p
                        className={`min-w-0 text-xs font-medium leading-snug sm:basis-[38%] sm:text-center sm:text-sm ${u.bandClass}`}
                      >
                        {u.message}
                      </p>
                      <div
                        className="flex shrink-0 items-center justify-center self-start text-2xl sm:w-14 sm:self-center sm:text-3xl"
                        aria-hidden
                      >
                        {u.emoji}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// --- Home: Padre ------------------------------------------------------------

type ChildAttendanceSummary = {
  studentId: string;
  studentName: string;
  matricula?: string;
  avatarUrl?: string | null;
  group?: { name?: string | null; grade?: string | null; schoolYear?: string | null };
  records?: Array<{ status: string; attendanceDate: string }>;
  summary?: { presente?: number; ausente?: number; retardo?: number; total?: number };
};

type Debt = {
  id: string;
  concept?: string;
  conceptName?: string;
  conceptDescription?: string | null;
  description?: string | null;
  studentName?: string | null;
  amount?: string | number;
  dueDate?: string;
  status?: string;
  voucherPath?: string | null;
  uploadedAt?: string | null;
  verifiedAt?: string | null;
  /** Motivo cuando la institución no acepta el comprobante */
  notes?: string | null;
};

type Meeting = {
  id: string;
  title: string;
  startAt: string;
  status?: string;
  purpose?: string | null;
  modality?: string | null;
  location?: string | null;
  meetingLink?: string | null;
  durationMinutes?: number | null;
  organizerName?: string | null;
};

type ParentActivity = {
  id: string;
  title: string;
  subjectName?: string;
  groupName?: string | null;
  grade?: string | null;
  schoolYear?: string | null;
  studentId?: string;
  studentName?: string;
  myScore?: string | number | null;
  maxScore?: string | number | null;
  myNotes?: string | null;
  closedAt?: string | null;
  publishedAt?: string | null;
  periodName?: string | null;
  period?: string;
  dueDate?: string | null;
};

type ParentAttentionNote = {
  id: string;
  studentName?: string;
  title: string;
  severity?: 'LEVE' | 'MODERADA' | 'GRAVE' | string;
  createdAt?: string;
  description?: string;
  occurredAt?: string;
  createdByName?: string;
  matricula?: string;
};

function meetingModalityLabel(m?: string | null) {
  const u = (m ?? '').toUpperCase();
  if (u === 'PRESENCIAL') return 'Presencial';
  if (u === 'VIRTUAL') return 'Virtual';
  if (u === 'HIBRIDO' || u === 'HÍBRIDO') return 'Híbrido';
  return m?.trim() || '—';
}

function meetingStatusLabel(st?: string | null) {
  const u = (st ?? '').toUpperCase();
  if (u === 'PROGRAMADA') return 'Programada';
  if (u === 'REPROGRAMADA') return 'Reprogramada';
  if (u === 'REALIZADA') return 'Realizada';
  if (u === 'CANCELADA') return 'Cancelada';
  return st ?? '—';
}

function attendanceStatusLabel(status?: string | null) {
  const normalized = String(status ?? '').toUpperCase();
  if (normalized === 'PRESENTE') return 'Presente';
  if (normalized === 'RETARDO') return 'Retardo';
  if (normalized === 'AUSENTE') return 'Ausente';
  return 'Sin registro';
}

function attendanceStatusClass(status?: string | null) {
  const normalized = String(status ?? '').toUpperCase();
  if (normalized === 'PRESENTE') return 'bg-emerald-100 text-emerald-800';
  if (normalized === 'RETARDO') return 'bg-amber-100 text-amber-900';
  if (normalized === 'AUSENTE') return 'bg-rose-100 text-rose-900';
  return 'bg-slate-100 text-slate-700';
}

function HomePadre() {
  const [children, setChildren] = useState<ChildAttendanceSummary[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [grades, setGrades] = useState<ParentActivity[]>([]);
  const [attentionNotes, setAttentionNotes] = useState<ParentAttentionNote[]>([]);
  const [openDebt, setOpenDebt] = useState<Debt | null>(null);
  const [openGrade, setOpenGrade] = useState<ParentActivity | null>(null);
  const [openMeeting, setOpenMeeting] = useState<Meeting | null>(null);
  const [openNote, setOpenNote] = useState<ParentAttentionNote | null>(null);
  const [openChildAttendance, setOpenChildAttendance] = useState<ChildAttendanceSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadParentHome = useCallback(async (signal?: AbortSignal) => {
    try {
      const [att, deb, mts, notif, gr, notes] = await Promise.all([
        api.get('/api/v1/attendance/parent/my-children', { signal }).catch(() => ({ data: { children: [] } })),
        api.get('/api/v1/payments/debts/mine', { signal }).catch(() => ({ data: [] })),
        api.get('/api/v1/meetings/me', { signal }).catch(() => ({ data: [] })),
        api.get('/api/v1/notifications/me?limit=6', { signal }).catch(() => ({ data: [] })),
        api.get('/api/v1/activities/parent/my-children', { signal }).catch(() => ({ data: [] })),
        api.get('/api/v1/attention-notes/parent/my-children', { signal }).catch(() => ({ data: [] }))
      ]);
      const kids = (att.data as UnknownObj)?.children;
      setChildren(Array.isArray(kids) ? (kids as ChildAttendanceSummary[]) : []);
      setDebts(extractArray<Debt>(deb.data));
      setMeetings(extractArray<Meeting>(mts.data));
      setNotifications(extractArray<Notification>(notif.data));
      setGrades(extractArray<ParentActivity>(gr.data));
      setAttentionNotes(extractArray<ParentAttentionNote>(notes.data));
      setErr(null);
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  }, []);

  useEffect(() => {
    void loadParentHome();
  }, [loadParentHome]);

  useAdaptivePolling({
    enabled: true,
    intervalFocused: 60000,
    intervalBlurred: 300000,
    onPoll: async ({ signal }) => {
      await loadParentHome(signal);
    }
  });

  const debtStatusInfo = (d: Debt) => {
    const st = (d.status ?? '').toUpperCase();
    const due = d.dueDate ? new Date(d.dueDate) : null;
    const isOverdue =
      st === 'VENCIDO' ||
      (!!due && !Number.isNaN(due.getTime()) && due.getTime() < Date.now() && st !== 'COMPROBANTE_RECHAZADO');
    if (st === 'PAGADO') {
      return { label: 'Pagado', cls: 'bg-emerald-100 text-emerald-800', overdue: false };
    }
    if (st === 'COMPROBANTE_RECHAZADO') {
      return { label: 'Comprobante no aceptado', cls: 'bg-rose-100 text-rose-900', overdue: false };
    }
    if (isOverdue) {
      return { label: 'Vencido', cls: 'bg-red-100 text-red-800', overdue: true };
    }
    return { label: 'Pendiente', cls: 'bg-amber-100 text-amber-900', overdue: false };
  };
  const debtBuckets = useMemo(() => {
    const pagados: Debt[] = [];
    const pendientes: Debt[] = [];
    const vencidos: Debt[] = [];
    for (const debt of debts) {
      const info = debtStatusInfo(debt);
      if (info.label === 'Pagado') {
        pagados.push(debt);
      } else if (info.overdue) {
        vencidos.push(debt);
      } else {
        pendientes.push(debt);
      }
    }
    return { pagados, pendientes, vencidos };
  }, [debts]);
  const upcomingMeetings = useMemo(() => {
    const now = new Date().toISOString();
    return meetings
      .filter((m) => m.startAt >= now && m.status !== 'CANCELADA')
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, 3);
  }, [meetings]);
  const recentGrades = useMemo(
    () =>
      grades
        .filter((g) => g.myScore !== null && g.myScore !== undefined && g.myScore !== '')
        .sort((a, b) => {
          const tb = (b.closedAt ?? b.publishedAt ?? '') as string;
          const ta = (a.closedAt ?? a.publishedAt ?? '') as string;
          const byDate = tb.localeCompare(ta);
          if (byDate !== 0) return byDate;
          return (b.id ?? '').localeCompare(a.id ?? '');
        })
        .slice(0, 5),
    [grades]
  );
  const recentNotes = useMemo(
    () =>
      attentionNotes
        .slice()
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
        .slice(0, 5),
    [attentionNotes]
  );
  const childrenCurrentAttendance = useMemo(
    () =>
      children
        .map((c) => {
          const latest = [...(c.records ?? [])].sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate))[0];
          return { ...c, currentStatus: latest?.status ?? null, currentAttendanceDate: latest?.attendanceDate ?? null };
        })
        .sort((a, b) => a.studentName.localeCompare(b.studentName)),
    [children]
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {err ? (
        <div className="md:col-span-2 xl:col-span-3 rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {err}
        </div>
      ) : null}

      <Card title="Mis hijos — estado actual de asistencia" to="/app/modulos/academico" accent="emerald">
        {childrenCurrentAttendance.length === 0 ? (
          <p className="text-slate-500">No tiene hijos vinculados a su cuenta.</p>
        ) : (
          <ul className="space-y-3">
            {childrenCurrentAttendance.slice(0, 4).map((c) => {
              return (
                <li key={c.studentId}>
                  <button
                    type="button"
                    onClick={() => setOpenChildAttendance(c)}
                    className="w-full rounded-lg bg-white px-3 py-2 text-left transition hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-slate-900">{c.studentName}</p>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${attendanceStatusClass(c.currentStatus)}`}
                      >
                        {attendanceStatusLabel(c.currentStatus)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {c.matricula ? `Matrícula ${c.matricula} · ` : ''}
                      {c.currentAttendanceDate
                        ? `Actualizado: ${formatISO(c.currentAttendanceDate, {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}`
                        : 'Aún no hay asistencia registrada'}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <DetailModal
        open={openChildAttendance !== null}
        title={openChildAttendance?.studentName ?? 'Asistencia del alumno'}
        subtitle={openChildAttendance?.matricula ? `Matrícula: ${openChildAttendance.matricula}` : undefined}
        badge={
          openChildAttendance ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${attendanceStatusClass(
                [...(openChildAttendance.records ?? [])].sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate))[0]
                  ?.status
              )}`}
            >
              {attendanceStatusLabel(
                [...(openChildAttendance.records ?? [])].sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate))[0]
                  ?.status
              )}
            </span>
          ) : null
        }
        onClose={() => setOpenChildAttendance(null)}
        footer={
          <Link
            to="/app/modulos/academico"
            onClick={() => setOpenChildAttendance(null)}
            className="rounded-lg border border-brand-800 bg-white px-4 py-2 text-sm font-medium text-brand-900 hover:bg-slate-50"
          >
            Ver asistencia completa
          </Link>
        }
      >
        {openChildAttendance ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-slate-200">
                {openChildAttendance.avatarUrl ? (
                  <AuthImage
                    src={openChildAttendance.avatarUrl}
                    alt={openChildAttendance.studentName}
                    className="h-full w-full object-cover"
                    fallback={
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-600">
                        {firstName(openChildAttendance.studentName).slice(0, 2).toUpperCase() || 'AL'}
                      </div>
                    }
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-600">
                    {firstName(openChildAttendance.studentName).slice(0, 2).toUpperCase() || 'AL'}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{openChildAttendance.studentName}</p>
                <p className="truncate text-xs text-slate-500">
                  {openChildAttendance.group?.name ? `${openChildAttendance.group.name} · ` : ''}
                  {openChildAttendance.group?.grade ? `${openChildAttendance.group.grade} · ` : ''}
                  {openChildAttendance.group?.schoolYear ?? 'Sin grupo asignado'}
                </p>
              </div>
            </div>
            {openChildAttendance.records && openChildAttendance.records.length > 0 ? (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                {[...openChildAttendance.records]
                  .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate))
                  .slice(0, 5)
                  .map((r, idx) => (
                    <li key={`${r.attendanceDate}-${idx}`} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-slate-700">
                        {formatISO(r.attendanceDate, { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${attendanceStatusClass(r.status)}`}>
                        {attendanceStatusLabel(r.status)}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Aún no hay asistencias registradas para este alumno.</p>
            )}
          </div>
        ) : null}
      </DetailModal>

      <Card title="Mis pagos" to="/app/modulos/finanzas" accent="amber">
        {debts.length === 0 ? <p className="text-slate-500">Sin registros de pagos.</p> : null}
        <div className="space-y-3">
          {[
            { key: 'pendientes', title: 'Pendientes', rows: debtBuckets.pendientes },
            { key: 'vencidos', title: 'Vencidos', rows: debtBuckets.vencidos },
            { key: 'pagados', title: 'Pagados', rows: debtBuckets.pagados }
          ].map((section) => (
            <div key={section.key} className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">{section.title}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  {section.rows.length}
                </span>
              </div>
              {section.rows.length === 0 ? (
                <p className="px-3 py-3 text-xs text-slate-500">No hay pagos en esta categoría.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {section.rows.slice(0, 6).map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setOpenDebt(d)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium text-slate-900">{d.conceptName ?? d.concept ?? 'Concepto'}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${debtStatusInfo(d).cls}`}>
                              {debtStatusInfo(d).label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Vence {formatISO(d.dueDate, { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-amber-700">${Number(d.amount ?? 0).toFixed(2)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Card>
      <DetailModal
        open={openDebt !== null}
        title={openDebt?.conceptName ?? openDebt?.concept ?? 'Detalle de cobro'}
        subtitle={openDebt?.studentName ? `Alumno: ${openDebt.studentName}` : undefined}
        badge={
          openDebt ? (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${debtStatusInfo(openDebt).cls}`}>
              {debtStatusInfo(openDebt).label}
            </span>
          ) : null
        }
        onClose={() => setOpenDebt(null)}
      >
        {openDebt ? (
          <div className="space-y-4">
            <p className="whitespace-pre-line text-slate-800">
              {openDebt.description ?? openDebt.conceptDescription ?? 'Sin descripción adicional.'}
            </p>
            <dl className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-semibold uppercase tracking-widest text-slate-500">Importe</dt>
                <dd className="mt-0.5 text-base font-semibold text-slate-900">${Number(openDebt.amount ?? 0).toFixed(2)}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-widest text-slate-500">Vencimiento</dt>
                <dd className="mt-0.5 text-slate-900">{formatISO(openDebt.dueDate, { day: '2-digit', month: 'short', year: 'numeric' })}</dd>
              </div>
              {openDebt.uploadedAt ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Comprobante subido</dt>
                  <dd className="mt-0.5 text-slate-900">{formatISO(openDebt.uploadedAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd>
                </div>
              ) : null}
              {openDebt.verifiedAt ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Comprobante verificado</dt>
                  <dd className="mt-0.5 text-slate-900">{formatISO(openDebt.verifiedAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd>
                </div>
              ) : null}
            </dl>
            {(openDebt.status ?? '').toUpperCase() === 'COMPROBANTE_RECHAZADO' && openDebt.notes ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                <p className="font-semibold">Indicación de la institución</p>
                <p className="mt-1 whitespace-pre-line">{openDebt.notes}</p>
              </div>
            ) : null}
            {openDebt.voucherPath ? (
              <p className="text-xs">
                <button
                  type="button"
                  onClick={() => {
                    void openProtectedFile(openDebt.voucherPath!).catch((e) =>
                      setErr(getUserFacingMessage(e, 'No se pudo abrir el comprobante.'))
                    );
                  }}
                  className="font-medium text-brand-800 underline"
                >
                  Ver comprobante cargado
                </button>
              </p>
            ) : null}
          </div>
        ) : null}
      </DetailModal>

      <DetailModal
        open={openGrade !== null}
        title={openGrade?.title ?? 'Calificación'}
        subtitle={
          openGrade
            ? [openGrade.studentName ?? 'Alumno', openGrade.subjectName ?? 'Materia'].filter(Boolean).join(' · ')
            : undefined
        }
        badge={
          openGrade ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${gradeScoreBadgeClass(openGrade.myScore, openGrade.maxScore)}`}
            >
              {openGrade.myScore}
              {openGrade.maxScore ? `/${openGrade.maxScore}` : ''}
            </span>
          ) : null
        }
        onClose={() => setOpenGrade(null)}
        footer={
          <Link
            to="/app/modulos/mis-calificaciones"
            onClick={() => setOpenGrade(null)}
            className="rounded-lg border border-brand-800 bg-white px-4 py-2 text-sm font-medium text-brand-900 hover:bg-slate-50"
          >
            Ver todas en actividades y notas
          </Link>
        }
      >
        {openGrade ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-semibold uppercase tracking-widest text-slate-500">Periodo</dt>
                <dd className="mt-0.5 text-slate-900">{openGrade.periodName ?? openGrade.period ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-widest text-slate-500">Grupo</dt>
                <dd className="mt-0.5 text-slate-900">
                  {[openGrade.groupName, openGrade.grade, openGrade.schoolYear].filter(Boolean).join(' · ') || '—'}
                </dd>
              </div>
              {openGrade.dueDate ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Fecha de entrega</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {formatISO(openGrade.dueDate, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </dd>
                </div>
              ) : null}
              {openGrade.closedAt ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Publicada / cerrada</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {formatISO(openGrade.closedAt, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </dd>
                </div>
              ) : null}
            </dl>
            {openGrade.myNotes?.trim() ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Observación del docente</p>
                <p className="mt-1 whitespace-pre-line text-slate-800">{openGrade.myNotes}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </DetailModal>

      <DetailModal
        open={openMeeting !== null}
        title={openMeeting?.title ?? 'Reunión'}
        subtitle={
          openMeeting
            ? formatISO(openMeeting.startAt, {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : undefined
        }
        badge={
          openMeeting ? (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-900">
              {meetingStatusLabel(openMeeting.status)}
            </span>
          ) : null
        }
        onClose={() => setOpenMeeting(null)}
        footer={
          <Link
            to="/app/modulos/reuniones"
            onClick={() => setOpenMeeting(null)}
            className="rounded-lg border border-indigo-800 bg-white px-4 py-2 text-sm font-medium text-indigo-900 hover:bg-slate-50"
          >
            Ir a reuniones
          </Link>
        }
      >
        {openMeeting ? (
          <div className="space-y-4">
            {openMeeting.purpose ? (
              <p className="whitespace-pre-line text-slate-800">{openMeeting.purpose}</p>
            ) : (
              <p className="text-slate-500">Sin descripción adicional.</p>
            )}
            <dl className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-semibold uppercase tracking-widest text-slate-500">Modalidad</dt>
                <dd className="mt-0.5 text-slate-900">{meetingModalityLabel(openMeeting.modality)}</dd>
              </div>
              {openMeeting.durationMinutes != null ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Duración</dt>
                  <dd className="mt-0.5 text-slate-900">{openMeeting.durationMinutes} min</dd>
                </div>
              ) : null}
              {openMeeting.organizerName ? (
                <div className="sm:col-span-2">
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Organiza</dt>
                  <dd className="mt-0.5 text-slate-900">{openMeeting.organizerName}</dd>
                </div>
              ) : null}
              {openMeeting.location ? (
                <div className="sm:col-span-2">
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Lugar</dt>
                  <dd className="mt-0.5 text-slate-900">{openMeeting.location}</dd>
                </div>
              ) : null}
              {openMeeting.meetingLink ? (
                <div className="sm:col-span-2">
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Enlace</dt>
                  <dd className="mt-0.5">
                    <a
                      href={openMeeting.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-brand-800 underline break-all"
                    >
                      {openMeeting.meetingLink}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </DetailModal>

      <DetailModal
        open={openNote !== null}
        title={openNote?.title ?? 'Anotación'}
        subtitle={
          openNote
            ? [openNote.studentName ?? 'Alumno', openNote.matricula].filter(Boolean).join(' · ')
            : undefined
        }
        badge={
          openNote?.severity ? (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-800">
              {openNote.severity}
            </span>
          ) : null
        }
        onClose={() => setOpenNote(null)}
        footer={
          <Link
            to="/app/modulos/comunicacion"
            onClick={() => setOpenNote(null)}
            className="rounded-lg border border-rose-800 bg-white px-4 py-2 text-sm font-medium text-rose-900 hover:bg-slate-50"
          >
            Ir a comunicación
          </Link>
        }
      >
        {openNote ? (
          <div className="space-y-4">
            <p className="whitespace-pre-line text-slate-800">
              {openNote.description?.trim() ? openNote.description : 'Sin detalle adicional en el registro.'}
            </p>
            <dl className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2">
              {openNote.createdByName ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Registró</dt>
                  <dd className="mt-0.5 text-slate-900">{openNote.createdByName}</dd>
                </div>
              ) : null}
              {openNote.occurredAt ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Hecho o observado</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {formatISO(openNote.occurredAt, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </dd>
                </div>
              ) : null}
              {openNote.createdAt ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Registrado en sistema</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {formatISO(openNote.createdAt, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </DetailModal>

      <Card title="Próximas reuniones" to="/app/modulos/reuniones" accent="indigo">
        {upcomingMeetings.length === 0 ? (
          <p className="text-slate-500">No hay reuniones programadas próximamente.</p>
        ) : (
          <ul className="space-y-2">
            {upcomingMeetings.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setOpenMeeting(m)}
                  className="w-full rounded-lg bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-50"
                >
                  <p className="truncate font-medium text-slate-900">{m.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatISO(m.startAt, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {m.purpose ? <p className="mt-0.5 truncate text-xs text-slate-500">{m.purpose}</p> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Resumen de calificaciones" to="/app/modulos/mis-calificaciones" accent="emerald">
        {recentGrades.length === 0 ? (
          <p className="text-slate-500">Aún no hay calificaciones publicadas para sus hijos.</p>
        ) : (
          <ul className="space-y-2">
            {recentGrades.map((g) => (
              <li key={`${g.id}-${g.studentId ?? ''}`}>
                <button
                  type="button"
                  onClick={() => setOpenGrade(g)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{g.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      {g.studentName ?? 'Alumno'} · {g.subjectName ?? 'Materia'}
                      {g.periodName ? ` · ${g.periodName}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${gradeScoreBadgeClass(g.myScore, g.maxScore)}`}
                  >
                    {g.myScore}
                    {g.maxScore ? `/${g.maxScore}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Anotaciones recientes" to="/app/modulos/comunicacion" accent="rose">
        {recentNotes.length === 0 ? (
          <p className="text-slate-500">No hay anotaciones recientes para sus hijos.</p>
        ) : (
          <ul className="space-y-2">
            {recentNotes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setOpenNote(n)}
                  className="w-full rounded-lg bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-slate-900">{n.title}</p>
                    {n.severity ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                        {n.severity}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {n.studentName ?? 'Alumno'}
                    {n.createdAt ? ` · ${formatISO(n.createdAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                  </p>
                </button>
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
  grade?: string | null;
  schoolYear?: string | null;
  jornada?: string | null;
  shiftName?: string | null;
  journey?: string | null;
};

type TeacherActivity = {
  id: string;
  groupId: string;
  subjectId: string;
  dueDate?: string | null;
  status?: 'OPEN' | 'CLOSED' | string;
  gradedCount?: number;
  rosterCount?: number;
};

function HomeDocente() {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [activities, setActivities] = useState<TeacherActivity[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const loadTeacherHome = useCallback(async (signal?: AbortSignal) => {
    try {
      const [asg, act, mts, notif] = await Promise.all([
        api.get('/api/v1/activities/teacher/my-assignments', { signal }).catch(() => ({ data: [] })),
        api.get('/api/v1/activities', { signal }).catch(() => ({ data: [] })),
        api.get('/api/v1/meetings/me', { signal }).catch(() => ({ data: [] })),
        api.get('/api/v1/notifications/me?limit=6', { signal }).catch(() => ({ data: [] }))
      ]);
      setAssignments(extractArray<TeacherAssignment>(asg.data));
      setActivities(extractArray<TeacherActivity>(act.data));
      setMeetings(extractArray<Meeting>(mts.data));
      setNotifications(extractArray<Notification>(notif.data));
      setErr(null);
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  }, []);

  useEffect(() => {
    void loadTeacherHome();
  }, [loadTeacherHome]);

  useAdaptivePolling({
    enabled: true,
    intervalFocused: 60000,
    intervalBlurred: 300000,
    onPoll: async ({ signal }) => {
      await loadTeacherHome(signal);
    }
  });

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

  const groupsWithDetails = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        groupId: string;
        groupName: string;
        grade?: string | null;
        schoolYear?: string | null;
        jornada?: string | null;
        subjects: string[];
        assignmentKeys: string[];
      }
    >();

    for (const a of assignments) {
      const current = groupsMap.get(a.groupId);
      const jornada = a.jornada ?? a.shiftName ?? a.journey ?? null;
      if (!current) {
        groupsMap.set(a.groupId, {
          groupId: a.groupId,
          groupName: a.groupName,
          grade: a.grade ?? null,
          schoolYear: a.schoolYear ?? null,
          jornada,
          subjects: [a.subjectName],
          assignmentKeys: [`${a.groupId}::${a.subjectId}`]
        });
        continue;
      }
      if (!current.subjects.includes(a.subjectName)) current.subjects.push(a.subjectName);
      const assignmentKey = `${a.groupId}::${a.subjectId}`;
      if (!current.assignmentKeys.includes(assignmentKey)) current.assignmentKeys.push(assignmentKey);
      if (!current.jornada && jornada) current.jornada = jornada;
      if (!current.grade && a.grade) current.grade = a.grade;
      if (!current.schoolYear && a.schoolYear) current.schoolYear = a.schoolYear;
    }

    return Array.from(groupsMap.values())
      .map((g) => {
        const pending = activities.filter((act) => {
          if (act.groupId !== g.groupId) return false;
          if (act.status && act.status !== 'OPEN') return false;
          const roster = Number(act.rosterCount ?? 0);
          const graded = Number(act.gradedCount ?? 0);
          return Number.isFinite(roster) && Number.isFinite(graded) && roster > graded;
        });
        const nextDue = pending
          .map((p) => p.dueDate)
          .filter((d): d is string => Boolean(d))
          .sort((a, b) => a.localeCompare(b))[0];
        return {
          ...g,
          pendingToGrade: pending.length,
          nextDueDate: nextDue ?? null,
          primaryAssignmentKey: g.assignmentKeys[0] ?? ''
        };
      })
      .slice(0, 6);
  }, [assignments, activities]);

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

      <Card
        title="Mis grupos y materias"
        to="/app/modulos/calificaciones-docente"
        accent="emerald"
        ctaLabel="Actividades y notas"
      >
        {groupsWithDetails.length === 0 ? (
          <p className="text-slate-500">Aún no tiene grupos asignados.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {groupsWithDetails.map((g) => (
              <li key={g.groupId} className="rounded-lg bg-white px-3 py-2 text-sm">
                <p className="truncate font-medium text-slate-900">{g.groupName}</p>
                <p className="truncate text-xs text-slate-500">
                  {g.grade ? `${g.grade} · ` : ''}
                  {g.schoolYear ? `${g.schoolYear} · ` : ''}
                  {g.jornada ? `Jornada ${g.jornada}` : 'Jornada por definir'}
                </p>
                <p className="mt-1 truncate text-xs text-slate-600">
                  Materias: {g.subjects.slice(0, 2).join(', ')}
                  {g.subjects.length > 2 ? ` +${g.subjects.length - 2}` : ''}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Actividades por calificar: <span className="font-semibold text-slate-900">{g.pendingToGrade}</span>
                  {g.nextDueDate ? ` · Próxima fecha: ${formatISO(g.nextDueDate, { day: '2-digit', month: 'short' })}` : ''}
                </p>
                {g.primaryAssignmentKey ? (
                  <Link
                    to={`/app/modulos/calificaciones-docente?assignment=${encodeURIComponent(g.primaryAssignmentKey)}&status=OPEN`}
                    className="mt-2 inline-flex rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-400"
                  >
                    Actividades y notas
                  </Link>
                ) : null}
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

function HomePlatformAdmin() {
  const [windowDays, setWindowDays] = useState<7 | 15 | 30>(7);
  const [panel, setPanel] = useState<AdminPanelApiPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (panel) setRefreshing(true);
      else setLoading(true);
      setErr(null);
      try {
        const { data } = await api.get<AdminPanelApiPayload>('/api/v1/dashboard/panel', {
          params: { windowDays }
        });
        if (!cancelled) setPanel(data ?? null);
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e, 'No se pudo cargar el panel de administración.'));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [windowDays]);

  const summary = panel?.summary;
  const usersByRole = summary?.entities?.usersByRole ?? {};
  const circuitByDay = panel?.circuits?.byDay ?? [];
  const maxCircuitDay = Math.max(1, ...circuitByDay.map((d) => Number(d.total ?? 0)));
  /** Incluye gap-2 y padding horizontal del contenedor; evita que el fondo se corte al hacer scroll. */
  const nCircuitDays = circuitByDay.length;
  const circuitTrendChartWidthPx = Math.max(
    320,
    24 + nCircuitDays * 32 + Math.max(0, nCircuitDays - 1) * 8
  );

  const pendingVoucher = Number(summary?.payments?.pendingWithVoucher ?? 0);
  const overdueDebts = Number(summary?.payments?.overdueDebts ?? 0);
  const criticalAlerts = [pendingVoucher > 0, overdueDebts > 0].filter(Boolean).length;
  const comparison = panel?.comparison;
  const incidents = [
    {
      id: 'voucher-review',
      title: 'Comprobantes en cola de verificación',
      value: pendingVoucher,
      severity: pendingVoucher >= 20 ? 'ALTA' : pendingVoucher >= 8 ? 'MEDIA' : 'BAJA',
      hint: 'Riesgo de retraso en conciliación de pagos'
    },
    {
      id: 'debts-overdue',
      title: 'Deudas vencidas activas',
      value: overdueDebts,
      severity: overdueDebts >= 40 ? 'ALTA' : overdueDebts >= 15 ? 'MEDIA' : 'BAJA',
      hint: 'Implica presión financiera y gestión administrativa'
    }
  ].sort((a, b) => {
    const w = (s: string) => (s === 'ALTA' ? 3 : s === 'MEDIA' ? 2 : 1);
    return w(b.severity) - w(a.severity) || b.value - a.value;
  });
  const trendRows = [
    {
      key: 'attendance',
      label: 'Asistencias registradas',
      data: comparison?.metrics?.attendanceRecords
    },
    {
      key: 'access',
      label: 'Eventos de acceso',
      data: comparison?.metrics?.accessEvents
    },
    {
      key: 'circuit',
      label: 'Solicitudes de circuito',
      data: comparison?.metrics?.circuitRequests
    }
  ];

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden" aria-busy={refreshing || loading}>
      {/* Barra de progreso discreta para refrescos SWR */}
      <div
        className={`h-px w-full overflow-hidden transition-opacity duration-300 ${refreshing ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      >
        <div className="h-full w-1/2 animate-progress-bar bg-brand-500/70" />
      </div>
      {err ? (
        <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{err}</div>
      ) : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-slate-900 dark:text-slate-100">
              Centro de control de plataforma
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Vista ejecutiva para supervisar operación global, cuellos de botella y actividad institucional.
            </p>
            {panel?.window ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Ventana activa: {panel.window.label} ({panel.window.startDate} a {panel.window.endDate})
              </p>
            ) : null}
          </div>
          <div className="flex items-end gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <p className="mb-1 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Rango</p>
              <div className="flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
                {[7, 15, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setWindowDays(d as 7 | 15 | 30)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                      windowDays === d
                        ? 'bg-brand-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right dark:border-slate-700 dark:bg-slate-800">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Alertas críticas</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{criticalAlerts}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Usuarios activos" value={Number(summary?.entities?.usersActive ?? 0)} />
        <MiniStat label="Estudiantes" value={Number(summary?.entities?.students ?? 0)} />
        <MiniStat label="Docentes" value={Number(summary?.entities?.teachers ?? 0)} />
        <MiniStat label="Grupos activos" value={Number(summary?.entities?.groups ?? 0)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card title="Riesgos operativos" subtitle="Items que requieren seguimiento inmediato" accent="rose">
          <ul className="space-y-2">
            <li className="flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-slate-800">
              <span>Comprobantes por revisar</span>
              <strong>{pendingVoucher}</strong>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-slate-800">
              <span>Deudas vencidas</span>
              <strong>{overdueDebts}</strong>
            </li>
          </ul>
        </Card>

        <Card title="Distribución de usuarios" subtitle="Composición por rol en el sistema" accent="indigo">
          <ul className="space-y-2">
            {Object.entries(usersByRole)
              .sort((a, b) => Number(b[1]) - Number(a[1]))
              .slice(0, 5)
              .map(([role, total]) => (
                <li key={role} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-slate-800">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{role}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{Number(total)}</span>
                </li>
              ))}
          </ul>
        </Card>

        <Card title="Accesos rápidos" subtitle="Atajos a módulos de control estratégico" accent="slate">
          <div className="grid grid-cols-1 gap-2">
            <Link to="/app/modulos/administracion" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800">
              Administración e informes
            </Link>
            <Link to="/app/circuito/hoy" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800">
              Circuito del día
            </Link>
            <Link to="/app/modulos/comunicacion" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800">
              Comunicación institucional
            </Link>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card title={`Tendencia de circuito (${windowDays} días)`} subtitle="Solicitudes por día de la ventana actual" accent="emerald">
          {circuitByDay.length === 0 ? (
            <p className="text-slate-500">Sin datos disponibles.</p>
          ) : (
            <div className="mt-1 min-w-0 max-w-full overflow-x-auto">
              <div
                className="flex h-40 items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
                style={{ width: `${circuitTrendChartWidthPx}px` }}
              >
                {circuitByDay.map((d) => {
                  const total = Number(d.total ?? 0);
                  const h = Math.max(6, Math.round((total / maxCircuitDay) * 100));
                  return (
                    <div key={d.date} className="flex w-8 shrink-0 flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">{total}</span>
                      <div className="flex h-24 w-full items-end">
                        <div className="w-full rounded-t bg-emerald-500/90" style={{ height: `${h}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {formatISO(d.date, { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        <Card title="Actividad transversal" subtitle="Pulso global de operación diaria" accent="amber">
          <ul className="space-y-2">
            <li className="flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-slate-800">
              <span>Asistencias registradas hoy</span>
              <strong>{Number(summary?.attendanceToday?.total ?? 0)}</strong>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-slate-800">
              <span>Eventos de acceso hoy</span>
              <strong>{Number(summary?.accessToday?.total ?? 0)}</strong>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-slate-800">
              <span>Solicitudes de circuito hoy</span>
              <strong>{Number(summary?.circuitToday?.total ?? 0)}</strong>
            </li>
          </ul>
        </Card>
      </section>

      <Card
        title="Comparativo vs período anterior"
        subtitle={
          comparison?.previousWindow
            ? `${comparison.previousWindow.startDate} a ${comparison.previousWindow.endDate}`
            : 'Mismo tamaño de ventana inmediatamente anterior'
        }
        accent="indigo"
      >
        <ul className="space-y-2">
          {trendRows.map((row) => {
            const current = Number(row.data?.current ?? 0);
            const previous = Number(row.data?.previous ?? 0);
            const delta = Number(row.data?.delta ?? current - previous);
            const pct = Number(row.data?.deltaPct ?? 0);
            const up = delta > 0;
            const down = delta < 0;
            return (
              <li key={row.key} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{row.label}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      up
                        ? 'bg-emerald-100 text-emerald-900'
                        : down
                          ? 'bg-rose-100 text-rose-900'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {up ? '▲' : down ? '▼' : '•'} {delta >= 0 ? '+' : ''}
                    {delta} ({pct >= 0 ? '+' : ''}
                    {pct.toFixed(2)}%)
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  Actual: {current} · Anterior: {previous}
                </p>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Incidentes recientes priorizados" subtitle="Clasificación automática por impacto operativo" accent="slate">
        <ul className="space-y-2">
          {incidents.map((inc) => (
            <li key={inc.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{inc.title}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    inc.severity === 'ALTA'
                      ? 'bg-rose-100 text-rose-900'
                      : inc.severity === 'MEDIA'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-emerald-100 text-emerald-900'
                  }`}
                >
                  {inc.severity}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{inc.hint}</p>
              <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">Registros: {inc.value}</p>
            </li>
          ))}
        </ul>
      </Card>

      {loading && !panel ? (
        <p className="text-sm text-slate-500">Cargando panel ejecutivo…</p>
      ) : null}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {refreshing ? 'Actualizando métricas…' : ''}
      </p>
    </div>
  );
}

// --- Dispatcher -------------------------------------------------------------

export function AppHomePage() {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const institutional = role === 'ADMIN' || role === 'ADMINISTRATIVO';
  const isPlatformAdmin = role === 'ADMIN';

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
    if (role === 'ADMIN')
      return 'Vista ejecutiva de plataforma: métricas globales, alertas priorizadas y control transversal del sistema.';
    if (institutional) return 'Aquí tiene el pulso operativo de su plantel: accesos, circuito, pagos y más.';
    return 'Este es su punto de partida; abra cualquier opción del menú lateral para entrar.';
  }, [role, institutional]);

  const first = firstName(user?.fullName ?? '');

  return (
    <div className="mx-auto max-w-6xl min-w-0 overflow-x-hidden animate-fade-in">
      <header className="flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-slate-900">
          {user?.avatarUrl ? (
            <AuthImage
              src={user.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
              fallback={
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                  {first ? first.slice(0, 2).toUpperCase() : '?'}
                </div>
              }
            />
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
        {isPlatformAdmin ? <HomePlatformAdmin /> : null}
        {role === 'ADMINISTRATIVO' ? <HomeInstitutional /> : null}
      </div>
    </div>
  );
}

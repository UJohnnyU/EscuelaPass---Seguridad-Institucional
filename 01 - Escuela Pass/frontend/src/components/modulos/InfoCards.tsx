import { type ReactNode, useMemo } from 'react';

export type Notification = {
  id: string;
  title: string;
  message: string;
  sentAt: string | Date;
  readAt?: string | Date | null;
  studentName?: string | null;
  deliveryStatus?: string | null;
};

export type Notice = {
  id: string;
  title: string;
  content: string;
  createdAt: string | Date;
  isImportant?: boolean;
  expiresAt?: string | Date | null;
  targetType?: 'ALL' | 'GROUP' | 'USER';
};

export type PaymentConcept = {
  id: string;
  name: string;
  description?: string | null;
  defaultAmount: string;
  isActive?: boolean;
  isRecurring?: boolean;
  recurrencePeriod?: string | null;
};

export type Debt = {
  id: string;
  studentId: string;
  studentName?: string | null;
  conceptId: string;
  conceptName?: string | null;
  conceptDescription?: string | null;
  amount: string;
  dueDate: string;
  status: 'PENDIENTE' | 'PAGADO' | 'VENCIDO';
  description?: string | null;
  voucherPath?: string | null;
  uploadedAt?: string | null;
  verifiedAt?: string | null;
};

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  try {
    const dt = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

const fmtDateTime = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  try {
    const dt = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
};

const fmtCurrency = (v: string | number) => {
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });
};

const fmtRelative = (d: string | Date | null | undefined) => {
  if (!d) return '';
  try {
    const dt = typeof d === 'string' ? new Date(d) : d;
    const diffMs = dt.getTime() - Date.now();
    const diffMin = Math.round(diffMs / 60000);
    const abs = Math.abs(diffMin);
    if (abs < 60) return diffMin >= 0 ? `en ${abs} min` : `hace ${abs} min`;
    const diffH = Math.round(diffMin / 60);
    const absH = Math.abs(diffH);
    if (absH < 24) return diffH >= 0 ? `en ${absH} h` : `hace ${absH} h`;
    const diffD = Math.round(diffH / 24);
    const absD = Math.abs(diffD);
    if (absD < 30) return diffD >= 0 ? `en ${absD} d` : `hace ${absD} d`;
    return fmtDate(d);
  } catch {
    return '';
  }
};

function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
      {icon ? (
        <div className="mb-3 text-slate-400">{icon}</div>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mb-3 h-9 w-9 text-slate-300"
          aria-hidden
        >
          <path d="M9 11h6M9 15h4" />
          <rect x="3" y="4" width="18" height="16" rx="2" />
        </svg>
      )}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function unwrapList<T>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data === 'object' && data !== null && 'data' in data) {
    const inner = (data as { data: unknown }).data;
    return Array.isArray(inner) ? (inner as T[]) : [];
  }
  return [];
}

/* ------------------------------ Notifications ----------------------------- */

export function NotificationsList({
  data,
  emptyTitle = 'Aún no tienes notificaciones',
  emptyHint = 'Cuando la escuela te envíe un aviso aparecerá aquí.'
}: {
  data: unknown;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const items = useMemo(() => unwrapList<Notification>(data), [data]);
  if (items.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} />;

  return (
    <ul className="space-y-3">
      {items.map((n) => {
        const isUnread = !n.readAt;
        return (
          <li
            key={n.id}
            className={`relative rounded-lg border p-4 transition ${
              isUnread ? 'border-brand-200 bg-brand-50/40' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {isUnread && (
                    <span
                      className="inline-flex h-2 w-2 rounded-full bg-brand-700"
                      aria-label="No leído"
                    />
                  )}
                  <h3 className="font-medium text-slate-900">{n.title}</h3>
                  {n.studentName && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      Para {n.studentName}
                    </span>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{n.message}</p>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                <p>{fmtDateTime(n.sentAt)}</p>
                <p className="text-slate-400">{fmtRelative(n.sentAt)}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* --------------------------------- Notices -------------------------------- */

export function NoticesList({ data }: { data: unknown }) {
  const items = useMemo(() => unwrapList<Notice>(data), [data]);
  if (items.length === 0) {
    return (
      <EmptyState
        title="Aún no se han publicado avisos"
        hint="Los comunicados que publique la escuela aparecerán aquí."
      />
    );
  }
  const labelTarget = (t?: 'ALL' | 'GROUP' | 'USER') => {
    if (t === 'GROUP') return 'Grupo';
    if (t === 'USER') return 'Personal';
    return 'Comunidad';
  };
  return (
    <ul className="space-y-3">
      {items.map((n) => (
        <li key={n.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-slate-900">{n.title}</h3>
                {n.isImportant && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                    Importante
                  </span>
                )}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {labelTarget(n.targetType)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{n.content}</p>
              {n.expiresAt && (
                <p className="mt-2 text-xs text-slate-500">Vigente hasta {fmtDate(n.expiresAt)}</p>
              )}
            </div>
            <div className="text-right text-[11px] text-slate-500">
              <p>{fmtDateTime(n.createdAt)}</p>
              <p className="text-slate-400">{fmtRelative(n.createdAt)}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------- Payment concepts --------------------------- */

export function PaymentConceptsList({ data }: { data: unknown }) {
  const items = useMemo(() => unwrapList<PaymentConcept>(data), [data]);
  if (items.length === 0) {
    return (
      <EmptyState
        title="No hay conceptos de cobro disponibles"
        hint="La administración del plantel publica aquí los pagos vigentes."
      />
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((c) => (
        <li
          key={c.id}
          className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-medium text-slate-900">{c.name}</h3>
            <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
              {fmtCurrency(c.defaultAmount)}
            </span>
          </div>
          {c.description && <p className="mt-1.5 text-sm text-slate-600">{c.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {c.isRecurring && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-800">
                Recurrente {c.recurrencePeriod ? `· ${c.recurrencePeriod}` : ''}
              </span>
            )}
            {c.isActive === false && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Inactivo</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------- Debts -------------------------------- */

function statusStyle(status: Debt['status'], isOverdue: boolean) {
  if (status === 'PAGADO') {
    return { label: 'Pagado', cls: 'bg-emerald-100 text-emerald-800' };
  }
  if (status === 'VENCIDO' || isOverdue) {
    return { label: 'Vencido', cls: 'bg-red-100 text-red-800' };
  }
  return { label: 'Pendiente', cls: 'bg-amber-100 text-amber-900' };
}

export function DebtsList({ data }: { data: unknown }) {
  const items = useMemo(() => unwrapList<Debt>(data), [data]);
  if (items.length === 0) {
    return (
      <EmptyState
        title="No tienes pagos pendientes"
        hint="¡Todo en orden! Cualquier nueva colegiatura o cobro aparecerá aquí."
      />
    );
  }
  const total = items
    .filter((d) => d.status !== 'PAGADO')
    .reduce((acc, d) => acc + (Number(d.amount) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
        <span className="text-sm text-slate-700">Total por pagar</span>
        <span className="text-xl font-semibold text-slate-900">{fmtCurrency(total)}</span>
      </div>
      <ul className="space-y-3">
        {items.map((d) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const due = new Date(d.dueDate);
          const isOverdue = !Number.isNaN(due.getTime()) && due < today && d.status !== 'PAGADO';
          const st = statusStyle(d.status, isOverdue);
          return (
            <li key={d.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-slate-900">{d.conceptName ?? 'Concepto de cobro'}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>
                  {d.studentName && (
                    <p className="mt-0.5 text-xs text-slate-500">Alumno: {d.studentName}</p>
                  )}
                  {d.description && (
                    <p className="mt-1 text-sm text-slate-700">{d.description}</p>
                  )}
                  <p className={`mt-2 text-xs ${isOverdue ? 'text-red-700' : 'text-slate-500'}`}>
                    Vence el {fmtDate(d.dueDate)}
                  </p>
                  {d.voucherPath && (
                    <p className="mt-1 text-xs text-emerald-700">
                      Comprobante cargado{d.uploadedAt ? ` · ${fmtDate(d.uploadedAt)}` : ''}
                      {d.verifiedAt ? ' · Verificado' : ' · Pendiente de verificación'}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-slate-900">{fmtCurrency(d.amount)}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------- Calendar -------------------------------- */

export type CalendarItem = {
  id?: string;
  exceptionDate?: string;
  date?: string;
  reason?: string | null;
};

export function NonInstructionalDaysList({ data }: { data: unknown }) {
  const raw = useMemo(() => {
    if (Array.isArray(data)) return data as Array<CalendarItem | { children?: unknown[]; days?: CalendarItem[] }>;
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.children)) return obj.children as Array<{ studentName: string; days?: CalendarItem[] }>;
      if (Array.isArray(obj.data)) return obj.data as CalendarItem[];
    }
    return [];
  }, [data]);

  const flat = useMemo(() => {
    const out: { id: string; date: string; reason: string | null; studentName?: string }[] = [];
    for (const it of raw as Array<Record<string, unknown>>) {
      if (Array.isArray((it as { days?: CalendarItem[] }).days)) {
        const studentName = (it as { studentName?: string }).studentName;
        for (const d of (it as { days: CalendarItem[] }).days) {
          out.push({
            id: d.id ?? `${studentName ?? ''}-${d.exceptionDate ?? d.date}`,
            date: d.exceptionDate ?? d.date ?? '',
            reason: d.reason ?? null,
            studentName
          });
        }
      } else {
        const d = it as CalendarItem;
        out.push({
          id: d.id ?? `${d.exceptionDate ?? d.date ?? ''}`,
          date: d.exceptionDate ?? d.date ?? '',
          reason: d.reason ?? null
        });
      }
    }
    return out
      .filter((x) => x.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [raw]);

  if (flat.length === 0) {
    return (
      <EmptyState
        title="No hay días sin clases registrados"
        hint="Cuando la escuela publique días feriados o suspensiones aparecerán aquí."
      />
    );
  }
  return (
    <ul className="space-y-2">
      {flat.map((d) => (
        <li
          key={d.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">{fmtDate(d.date)}</p>
            {d.reason && <p className="mt-0.5 text-xs text-slate-600">{d.reason}</p>}
            {d.studentName && (
              <p className="mt-0.5 text-[11px] text-slate-500">Aplica a {d.studentName}</p>
            )}
          </div>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
            Sin clases
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------ Attendance ------------------------------- */

export type AttendanceChild = {
  studentId: string;
  studentName?: string;
  fullName?: string;
  matricula?: string;
  records?: Array<{
    attendanceDate: string;
    status: 'PRESENTE' | 'AUSENTE' | 'RETARDO';
    isJustified?: boolean | null;
    notes?: string | null;
  }>;
  summary?: {
    presente?: number;
    ausente?: number;
    retardo?: number;
    total?: number;
  };
};

export function AttendanceChildrenView({ data }: { data: unknown }) {
  const children = useMemo(() => {
    if (!data) return [] as AttendanceChild[];
    if (Array.isArray(data)) return data as AttendanceChild[];
    if (typeof data === 'object' && 'children' in (data as Record<string, unknown>)) {
      const c = (data as { children?: unknown }).children;
      return Array.isArray(c) ? (c as AttendanceChild[]) : [];
    }
    return [];
  }, [data]);

  if (children.length === 0) {
    return (
      <EmptyState
        title="Sin información de asistencia"
        hint="Los registros de asistencia de tus hijos aparecerán aquí cuando la escuela los publique."
      />
    );
  }

  return (
    <div className="space-y-4">
      {children.map((ch) => {
        const recs = ch.records ?? [];
        const summary = ch.summary ?? {
          presente: recs.filter((r) => r.status === 'PRESENTE').length,
          ausente: recs.filter((r) => r.status === 'AUSENTE').length,
          retardo: recs.filter((r) => r.status === 'RETARDO').length,
          total: recs.length
        };
        const lastFive = [...recs]
          .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate))
          .slice(0, 5);
        return (
          <div key={ch.studentId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{ch.studentName ?? ch.fullName ?? 'Alumno'}</p>
                {ch.matricula && <p className="text-xs text-slate-500">Matrícula: {ch.matricula}</p>}
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                  Presente: {summary.presente ?? 0}
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
                  Retardo: {summary.retardo ?? 0}
                </span>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800">
                  Ausente: {summary.ausente ?? 0}
                </span>
              </div>
            </div>
            {lastFive.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100">
                {lastFive.map((r, i) => (
                  <li key={`${r.attendanceDate}-${i}`} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-700">{fmtDate(r.attendanceDate)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        r.status === 'PRESENTE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.status === 'RETARDO'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {r.status === 'PRESENTE' ? 'Presente' : r.status === 'RETARDO' ? 'Retardo' : 'Ausente'}
                      {r.isJustified ? ' · justificado' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------- Attention notes ----------------------------- */

export type AttentionNote = {
  id: string;
  studentName?: string | null;
  studentId?: string;
  title?: string;
  category?: string | null;
  severity?: 'LEVE' | 'MEDIA' | 'GRAVE' | string | null;
  notes?: string | null;
  description?: string | null;
  occurredAt?: string | null;
  createdAt?: string | null;
};

export function AttentionNotesList({ data }: { data: unknown }) {
  const items = useMemo(() => unwrapList<AttentionNote>(data), [data]);
  if (items.length === 0) {
    return (
      <EmptyState
        title="No hay anotaciones registradas"
        hint="Si la escuela registra una observación o llamado de atención aparecerá aquí."
      />
    );
  }
  const sevStyle = (s?: string | null) => {
    if (s === 'GRAVE') return 'bg-red-100 text-red-800';
    if (s === 'MEDIA') return 'bg-amber-100 text-amber-900';
    return 'bg-slate-100 text-slate-700';
  };
  return (
    <ul className="space-y-3">
      {items.map((n) => (
        <li key={n.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-slate-900">{n.title || n.category || 'Anotación'}</h3>
                {n.severity && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${sevStyle(n.severity)}`}>
                    {n.severity}
                  </span>
                )}
              </div>
              {n.studentName && (
                <p className="mt-0.5 text-xs text-slate-500">Alumno: {n.studentName}</p>
              )}
              {(n.notes || n.description) && (
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                  {n.notes ?? n.description}
                </p>
              )}
            </div>
            <div className="text-right text-[11px] text-slate-500">
              <p>{fmtDateTime(n.occurredAt ?? n.createdAt)}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------- Meetings ------------------------------- */

export type Meeting = {
  id: string;
  title?: string;
  topic?: string;
  scheduledAt?: string;
  startsAt?: string;
  durationMinutes?: number | null;
  status?: string | null;
  location?: string | null;
  notes?: string | null;
  withTeacherName?: string | null;
  studentName?: string | null;
};

export function MeetingsList({ data }: { data: unknown }) {
  const items = useMemo(() => unwrapList<Meeting>(data), [data]);
  if (items.length === 0) {
    return (
      <EmptyState
        title="No hay reuniones agendadas"
        hint="Cuando un docente confirme una reunión la verás aquí."
      />
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((m) => {
        const when = m.scheduledAt ?? m.startsAt;
        return (
          <li key={m.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-slate-900">{m.title || m.topic || 'Reunión'}</h3>
                  {m.status && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      {m.status}
                    </span>
                  )}
                </div>
                {m.withTeacherName && (
                  <p className="mt-0.5 text-xs text-slate-500">Con {m.withTeacherName}</p>
                )}
                {m.studentName && (
                  <p className="text-xs text-slate-500">Sobre {m.studentName}</p>
                )}
                {m.location && <p className="mt-1 text-sm text-slate-700">📍 {m.location}</p>}
                {m.notes && <p className="mt-1 text-sm text-slate-700">{m.notes}</p>}
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>{fmtDateTime(when)}</p>
                {m.durationMinutes ? <p>{m.durationMinutes} min</p> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------- Vehicles ------------------------------- */

export type Vehicle = {
  id: string;
  plate?: string | null;
  licensePlate?: string | null;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  description?: string | null;
};

export function VehiclesList({ data }: { data: unknown }) {
  const items = useMemo(() => unwrapList<Vehicle>(data), [data]);
  if (items.length === 0) {
    return (
      <EmptyState
        title="No tienes vehículos registrados"
        hint="Agrega los vehículos autorizados para recoger a su hijo o hija."
      />
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((v) => {
        const plate = (v.plate ?? v.licensePlate ?? '').toUpperCase();
        return (
          <li key={v.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden
              >
                <path d="M5 17h14M5 17a2 2 0 0 1-2-2v-2l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v2a2 2 0 0 1-2 2M7 17v2M17 17v2" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-mono text-sm font-semibold tracking-wider text-slate-900">{plate || '— Sin placa —'}</p>
              <p className="mt-0.5 text-xs text-slate-600">
                {[v.brand, v.model].filter(Boolean).join(' ') || 'Vehículo registrado'}
              </p>
              {v.color && <p className="text-[11px] text-slate-500">Color: {v.color}</p>}
              {v.description && <p className="mt-1 text-xs text-slate-500">{v.description}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

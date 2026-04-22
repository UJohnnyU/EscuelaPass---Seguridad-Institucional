import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { publicAssetUrl } from '@/lib/asset-url';
import { DetailModal } from '@/components/DetailModal';

function todayISODateLocal(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
  status: 'PENDIENTE' | 'PAGADO' | 'VENCIDO' | 'COMPROBANTE_RECHAZADO';
  description?: string | null;
  voucherPath?: string | null;
  uploadedAt?: string | null;
  verifiedAt?: string | null;
  /** Motivo cuando el administrativo rechaza el comprobante */
  notes?: string | null;
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
  emptyHint = 'Cuando la escuela te envíe un aviso aparecerá aquí.',
  allowMarkRead = false
}: {
  data: unknown;
  emptyTitle?: string;
  emptyHint?: string;
  allowMarkRead?: boolean;
}) {
  const items = useMemo(() => unwrapList<Notification>(data), [data]);
  const [readMap, setReadMap] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    setReadMap({});
  }, [items]);

  const deepId = searchParams.get('notification') ?? searchParams.get('notif');
  useEffect(() => {
    if (!deepId || items.length === 0) return;
    const target = items.find((n) => n.id === deepId);
    if (!target) return;
    const el = itemRefs.current[deepId];
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-brand-400');
        setTimeout(() => el.classList.remove('ring-2', 'ring-brand-400'), 2500);
      }, 120);
    }
    setOpenId(deepId);
  }, [deepId, items]);

  const handleMarkRead = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await api.patch(`/api/v1/notifications/${id}/read`, {});
      setReadMap((prev) => ({ ...prev, [id]: new Date().toISOString() }));
    } catch {
      /* silenciar; el usuario verá que sigue sin leer */
    } finally {
      setBusyId(null);
    }
  };

  if (items.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} />;

  const openItem = items.find((n) => n.id === openId) ?? null;

  return (
    <>
      <ul className="space-y-3">
        {items.map((n) => {
          const isUnread = !n.readAt && !readMap[n.id];
          return (
            <li
              key={n.id}
              ref={(el) => {
                itemRefs.current[n.id] = el;
              }}
              className={`relative rounded-lg border p-4 transition focus-within:ring-2 focus-within:ring-brand-300 ${
                isUnread ? 'border-brand-200 bg-brand-50/40' : 'border-slate-200 bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setOpenId(n.id);
                  if (allowMarkRead && isUnread) void handleMarkRead(n.id);
                }}
                className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
              >
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
                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-slate-700">{n.message}</p>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <p>{fmtDateTime(n.sentAt)}</p>
                  <p className="text-slate-400">{fmtRelative(n.sentAt)}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <DetailModal
        open={openItem !== null}
        title={openItem?.title ?? ''}
        subtitle={openItem ? fmtDateTime(openItem.sentAt) : undefined}
        badge={
          openItem?.studentName ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
              Para {openItem.studentName}
            </span>
          ) : null
        }
        onClose={() => {
          setOpenId(null);
          if (deepId) {
            const next = new URLSearchParams(searchParams);
            next.delete('notification');
            setSearchParams(next, { replace: true });
          }
        }}
        footer={
          openItem && allowMarkRead && !openItem.readAt && !readMap[openItem.id] ? (
            <button
              type="button"
              onClick={() => void handleMarkRead(openItem.id)}
              disabled={busyId === openItem.id}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60"
            >
              {busyId === openItem.id ? 'Marcando…' : 'Marcar como leído'}
            </button>
          ) : null
        }
      >
        {openItem ? (
          <div className="space-y-3">
            <p className="whitespace-pre-line text-slate-800">{openItem.message}</p>
            <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-semibold uppercase tracking-widest text-slate-500">Enviado</dt>
                <dd className="mt-0.5 text-slate-900">{fmtDateTime(openItem.sentAt)}</dd>
              </div>
              {openItem.readAt || readMap[openItem.id] ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Leído</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {fmtDateTime(openItem.readAt ?? readMap[openItem.id])}
                  </dd>
                </div>
              ) : null}
              {openItem.deliveryStatus ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Entrega</dt>
                  <dd className="mt-0.5 text-slate-900">{openItem.deliveryStatus}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </DetailModal>
    </>
  );
}

/* --------------------------------- Notices -------------------------------- */

export function NoticesList({ data }: { data: unknown }) {
  const items = useMemo(() => unwrapList<Notice>(data), [data]);
  const [openId, setOpenId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const deepId = searchParams.get('notice');
  useEffect(() => {
    if (!deepId || items.length === 0) return;
    const target = items.find((n) => n.id === deepId);
    if (!target) return;
    const el = itemRefs.current[deepId];
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-brand-400');
        setTimeout(() => el.classList.remove('ring-2', 'ring-brand-400'), 2500);
      }, 120);
    }
    setOpenId(deepId);
  }, [deepId, items]);

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
  const open = items.find((n) => n.id === openId) ?? null;
  return (
    <>
      <ul className="space-y-3">
        {items.map((n) => (
          <li
            key={n.id}
            ref={(el) => {
              itemRefs.current[n.id] = el;
            }}
            className="rounded-lg border border-slate-200 bg-white p-4 transition"
          >
            <button
              type="button"
              onClick={() => setOpenId(n.id)}
              className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
            >
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
                <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-slate-700">{n.content}</p>
                {n.expiresAt && (
                  <p className="mt-2 text-xs text-slate-500">Vigente hasta {fmtDate(n.expiresAt)}</p>
                )}
              </div>
              <div className="text-right text-[11px] text-slate-500">
                <p>{fmtDateTime(n.createdAt)}</p>
                <p className="text-slate-400">{fmtRelative(n.createdAt)}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <DetailModal
        open={open !== null}
        title={open?.title ?? ''}
        subtitle={open ? fmtDateTime(open.createdAt) : undefined}
        badge={
          open?.isImportant ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
              Importante
            </span>
          ) : null
        }
        onClose={() => {
          setOpenId(null);
          if (deepId) {
            const next = new URLSearchParams(searchParams);
            next.delete('notice');
            setSearchParams(next, { replace: true });
          }
        }}
      >
        {open ? (
          <div className="space-y-3">
            <p className="whitespace-pre-line text-slate-800">{open.content}</p>
            <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-semibold uppercase tracking-widest text-slate-500">Publicado</dt>
                <dd className="mt-0.5 text-slate-900">{fmtDateTime(open.createdAt)}</dd>
              </div>
              {open.expiresAt ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Vigente hasta</dt>
                  <dd className="mt-0.5 text-slate-900">{fmtDate(open.expiresAt)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="font-semibold uppercase tracking-widest text-slate-500">Destino</dt>
                <dd className="mt-0.5 text-slate-900">{labelTarget(open.targetType)}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </DetailModal>
    </>
  );
}

/* ----------------------------- Payment concepts --------------------------- */

export function PaymentConceptsList({ data }: { data: unknown }) {
  const items = useMemo(() => unwrapList<PaymentConcept>(data), [data]);
  const [openId, setOpenId] = useState<string | null>(null);
  if (items.length === 0) {
    return (
      <EmptyState
        title="No hay conceptos de cobro disponibles"
        hint="La administración del plantel publica aquí los pagos vigentes."
      />
    );
  }
  const open = items.find((c) => c.id === openId) ?? null;
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((c) => (
          <li
            key={c.id}
            className="rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-slate-300"
          >
            <button
              type="button"
              onClick={() => setOpenId(c.id)}
              className="flex w-full flex-col p-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium text-slate-900">{c.name}</h3>
                <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {fmtCurrency(c.defaultAmount)}
                </span>
              </div>
              {c.description && <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">{c.description}</p>}
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
            </button>
          </li>
        ))}
      </ul>
      <DetailModal
        open={open !== null}
        title={open?.name ?? ''}
        subtitle={open ? fmtCurrency(open.defaultAmount) : undefined}
        badge={
          open?.isRecurring ? (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">
              Recurrente {open.recurrencePeriod ? `· ${open.recurrencePeriod}` : ''}
            </span>
          ) : null
        }
        onClose={() => setOpenId(null)}
      >
        {open ? (
          <div className="space-y-4">
            {open.description ? (
              <p className="whitespace-pre-line text-slate-800">{open.description}</p>
            ) : (
              <p className="text-slate-500">No hay descripción registrada para este concepto.</p>
            )}
            <dl className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-semibold uppercase tracking-widest text-slate-500">Importe por defecto</dt>
                <dd className="mt-0.5 text-base font-semibold text-slate-900">{fmtCurrency(open.defaultAmount)}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-widest text-slate-500">Estado</dt>
                <dd className="mt-0.5 text-slate-900">{open.isActive === false ? 'Inactivo' : 'Activo'}</dd>
              </div>
              {open.isRecurring ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Periodicidad</dt>
                  <dd className="mt-0.5 text-slate-900">{open.recurrencePeriod ?? 'Recurrente'}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </DetailModal>
    </>
  );
}

/* ---------------------------------- Debts -------------------------------- */

function statusStyle(status: Debt['status'], isOverdue: boolean) {
  if (status === 'PAGADO') {
    return { label: 'Pagado', cls: 'bg-emerald-100 text-emerald-800' };
  }
  if (status === 'COMPROBANTE_RECHAZADO') {
    return { label: 'Comprobante no aceptado', cls: 'bg-rose-100 text-rose-900' };
  }
  if (status === 'VENCIDO' || isOverdue) {
    return { label: 'Vencido', cls: 'bg-red-100 text-red-800' };
  }
  return { label: 'Pendiente', cls: 'bg-amber-100 text-amber-900' };
}

function DebtItem({ d, canUpload, onUpdated }: { d: Debt; canUpload: boolean; onUpdated: (next: Partial<Debt>) => void }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d.dueDate);
  const isOverdue =
    !Number.isNaN(due.getTime()) &&
    due < today &&
    d.status !== 'PAGADO' &&
    d.status !== 'COMPROBANTE_RECHAZADO';
  const st = statusStyle(d.status, isOverdue);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const voucherUrl = d.voucherPath ? publicAssetUrl(d.voucherPath) : null;

  const handleFile = async (file: File) => {
    setErrMsg(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<{
        uploadedAt?: string;
        voucherPath?: string | null;
        status?: Debt['status'];
        notes?: string | null;
      }>(`/api/v1/payments/debts/${d.id}/voucher/file`, fd);
      const body = res.data ?? {};
      const uploadedAt =
        typeof body.uploadedAt === 'string'
          ? body.uploadedAt
          : body.uploadedAt != null
            ? new Date(body.uploadedAt as unknown as Date).toISOString()
            : new Date().toISOString();
      onUpdated({
        voucherPath: body.voucherPath ?? d.voucherPath ?? `/uploads/comprobantes/${file.name}`,
        uploadedAt,
        ...(body.status != null ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {})
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo subir el comprobante.';
      setErrMsg(msg);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-slate-900">{d.conceptName ?? 'Concepto de cobro'}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
          </div>
          {d.studentName && <p className="mt-0.5 text-xs text-slate-500">Alumno: {d.studentName}</p>}
          {(d.description || d.conceptDescription) && (
            <p className="mt-1 text-sm text-slate-700">{d.description ?? d.conceptDescription}</p>
          )}
          <p className={`mt-2 text-xs ${isOverdue ? 'text-red-700' : 'text-slate-500'}`}>
            Vence el {fmtDate(d.dueDate)}
          </p>
          {d.voucherPath && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={
                  d.status === 'COMPROBANTE_RECHAZADO'
                    ? 'text-rose-800'
                    : d.verifiedAt
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                }
              >
                {d.status === 'COMPROBANTE_RECHAZADO'
                  ? `Comprobante no aceptado${d.uploadedAt ? ` · ${fmtDate(d.uploadedAt)}` : ''}`
                  : d.verifiedAt
                    ? `Comprobante verificado${d.verifiedAt ? ` · ${fmtDate(d.verifiedAt)}` : ''}`
                    : `Comprobante en revisión${d.uploadedAt ? ` · ${fmtDate(d.uploadedAt)}` : ''}`}
              </span>
              {voucherUrl && (
                <a
                  href={voucherUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-300 bg-white px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Ver comprobante
                </a>
              )}
            </div>
          )}
          {d.status === 'COMPROBANTE_RECHAZADO' && d.notes ? (
            <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              <span className="font-semibold">Motivo: </span>
              {d.notes}
            </p>
          ) : null}
          {canUpload && d.status !== 'PAGADO' && (
            <div className="mt-3">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-700 bg-white px-3 py-1 text-xs font-semibold text-brand-900 hover:bg-brand-50 disabled:opacity-60"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                  aria-hidden
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {busy ? 'Subiendo…' : d.voucherPath ? 'Reemplazar comprobante' : 'Subir comprobante'}
              </button>
              {errMsg && <p className="mt-1 text-xs text-red-700">{errMsg}</p>}
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-slate-900">{fmtCurrency(d.amount)}</p>
        </div>
      </div>
    </li>
  );
}

export function DebtsList({ data, canUpload = false }: { data: unknown; canUpload?: boolean }) {
  const initial = useMemo(() => unwrapList<Debt>(data), [data]);
  const [items, setItems] = useState<Debt[]>(initial);
  useEffect(() => {
    setItems(initial);
  }, [initial]);

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
        {items.map((d) => (
          <DebtItem
            key={d.id}
            d={d}
            canUpload={canUpload}
            onUpdated={(patch) =>
              setItems((prev) => prev.map((x) => (x.id === d.id ? { ...x, ...patch } : x)))
            }
          />
        ))}
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

export function ParentExcuseForm({
  students,
  onSuccess
}: {
  students: Array<{ studentId: string; studentName?: string; matricula?: string }>;
  onSuccess?: () => void | Promise<void>;
}) {
  const [studentId, setStudentId] = useState('');
  const [date, setDate] = useState(() => todayISODateLocal());
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (!students.length) return;
    if (!studentId || !students.some((s) => s.studentId === studentId)) {
      setStudentId(students[0].studentId);
    }
  }, [students, studentId]);

  if (students.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Cuando tenga hijos vinculados a su cuenta, podrá enviar excusas de ausencia aquí.
      </p>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    const r = reason.trim();
    if (r.length < 3) {
      setErr('Indique un motivo de al menos 3 caracteres.');
      return;
    }
    if (!studentId) {
      setErr('Elija un estudiante.');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('studentId', studentId);
      fd.append('date', date.slice(0, 10));
      fd.append('reason', r);
      if (file) fd.append('file', file);
      await api.post('/api/v1/attendance/parent/excuse', fd);
      setOk('Excusa registrada. La escuela verá el registro en asistencia.');
      setReason('');
      setFile(null);
      await onSuccess?.();
    } catch (e) {
      setErr(getUserFacingMessage(e, 'No se pudo registrar la excusa.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(ev) => void onSubmit(ev)} className="space-y-4">
      {err ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{err}</div>
      ) : null}
      {ok ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{ok}</div>
      ) : null}
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Estudiante
        <select
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          required
        >
          {students.map((s) => (
            <option key={s.studentId} value={s.studentId}>
              {s.studentName ?? 'Alumno'}
              {s.matricula ? ` · ${s.matricula}` : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Fecha del ausentismo
        <input
          type="date"
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Motivo (visible para la escuela)
        <textarea
          className="min-h-[88px] rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej.: cita médica, enfermedad…"
          required
          minLength={3}
          maxLength={2000}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Comprobante (opcional)
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          className="text-sm file:mr-3 file:rounded file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <span className="text-xs text-slate-500">PDF, JPG, PNG o WEBP. Máx. aprox. 5 MB.</span>
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {submitting ? 'Enviando…' : 'Registrar excusa'}
      </button>
    </form>
  );
}

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
        const recordsForDisplay = [...recs].sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate));
        return (
          <div key={ch.studentId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{ch.studentName ?? ch.fullName ?? 'Alumno'}</p>
                {ch.matricula && <p className="text-xs text-slate-500">Matrícula: {ch.matricula}</p>}
              </div>
            </div>
            {recordsForDisplay.length > 0 ? (
              <ul className="mt-3 divide-y divide-slate-100">
                {recordsForDisplay.map((r, i) => (
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
            ) : (
              <p className="mt-3 text-sm text-slate-500">Sin asistencias registradas por el docente.</p>
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
  const [openId, setOpenId] = useState<string | null>(null);
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
  const open = items.find((n) => n.id === openId) ?? null;
  return (
    <>
      <ul className="space-y-3">
        {items.map((n) => (
          <li key={n.id} className="rounded-lg border border-slate-200 bg-white transition">
            <button
              type="button"
              onClick={() => setOpenId(n.id)}
              className="flex w-full flex-wrap items-start justify-between gap-3 p-4 text-left"
            >
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
                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-slate-700">
                    {n.notes ?? n.description}
                  </p>
                )}
              </div>
              <div className="text-right text-[11px] text-slate-500">
                <p>{fmtDateTime(n.occurredAt ?? n.createdAt)}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <DetailModal
        open={open !== null}
        title={open?.title || open?.category || 'Anotación'}
        subtitle={open ? fmtDateTime(open.occurredAt ?? open.createdAt) : undefined}
        badge={
          open?.severity ? (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${sevStyle(open.severity)}`}>
              {open.severity}
            </span>
          ) : null
        }
        onClose={() => setOpenId(null)}
      >
        {open ? (
          <div className="space-y-3">
            {open.notes || open.description ? (
              <p className="whitespace-pre-line text-slate-800">{open.notes ?? open.description}</p>
            ) : (
              <p className="text-slate-500">Sin descripción adicional.</p>
            )}
            <dl className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2">
              {open.studentName ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Alumno</dt>
                  <dd className="mt-0.5 text-slate-900">{open.studentName}</dd>
                </div>
              ) : null}
              {open.category ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Categoría</dt>
                  <dd className="mt-0.5 text-slate-900">{open.category}</dd>
                </div>
              ) : null}
              {open.occurredAt ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Ocurrido</dt>
                  <dd className="mt-0.5 text-slate-900">{fmtDateTime(open.occurredAt)}</dd>
                </div>
              ) : null}
              {open.createdAt ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Registrado</dt>
                  <dd className="mt-0.5 text-slate-900">{fmtDateTime(open.createdAt)}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </DetailModal>
    </>
  );
}

/* -------------------------------- Meetings ------------------------------- */

export type Meeting = {
  id: string;
  title?: string;
  purpose?: string;
  topic?: string;
  startAt?: string;
  startsAt?: string;
  scheduledAt?: string;
  durationMinutes?: number | null;
  status?: string | null;
  modality?: 'PRESENCIAL' | 'VIRTUAL' | string | null;
  location?: string | null;
  meetingLink?: string | null;
  notes?: string | null;
  organizerName?: string | null;
  withTeacherName?: string | null;
  studentName?: string | null;
};

function statusMeetingStyle(s?: string | null) {
  if (s === 'PROGRAMADA') return { label: 'Programada', cls: 'bg-blue-100 text-blue-800' };
  if (s === 'REALIZADA') return { label: 'Realizada', cls: 'bg-emerald-100 text-emerald-800' };
  if (s === 'CANCELADA') return { label: 'Cancelada', cls: 'bg-slate-200 text-slate-700' };
  if (s === 'REPROGRAMADA') return { label: 'Reprogramada', cls: 'bg-amber-100 text-amber-900' };
  return { label: s ?? '—', cls: 'bg-slate-100 text-slate-700' };
}

export function MeetingsList({ data }: { data: unknown }) {
  const items = useMemo(() => unwrapList<Meeting>(data), [data]);
  const [openId, setOpenId] = useState<string | null>(null);
  if (items.length === 0) {
    return (
      <EmptyState
        title="No hay reuniones agendadas"
        hint="Cuando un docente o la administración confirme una reunión la verás aquí."
      />
    );
  }
  const sorted = [...items].sort((a, b) => {
    const aw = a.startAt ?? a.startsAt ?? a.scheduledAt ?? '';
    const bw = b.startAt ?? b.startsAt ?? b.scheduledAt ?? '';
    return bw.localeCompare(aw);
  });
  const open = sorted.find((m) => m.id === openId) ?? null;
  const whenOf = (m: Meeting) => m.startAt ?? m.startsAt ?? m.scheduledAt;
  return (
    <>
      <ul className="space-y-3">
        {sorted.map((m) => {
          const when = whenOf(m);
          const st = statusMeetingStyle(m.status);
          const isVirtual = m.modality === 'VIRTUAL' || !!m.meetingLink;
          return (
            <li key={m.id} className="rounded-lg border border-slate-200 bg-white transition">
              <button
                type="button"
                onClick={() => setOpenId(m.id)}
                className="flex w-full flex-wrap items-start justify-between gap-3 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-slate-900">{m.title || m.topic || 'Reunión'}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>
                      {st.label}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      {isVirtual ? 'Virtual' : 'Presencial'}
                    </span>
                  </div>
                  {(m.purpose || m.notes) && (
                    <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-slate-700">
                      {m.purpose ?? m.notes}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p className="font-medium text-slate-700">{fmtDateTime(when)}</p>
                  {m.durationMinutes ? <p>{m.durationMinutes} min</p> : null}
                  <p className="text-slate-400">{fmtRelative(when)}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <DetailModal
        open={open !== null}
        title={open?.title || open?.topic || 'Reunión'}
        subtitle={open ? fmtDateTime(whenOf(open)) : undefined}
        badge={
          open?.status ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusMeetingStyle(open.status).cls}`}
            >
              {statusMeetingStyle(open.status).label}
            </span>
          ) : null
        }
        onClose={() => setOpenId(null)}
        footer={
          open?.meetingLink ? (
            <a
              href={open.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-900 hover:bg-brand-100"
            >
              Unirse a la reunión
            </a>
          ) : null
        }
      >
        {open ? (
          <div className="space-y-3">
            {open.purpose || open.notes ? (
              <p className="whitespace-pre-line text-slate-800">{open.purpose ?? open.notes}</p>
            ) : (
              <p className="text-slate-500">Sin descripción adicional.</p>
            )}
            <dl className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-semibold uppercase tracking-widest text-slate-500">Inicio</dt>
                <dd className="mt-0.5 text-slate-900">{fmtDateTime(whenOf(open))}</dd>
              </div>
              {open.durationMinutes ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Duración</dt>
                  <dd className="mt-0.5 text-slate-900">{open.durationMinutes} min</dd>
                </div>
              ) : null}
              <div>
                <dt className="font-semibold uppercase tracking-widest text-slate-500">Modalidad</dt>
                <dd className="mt-0.5 text-slate-900">
                  {open.modality === 'VIRTUAL' || open.meetingLink ? 'Virtual' : 'Presencial'}
                </dd>
              </div>
              {open.location ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Lugar</dt>
                  <dd className="mt-0.5 text-slate-900">{open.location}</dd>
                </div>
              ) : null}
              {open.organizerName ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Organiza</dt>
                  <dd className="mt-0.5 text-slate-900">{open.organizerName}</dd>
                </div>
              ) : null}
              {open.withTeacherName ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Con docente</dt>
                  <dd className="mt-0.5 text-slate-900">{open.withTeacherName}</dd>
                </div>
              ) : null}
              {open.studentName ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500">Sobre</dt>
                  <dd className="mt-0.5 text-slate-900">{open.studentName}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </DetailModal>
    </>
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

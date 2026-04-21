import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { DetailModal } from '@/components/DetailModal';

type UnknownObj = Record<string, unknown>;
type NotifRow = {
  id: string;
  title?: string;
  message?: string;
  sentAt?: string;
  readAt?: string | null;
};

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

/**
 * Muestra un badge con el número de notificaciones no leídas.
 * Refresca cada 30 segundos sin bloquear la UI.
 */
export function NotificationsBadge({ compact = false }: { compact?: boolean }) {
  const MUTE_KEY = 'ep-notifications-muted';
  const [items, setItems] = useState<NotifRow[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(MUTE_KEY) === '1';
  });
  const prevUnreadRef = useRef<number | null>(null);
  const lastSoundAtRef = useRef<number>(0);

  const unread = useMemo(() => items.filter((r) => !r.readAt).length, [items]);

  const playSoftPing = () => {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      gain.connect(ctx.destination);
      const o1 = ctx.createOscillator();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(880, now);
      o1.connect(gain);
      o1.start(now);
      o1.stop(now + 0.12);
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(1320, now + 0.12);
      o2.connect(gain);
      o2.start(now + 0.11);
      o2.stop(now + 0.23);
      window.setTimeout(() => void ctx.close(), 350);
    } catch {
      // ignorar errores de audio/autoplay
    }
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function refresh() {
      try {
        const res = await api.get('/api/v1/notifications/me?limit=50');
        if (cancelled) return;
        const rows = extractArray<NotifRow>(res.data);
        setItems(rows);
      } catch {
        // si falla, no bloqueamos la UI
      }
    }

    void refresh();
    const tickMs = 5000;
    timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void refresh();
    }, tickMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  }, [muted, MUTE_KEY]);

  useEffect(() => {
    const previous = prevUnreadRef.current;
    prevUnreadRef.current = unread;
    if (previous === null) return;
    if (muted || unread <= previous) return;
    const now = Date.now();
    const cooldownMs = 45000;
    if (now - lastSoundAtRef.current < cooldownMs) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    lastSoundAtRef.current = now;
    playSoftPing();
  }, [muted, unread]);

  const size = compact ? 'h-7 w-7' : 'h-9 w-9';
  const fmtDateTime = (d?: string | null) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  };

  async function markRead(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      await api.patch(`/api/v1/notifications/${id}/read`, {});
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n))
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
      aria-label={unread > 0 ? `${unread} notificaciones sin leer` : 'Sin notificaciones nuevas'}
      className={`relative flex ${size} items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400`}
      title={unread > 0 ? `${unread} sin leer` : 'Notificaciones'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9z" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white shadow">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      <DetailModal
        open={open}
        title="Notificaciones"
        subtitle={unread > 0 ? `${unread} pendientes` : 'Todo al día'}
        onClose={() => setOpen(false)}
      >
        <div className="mb-3 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setMuted((v) => !v)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              muted
                ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
            }`}
          >
            {muted ? 'Activar sonido' : 'Silenciar'}
          </button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No tiene notificaciones todavía.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => {
              const isUnread = !n.readAt;
              return (
                <li
                  key={n.id}
                  className={`rounded-lg border p-3 ${isUnread ? 'border-brand-200 bg-brand-50/40' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{n.title ?? 'Notificación'}</p>
                      <p className="mt-1 whitespace-pre-line text-xs text-slate-700">{n.message ?? ''}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{fmtDateTime(n.sentAt)}</p>
                    </div>
                    {isUnread ? (
                      <button
                        type="button"
                        onClick={() => void markRead(n.id)}
                        disabled={busyId === n.id}
                        className="shrink-0 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-400 disabled:opacity-60"
                      >
                        {busyId === n.id ? 'Marcando…' : 'Marcar vista'}
                      </button>
                    ) : (
                      <span className="text-[11px] font-medium text-emerald-700">Vista</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DetailModal>
    </>
  );
}

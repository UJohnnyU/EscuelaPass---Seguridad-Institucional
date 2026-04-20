import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

type UnknownObj = Record<string, unknown>;
type NotifRow = { id: string; readAt?: string | null };

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
  const [unread, setUnread] = useState<number>(0);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function refresh() {
      try {
        const res = await api.get('/api/v1/notifications/me?limit=50');
        if (cancelled) return;
        const rows = extractArray<NotifRow>(res.data);
        const unreadRows = rows.filter((r) => !r.readAt);
        setUnread(unreadRows.length);
        setFirstUnreadId(unreadRows[0]?.id ?? null);
      } catch {
        // si falla, no bloqueamos la UI
      }
    }

    void refresh();
    timer = setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  const size = compact ? 'h-7 w-7' : 'h-9 w-9';
  const target =
    firstUnreadId != null
      ? `/app/modulos/comunicacion?notification=${encodeURIComponent(firstUnreadId)}`
      : '/app/modulos/comunicacion';

  return (
    <Link
      to={target}
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
    </Link>
  );
}

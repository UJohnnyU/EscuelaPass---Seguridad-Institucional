/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import {
  NOTIFICATION_READ_EVENT,
  NOTIFICATIONS_READ_ALL_EVENT,
  NOTIFICATIONS_REFRESH_REQUEST_EVENT,
  emitNotificationRead,
  emitNotificationsReadAll
} from '@/lib/notifications-sync';
import { useAdaptivePolling } from '@/hooks/use-adaptive-polling';

type UnknownObj = Record<string, unknown>;
type NotifRow = {
  id: string;
  title?: string;
  message?: string;
  sentAt?: string;
  readAt?: string | null;
  linkPath?: string | null;
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
  const navigate = useNavigate();
  const [items, setItems] = useState<NotifRow[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(MUTE_KEY) === '1';
  });
  const prevUnreadRef = useRef<number | null>(null);
  const lastSoundAtRef = useRef<number>(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  /** Panel a `fixed` con coordenadas limitadas al viewport (evita corte en móvil). */
  const [panelBox, setPanelBox] = useState<{ top: number; left: number; width: number } | null>(null);

  const unread = useMemo(() => items.filter((r) => !r.readAt).length, [items]);
  const unreadItems = useMemo(() => items.filter((r) => !r.readAt), [items]);

  const PANEL_MAX_W = 340;
  const VIEW_MARGIN = 12;

  const updatePanelPosition = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(PANEL_MAX_W, Math.max(220, vw - VIEW_MARGIN * 2));
    const centerX = rect.left + rect.width / 2;
    let left = centerX - width / 2;
    left = Math.max(VIEW_MARGIN, Math.min(left, vw - VIEW_MARGIN - width));
    setPanelBox({ top: rect.bottom + 10, left, width });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPanelBox(null);
      return;
    }
    updatePanelPosition();
    const onResizeOrScroll = () => updatePanelPosition();
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    return () => {
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
    };
  }, [open, items.length, unread]);
  /** Dos tonos agudos (campana); ganancia mayor que antes para que sea audible en entorno ruidoso. */
  const playSoftPing = () => {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const peak = 0.22;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.022);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
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
      o2.stop(now + 0.24);
      window.setTimeout(() => void ctx.close(), 400);
    } catch {
      // ignorar errores de audio/autoplay
    }
  };

  useEffect(() => {
    let cancelled = false;
    const refresh = async (signal?: AbortSignal) => {
      try {
        const res = await api.get('/api/v1/notifications/me?limit=50', { signal });
        if (cancelled) return;
        const rows = extractArray<NotifRow>(res.data);
        setItems(rows);
      } catch {
        // si falla, no bloqueamos la UI
      }
    };

    void refresh();
    const onFcmRefresh = () => {
      void refresh();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(NOTIFICATIONS_REFRESH_REQUEST_EVENT, onFcmRefresh);
    }
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener(NOTIFICATIONS_REFRESH_REQUEST_EVENT, onFcmRefresh);
      }
    };
  }, []);

  useAdaptivePolling({
    enabled: true,
    intervalFocused: 30000,
    intervalBlurred: 120000,
    onPoll: async ({ signal }) => {
      try {
        const res = await api.get('/api/v1/notifications/me?limit=50', { signal });
        const rows = extractArray<NotifRow>(res.data);
        setItems(rows);
      } catch {
        // si falla, no bloqueamos la UI
      }
    }
  });

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

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

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
      emitNotificationRead(id);
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    if (markingAll || unreadItems.length === 0) return;
    setMarkingAll(true);
    const nowIso = new Date().toISOString();
    const ids = unreadItems.map((n) => n.id);
    setItems((prev) => prev.map((n) => (!n.readAt ? { ...n, readAt: nowIso } : n)));
    try {
      await Promise.allSettled(ids.map((id) => api.patch(`/api/v1/notifications/${id}/read`, {})));
      emitNotificationsReadAll(ids);
    } finally {
      setMarkingAll(false);
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onRead = (event: Event) => {
      const e = event as CustomEvent<{ notificationId?: string }>;
      const notificationId = e.detail?.notificationId;
      if (!notificationId) return;
      setItems((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n
        )
      );
    };
    const onReadAll = (event: Event) => {
      const e = event as CustomEvent<{ notificationIds?: string[] }>;
      const ids = e.detail?.notificationIds ?? [];
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const nowIso = new Date().toISOString();
      setItems((prev) => prev.map((n) => (idSet.has(n.id) ? { ...n, readAt: n.readAt ?? nowIso } : n)));
    };
    window.addEventListener(NOTIFICATION_READ_EVENT, onRead as EventListener);
    window.addEventListener(NOTIFICATIONS_READ_ALL_EVENT, onReadAll as EventListener);
    return () => {
      window.removeEventListener(NOTIFICATION_READ_EVENT, onRead as EventListener);
      window.removeEventListener(NOTIFICATIONS_READ_ALL_EVENT, onReadAll as EventListener);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
      {open && panelBox ? (
      <div
        className="fixed z-[95] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl transition-shadow duration-200"
        style={{ top: panelBox.top, left: panelBox.left, width: panelBox.width }}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notificaciones</p>
          <div className="flex items-center gap-2">
            {unreadItems.length > 1 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={markingAll}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 disabled:opacity-60"
              >
                {markingAll ? 'Marcando…' : 'Marcar todas vistas'}
              </button>
            ) : null}
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
        </div>
        {unreadItems.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-600">
            Sin notificaciones nuevas.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {unreadItems.map((n) => {
              const hasLink = typeof n.linkPath === 'string' && n.linkPath.length > 0;
              return (
                <li
                  key={n.id}
                  className={`rounded-lg border border-brand-200 bg-brand-50/40 transition-colors ${hasLink ? 'cursor-pointer hover:bg-brand-100/60 active:bg-brand-100' : ''}`}
                  onClick={hasLink ? () => { navigate(n.linkPath!); setOpen(false); } : undefined}
                  role={hasLink ? 'button' : undefined}
                  tabIndex={hasLink ? 0 : undefined}
                  onKeyDown={hasLink ? (e) => { if (e.key === 'Enter' || e.key === ' ') { navigate(n.linkPath!); setOpen(false); } } : undefined}
                >
                  <div className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-slate-900">{n.title ?? 'Notificación'}</p>
                        {hasLink && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-brand-500">
                            <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-line text-xs text-slate-700">{n.message ?? ''}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{fmtDateTime(n.sentAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void markRead(n.id); }}
                      disabled={busyId === n.id}
                      className="shrink-0 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-400 disabled:opacity-60"
                    >
                      {busyId === n.id ? 'Marcando…' : 'Marcar vista'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      ) : null}
    </div>
  );
}

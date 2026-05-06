import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FCM_FOREGROUND_PUSH_EVENT,
  type FcmForegroundPushDetail
} from '@/lib/notifications-sync';

interface ToastEntry {
  id: number;
  title: string;
  body: string;
  openPath: string;
  /** true while the slide-in is playing; false triggers slide-out */
  visible: boolean;
}

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 5000;
/** Ignora el mismo aviso repetido en primer plano (doble `onMessage` o doble envío). */
const FOREGROUND_DEDUPE_MS = 8000;

let _seq = 0;
function nextId() {
  return ++_seq;
}

/**
 * Pila de toasts en primer plano para mensajes FCM recibidos mientras la
 * pestaña está activa. Aparece en la esquina inferior derecha (móvil: parte
 * inferior centrada), con slide-in / fade-out y auto-cierre a los 5 s.
 * Montarlo una sola vez dentro del Router (accede a useNavigate).
 */
export function NotifToast() {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const lastForegroundFingerprint = useRef<{ key: string; at: number } | null>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, visible: false } : t))
    );
    const removeTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 350);
    timers.current.set(id * -1, removeTimer);
  }, []);

  const scheduleAutoDismiss = useCallback(
    (id: number) => {
      const t = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, t);
    },
    [dismiss]
  );

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<FcmForegroundPushDetail>).detail;
      if (!detail?.title) return;

      const fp =
        detail.notifTag?.trim() ||
        `${detail.title}\u0000${detail.body}\u0000${detail.openPath ?? ''}`;
      const now = Date.now();
      const prev = lastForegroundFingerprint.current;
      if (prev && prev.key === fp && now - prev.at < FOREGROUND_DEDUPE_MS) {
        return;
      }
      lastForegroundFingerprint.current = { key: fp, at: now };

      const id = nextId();
      setToasts((prev) => {
        const next = [...prev, { id, title: detail.title, body: detail.body, openPath: detail.openPath, visible: false }];
        return next.slice(-MAX_TOASTS);
      });

      requestAnimationFrame(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, visible: true } : t))
        );
        scheduleAutoDismiss(id);
      });
    };

    window.addEventListener(FCM_FOREGROUND_PUSH_EVENT, handler);
    return () => window.removeEventListener(FCM_FOREGROUND_PUSH_EVENT, handler);
  }, [scheduleAutoDismiss]);

  useEffect(() => {
    const allTimers = timers.current;
    return () => {
      allTimers.forEach((t) => clearTimeout(t));
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[200] flex flex-col items-end gap-2 sm:bottom-6 sm:right-6"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            'pointer-events-auto w-[clamp(280px,90vw,360px)] rounded-xl border border-slate-200 bg-white shadow-2xl transition-all duration-300',
            t.visible
              ? 'translate-y-0 opacity-100'
              : 'translate-y-4 opacity-0'
          ].join(' ')}
          role="alert"
        >
          {/* Header */}
          <div className="flex items-start gap-3 px-4 pt-3 pb-0">
            {/* Bell icon */}
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M4.214 3.227a.75.75 0 00-1.156-.956 8.97 8.97 0 00-1.856 3.826.75.75 0 001.466.316 7.47 7.47 0 011.546-3.186zm13.684-.956a.75.75 0 10-1.156.956 7.47 7.47 0 011.546 3.186.75.75 0 001.466-.316 8.97 8.97 0 00-1.856-3.826zM10 2a6 6 0 00-6 6v1.077c0 .685-.21 1.354-.602 1.914L2.3 12.34A.75.75 0 002.9 13.5h14.2a.75.75 0 00.6-1.16l-1.098-1.35A3.246 3.246 0 0116 9.077V8a6 6 0 00-6-6zm0 15a2 2 0 01-2-2h4a2 2 0 01-2 2z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug text-slate-900">{t.title}</p>
            </div>
            {/* Close button */}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar notificación"
              className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>

          {/* Body */}
          {t.body ? (
            <p className="px-4 pt-1.5 pb-0 text-xs leading-relaxed text-slate-600 line-clamp-3">
              {t.body}
            </p>
          ) : null}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 px-4 py-2.5">
            {t.openPath ? (
              <button
                type="button"
                onClick={() => {
                  dismiss(t.id);
                  navigate(t.openPath);
                }}
                className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-95"
              >
                Ver
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>

          {/* Auto-dismiss progress bar */}
          <div className="overflow-hidden rounded-b-xl">
            <div className="h-0.5 origin-left bg-brand-400 animate-toast-progress" />
          </div>
        </div>
      ))}
    </div>
  );
}

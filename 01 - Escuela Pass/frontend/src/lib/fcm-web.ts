import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

import { API_BASE_URL, api } from '@/lib/api';
import { NOTIFICATIONS_REFRESH_REQUEST_EVENT } from '@/lib/notifications-sync';

const STORAGE_LAST_TOKEN = 'ep-fcm-registration-token';

let analyticsInitialized = false;

function readWebConfig(): FirebaseOptions | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim();
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim();
  const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim();
  const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim();
  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    return null;
  }
  const cfg: FirebaseOptions = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId
  };
  if (measurementId) cfg.measurementId = measurementId;
  return cfg;
}

/** Listo para pedir token (incluye clave VAPID de la consola Firebase). */
export function isWebPushConfigured(): boolean {
  const vapid = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim();
  return Boolean(readWebConfig() && vapid);
}

function getOrInitApp(): FirebaseApp {
  const cfg = readWebConfig();
  if (!cfg) throw new Error('Firebase web config incompleta');
  if (getApps().length > 0) return getApps()[0]!;
  return initializeApp(cfg);
}

async function initAnalyticsIfPossible(app: FirebaseApp): Promise<void> {
  if (analyticsInitialized) return;
  if (!import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim()) return;
  try {
    if (!(await isAnalyticsSupported())) return;
    getAnalytics(app);
    analyticsInitialized = true;
  } catch {
    /* ya inicializado o entorno no soportado */
  }
}

function requestRefreshSoon() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_REFRESH_REQUEST_EVENT));
}

let foregroundListenerAttached = false;

/**
 * Solicita permiso de notificación si hace falta, registra el SW y envía el token al backend.
 * Puede llamarse en cada sesión autenticada (vuelve a asociar el token al usuario).
 */
export async function ensureWebPushRegistered(): Promise<void> {
  if (!isWebPushConfigured()) return;
  if (import.meta.env.PROD && !API_BASE_URL) {
    console.warn(
      '[Escuela Pass FCM] VITE_API_BASE no está definido en el build. El token no se registrará en el API (use la URL pública de Railway en Vercel y vuelva a desplegar).'
    );
    return;
  }
  try {
    if (!(await isSupported())) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'denied') return;
    if (Notification.permission === 'default') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return;
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY!.trim();
    const app = getOrInitApp();
    await initAnalyticsIfPossible(app);
    const messaging = getMessaging(app);

    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      type: 'classic',
      scope: '/'
    });
    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
    if (!token) return;

    await api.post('/api/v1/notifications/fcm/register', { token, platform: 'web' });
    localStorage.setItem(STORAGE_LAST_TOKEN, token);

    if (!foregroundListenerAttached) {
      onMessage(messaging, (payload) => {
        requestRefreshSoon();
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        const title = payload.notification?.title ?? payload.data?.title ?? 'Escuela Pass';
        const body = payload.notification?.body ?? payload.data?.body ?? '';
        if (!title && !body) return;
        try {
          const n = new Notification(title, { body, icon: '/favicon.svg', tag: payload.data?.notificationId ?? undefined });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        } catch {
          /* Notification API no disponible */
        }
      });
      foregroundListenerAttached = true;
    }
  } catch (err) {
    console.warn('[Escuela Pass FCM] No se pudo registrar el token de push:', err);
  }
}

/** Llamar antes de limpiar tokens en logout. */
export async function unregisterWebPushToken(): Promise<void> {
  const t = localStorage.getItem(STORAGE_LAST_TOKEN);
  if (!t) return;
  try {
    await api.post('/api/v1/notifications/fcm/unregister', { token: t });
  } catch {
    /* token JWT ya invalidado */
  }
  localStorage.removeItem(STORAGE_LAST_TOKEN);
}

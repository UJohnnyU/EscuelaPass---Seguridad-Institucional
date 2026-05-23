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

import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging
} from 'firebase/messaging';

import { API_BASE_URL, api } from '@/lib/api';
import { NOTIFICATIONS_REFRESH_REQUEST_EVENT } from '@/lib/notifications-sync';

const STORAGE_LAST_TOKEN = 'ep-fcm-registration-token';
const STORAGE_LAST_REGISTER_USER = 'ep-fcm-register-user-id';

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

function attachForegroundListener(messaging: Messaging): void {
  if (foregroundListenerAttached) return;
  /** Marcador antes de `onMessage`: evita doble registro si `ensureWebPushRegistered` corre en paralelo. */
  foregroundListenerAttached = true;
  onMessage(messaging, (_payload) => {
    requestRefreshSoon();
  });
}

async function postRegisterWithRetry(token: string, platform: string): Promise<boolean> {
  try {
    await api.post('/api/v1/notifications/fcm/register', { token, platform });
    return true;
  } catch {
    try {
      await new Promise((r) => setTimeout(r, 900));
      await api.post('/api/v1/notifications/fcm/register', { token, platform });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Solicita permiso de notificación si hace falta, registra el SW y envía el token al backend.
 * @param userId Usuario autenticado (para idempotencia y re-asignación correcta del token).
 */
export async function ensureWebPushRegistered(userId: string): Promise<void> {
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

    const prevToken = localStorage.getItem(STORAGE_LAST_TOKEN);
    const prevUser = localStorage.getItem(STORAGE_LAST_REGISTER_USER);
    const alreadySynced = token === prevToken && prevUser === userId;

    attachForegroundListener(messaging);

    if (alreadySynced) {
      return;
    }

    const registered = await postRegisterWithRetry(token, 'web');
    if (registered) {
      localStorage.setItem(STORAGE_LAST_TOKEN, token);
      localStorage.setItem(STORAGE_LAST_REGISTER_USER, userId);
    } else {
      console.warn('[Escuela Pass FCM] No se pudo registrar el token en el API tras reintento.');
    }
  } catch (err) {
    console.warn('[Escuela Pass FCM] No se pudo registrar el token de push:', err);
  }
}

/** Llamar antes de limpiar tokens en logout. Quita el token en el API y revoca en Firebase. */
export async function unregisterWebPushToken(): Promise<void> {
  const t = localStorage.getItem(STORAGE_LAST_TOKEN);
  localStorage.removeItem(STORAGE_LAST_REGISTER_USER);

  if (t) {
    try {
      await api.post('/api/v1/notifications/fcm/unregister', { token: t });
    } catch {
      /* token JWT ya invalidado */
    }
  }

  if (isWebPushConfigured()) {
    try {
      const app = getOrInitApp();
      const messaging = getMessaging(app);
      await deleteToken(messaging);
    } catch {
      /* sin instancia o token ya revocado */
    }
  }

  localStorage.removeItem(STORAGE_LAST_TOKEN);
}

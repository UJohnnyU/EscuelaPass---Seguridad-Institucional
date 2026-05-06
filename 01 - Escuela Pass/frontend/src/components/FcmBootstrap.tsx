import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { EP_FCM_NAV_CHANNEL } from '@/lib/fcm-nav-channel';
import { ensureWebPushRegistered, isWebPushConfigured } from '@/lib/fcm-web';

/**
 * Tras el login, registra FCM (si está configurado en .env) para recibir push en todos los dispositivos del usuario.
 */
export function FcmBootstrap() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id;

  useEffect(() => {
    if (!ready || !userId) return;
    if (!isWebPushConfigured()) return;
    void ensureWebPushRegistered(userId).then(undefined, () => undefined);
  }, [ready, userId]);

  /** Token FCM puede rotar; al volver a la pestaña re-sincronizamos con el API. */
  useEffect(() => {
    if (!ready || !userId || !isWebPushConfigured()) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(t);
      t = setTimeout(() => {
        void ensureWebPushRegistered(userId).then(undefined, () => undefined);
      }, 400);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ready, userId]);

  /* El service worker no puede navegar fiablemente en un SPA; al pulsar la notificación pide navegación por canal. */
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(EP_FCM_NAV_CHANNEL);
    ch.onmessage = (ev: MessageEvent<{ type?: string; path?: string }>) => {
      const path = ev?.data?.path;
      if (typeof path === 'string' && path.startsWith('/')) navigate(path);
    };
    return () => ch.close();
  }, [navigate]);

  return null;
}

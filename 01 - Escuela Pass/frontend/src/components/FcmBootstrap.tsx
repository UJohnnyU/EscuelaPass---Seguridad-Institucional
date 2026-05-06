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

  useEffect(() => {
    if (!ready || !user) return;
    if (!isWebPushConfigured()) return;
    void ensureWebPushRegistered().then(undefined, () => undefined);
  }, [ready, user?.id]);

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

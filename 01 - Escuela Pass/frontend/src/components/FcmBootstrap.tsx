import { useEffect } from 'react';
import { useAuth } from '@/context/useAuth';
import { ensureWebPushRegistered, isWebPushConfigured } from '@/lib/fcm-web';

/**
 * Tras el login, registra FCM (si está configurado en .env) para recibir push en todos los dispositivos del usuario.
 */
export function FcmBootstrap() {
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready || !user) return;
    if (!isWebPushConfigured()) return;
    void ensureWebPushRegistered().then(undefined, () => undefined);
  }, [ready, user?.id]);

  return null;
}

import type { AxiosError } from 'axios';

/** Convierte errores de red o API en mensajes legibles para personas (nunca JSON crudo). */
export function getUserFacingMessage(err: unknown, fallback = 'Ocurrió un error. Intenta de nuevo.'): string {
  if (typeof err === 'string' && err.trim()) return err.trim();

  const ax = err as AxiosError<{ message?: string | string[]; error?: string } | string | undefined>;
  const data = ax?.response?.data as unknown;
  if (data !== undefined && data !== null) {
    if (typeof data === 'string' && data.trim()) return data.trim();
    if (typeof data === 'object' && !Array.isArray(data)) {
      const d = data as { message?: string | string[]; error?: string };
      if (typeof d.message === 'string' && d.message.trim()) return d.message.trim();
      if (Array.isArray(d.message) && d.message.length) {
        const joined = d.message.map((m) => String(m).trim()).filter(Boolean).join('. ');
        if (joined) return joined;
      }
      if (typeof d.error === 'string' && d.error.trim()) return d.error.trim();
    }
  }

  if (ax?.message === 'Network Error') {
    return 'No hay conexión con el servidor. Comprueba tu red o que la aplicación esté disponible.';
  }

  /** `throw new Error(...)` en el cliente (p. ej. geolocalización); no es Axios. */
  if (!ax?.response && err instanceof Error && err.message.trim()) {
    return err.message.trim();
  }

  const status = ax?.response?.status;
  if (status === 401) return 'Sesión expirada o credenciales incorrectas. Inicia sesión de nuevo.';
  if (status === 403) return 'No tienes permiso para esta acción.';
  if (status === 404) return 'No se encontró lo que buscabas.';
  if (status === 400) {
    return 'La solicitud no fue aceptada por el servidor. Revise los datos e intente de nuevo.';
  }
  if (status === 409) return 'Conflicto con datos existentes. Revisa e intenta de nuevo.';
  if (status === 422) return 'Algunos datos no son válidos. Revisa el formulario.';
  if (status === 503) return 'El servicio no está disponible en este momento. Intenta más tarde.';
  if (status && status >= 500) return 'El servidor tuvo un problema. Intenta más tarde.';

  return fallback;
}

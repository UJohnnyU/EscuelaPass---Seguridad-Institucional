/**
 * Geolocalización para «Ya llegué» en circuito de recogida.
 * Prioriza respuesta rápida (red/Wi‑Fi) para no bloquear al padre demasiado tiempo.
 * Si no hay dato útil, intenta GPS preciso como respaldo.
 */

function getCurrentPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function geoCode(e: unknown): number {
  return e instanceof GeolocationPositionError ? e.code : 0;
}

async function ensureGeolocationPermission(): Promise<void> {
  if (typeof navigator === 'undefined' || !('permissions' in navigator)) return;
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    if (status.state === 'denied') {
      throw new Error(
        'La ubicación está bloqueada en este navegador. Habilítela desde el candado de la barra de direcciones y vuelva a intentar.'
      );
    }
  } catch {
    // Algunos navegadores no soportan correctamente esta consulta; se valida con getCurrentPosition.
  }
}

/**
 * @throws Error con mensaje en español listo para mostrar al usuario
 */
export async function requestGeolocationForCircuitArrival(): Promise<GeolocationPosition> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Su navegador no permite obtener la ubicación.');
  }
  await ensureGeolocationPermission();

  /** Intenta devolver una posición reciente casi al instante (ideal en escritorio). */
  const cachedFast: PositionOptions = {
    enableHighAccuracy: false,
    maximumAge: Infinity,
    timeout: 1_500
  };
  /** Obtención por red/Wi‑Fi con lectura fresca si no había caché útil. */
  const networkFresh: PositionOptions = {
    enableHighAccuracy: false,
    maximumAge: 0,
    timeout: 7_000
  };
  /** Alta precisión: respaldo si la vía rápida no logra obtener ubicación. */
  const precise: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 12_000
  };

  try {
    return await getCurrentPosition(cachedFast);
  } catch (first) {
    const c1 = geoCode(first);
    if (c1 === 1) {
      throw new Error(
        'Permita el acceso a la ubicación en el navegador (icono del candado en la barra de direcciones o ajustes del sitio).'
      );
    }

    try {
      return await getCurrentPosition(networkFresh);
    } catch (second) {
      const c2 = geoCode(second);
      if (c2 === 1) {
        throw new Error(
          'Permita el acceso a la ubicación en el navegador (icono del candado en la barra de direcciones o ajustes del sitio).'
        );
      }
      if (c2 === 2) {
        throw new Error(
          'No se pudo obtener la ubicación ni por GPS ni por red. Active la ubicación en el dispositivo, acérquese a una ventana o salga unos segundos al exterior y vuelva a pulsar «Ya llegué».'
        );
      }
      try {
        return await getCurrentPosition(precise);
      } catch (third) {
        const c3 = geoCode(third);
        if (c3 === 1) {
          throw new Error(
            'Permita el acceso a la ubicación en el navegador (icono del candado en la barra de direcciones o ajustes del sitio).'
          );
        }
        if (c3 === 2) {
          throw new Error(
            'No se pudo obtener la ubicación ni por GPS ni por red. Active la ubicación en el dispositivo, acérquese a una ventana o salga unos segundos al exterior y vuelva a pulsar «Ya llegué».'
          );
        }
        if (c3 === 3) {
          throw new Error(
            'No se pudo obtener ubicación a tiempo. En ordenador, verifique que la ubicación del sistema operativo esté activa y que el navegador tenga permiso del sitio.'
          );
        }
        throw new Error('No se pudo obtener la ubicación. Inténtelo de nuevo.');
      }
    }
  }
}

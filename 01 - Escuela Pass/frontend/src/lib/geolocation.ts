/**
 * Geolocalización para «Ya llegué» en circuito de recogida.
 * Primero intenta GPS de alta precisión; si falla (típico en interiores), reintenta con
 * posición asistida por red/Wi‑Fi (menos precisa pero suele devolver un punto útil).
 */

function getCurrentPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function geoCode(e: unknown): number {
  return e instanceof GeolocationPositionError ? e.code : 0;
}

/**
 * @throws Error con mensaje en español listo para mostrar al usuario
 */
export async function requestGeolocationForCircuitArrival(): Promise<GeolocationPosition> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Su navegador no permite obtener la ubicación.');
  }

  /** Alta precisión: puede fallar dentro de edificios (código 2 o 3). */
  const precise: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 22_000
  };
  /** Red/Wi‑Fi + posición reciente en caché: suele responder en interiores. */
  const networkAssisted: PositionOptions = {
    enableHighAccuracy: false,
    maximumAge: 180_000,
    timeout: 32_000
  };

  try {
    return await getCurrentPosition(precise);
  } catch (first) {
    const c1 = geoCode(first);
    if (c1 === 1) {
      throw new Error(
        'Permita el acceso a la ubicación en el navegador (icono del candado en la barra de direcciones o ajustes del sitio).'
      );
    }

    try {
      return await getCurrentPosition(networkAssisted);
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
      if (c2 === 3) {
        throw new Error(
          'Tiempo de espera agotado. Compruebe la señal o los permisos e inténtelo de nuevo en unos segundos.'
        );
      }
      throw new Error('No se pudo obtener la ubicación. Inténtelo de nuevo.');
    }
  }
}

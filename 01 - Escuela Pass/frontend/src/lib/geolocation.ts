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

/**
 * @throws Error con mensaje en español listo para mostrar al usuario
 */
export async function requestGeolocationForCircuitArrival(): Promise<GeolocationPosition> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Su navegador no permite obtener la ubicación.');
  }

  /** Red/Wi‑Fi + posición reciente: suele responder más rápido, incluso en interiores. */
  const networkAssisted: PositionOptions = {
    enableHighAccuracy: false,
    maximumAge: 300_000,
    timeout: 6_000
  };
  /** Alta precisión: respaldo si la vía rápida no logra obtener ubicación. */
  const precise: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10_000
  };

  try {
    return await getCurrentPosition(networkAssisted);
  } catch (first) {
    const c1 = geoCode(first);
    if (c1 === 1) {
      throw new Error(
        'Permita el acceso a la ubicación en el navegador (icono del candado en la barra de direcciones o ajustes del sitio).'
      );
    }

    try {
      return await getCurrentPosition(precise);
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
          'No se pudo obtener ubicación a tiempo. Active ubicación y GPS del dispositivo, muévase a un lugar con mejor señal y vuelva a pulsar «Ya llegué».'
        );
      }
      throw new Error('No se pudo obtener la ubicación. Inténtelo de nuevo.');
    }
  }
}

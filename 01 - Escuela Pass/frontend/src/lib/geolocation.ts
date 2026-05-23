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

/**
 * Geolocalización para circuito de recogida.
 * - requestGeolocationForCircuitArrival: obtención puntual (fallback en cascada).
 * - watchCircuitPosition: seguimiento continuo con watchPosition para el mapa en vivo.
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
          'No se pudo obtener la ubicación ni por GPS ni por red. Active la ubicación en el dispositivo, acérquese a una ventana o salga unos segundos al exterior y pulse de nuevo cuando el navegador solicite posición.'
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
            'No se pudo obtener la ubicación ni por GPS ni por red. Active la ubicación en el dispositivo, acérquese a una ventana o salga unos segundos al exterior y pulse de nuevo cuando el navegador solicite posición.'
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

export type WatchPositionCallback = (coords: { latitude: number; longitude: number }) => void;
export type WatchPositionErrorCallback = (message: string) => void;

/**
 * Inicia seguimiento continuo de la posición del padre con watchPosition.
 * Llama onPosition cada vez que se recibe una nueva coordenada.
 * Devuelve una función para detener el seguimiento (clearWatch).
 */
export function watchCircuitPosition(
  onPosition: WatchPositionCallback,
  onError?: WatchPositionErrorCallback
): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError?.('Su navegador no permite obtener la ubicación.');
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      onPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    },
    (err) => {
      if (err.code === 1) {
        onError?.('Permita el acceso a la ubicación en el navegador para mostrar el mapa en vivo.');
      } else if (err.code === 2) {
        onError?.('No se puede obtener la ubicación. Verifique que el GPS esté activo.');
      } else {
        onError?.('Tiempo de espera agotado al obtener la ubicación. El mapa se actualizará cuando haya señal.');
      }
    },
    { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}

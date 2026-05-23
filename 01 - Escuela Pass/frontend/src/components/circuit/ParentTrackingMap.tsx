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
 * Mapa en vivo del padre durante el circuito de recogida (estado PADRE_EN_CAMINO).
 * Usa watchPosition para actualización continua. Cuando el padre entra al radio
 * muestra un overlay visual destacado y detiene el seguimiento (el backend ya habrá
 * hecho la auto-transición a NOTIFICADO_LLEGADA).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  arrivalZoneFeature,
  attachMapboxStyleRecovery,
  findFirstSymbolLayerId,
  getMapboxStyleUrl,
  isMapboxConfigured,
  mapPinElement,
  mapboxgl
} from '@/lib/mapbox-basemap';
import { type AxiosError } from 'axios';
import { watchCircuitPosition } from '@/lib/geolocation';
import { api } from '@/lib/api';

const SOURCE_SCHOOL_ZONE = 'ep-parent-school-zone';
const LAYER_ZONE_FILL = 'ep-parent-zone-fill';
const LAYER_ZONE_LINE = 'ep-parent-zone-outline';

type Props = {
  circuitRequestId: string;
  schoolLatitude: number;
  schoolLongitude: number;
  arrivalRadiusKm: number;
  /** Callback cuando el backend confirma la auto-transición a NOTIFICADO_LLEGADA. */
  onAutoTransitioned?: () => void;
};

export function ParentTrackingMap({
  circuitRequestId,
  schoolLatitude,
  schoolLongitude,
  arrivalRadiusKm,
  onAutoTransitioned
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<InstanceType<typeof mapboxgl.Map> | null>(null);
  const parentMarkerRef = useRef<InstanceType<typeof mapboxgl.Marker> | null>(null);
  const schoolMarkerRef = useRef<InstanceType<typeof mapboxgl.Marker> | null>(null);
  const sendingRef = useRef(false);
  const [inRadius, setInRadius] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  const sendGpsUpdate = useCallback(
    async (lat: number, lng: number) => {
      if (sendingRef.current) return;
      sendingRef.current = true;
      try {
        const { data } = await api.patch<{
          autoTransitioned: boolean;
          distanceToSchoolKm: number;
          schoolRadiusKm: number;
        }>(`/api/v1/circuit-requests/${circuitRequestId}/gps`, {
          parentGpsLatitude: lat,
          parentGpsLongitude: lng
        });
        setDistanceKm(data.distanceToSchoolKm);
        if (data.autoTransitioned) {
          setInRadius(true);
          onAutoTransitioned?.();
        }
      } catch (e: unknown) {
        const ax = e as AxiosError<{ message?: string | string[] }>;
        const m = ax.response?.data?.message;
        if (typeof m === 'string') setGpsError(m);
        else if (Array.isArray(m)) setGpsError(m.join('. '));
        else
          setGpsError('No se pudo enviar tu ubicación al plantel. Comprueba la conexión y vuelve a intentarlo.');
      } finally {
        sendingRef.current = false;
      }
    },
    [circuitRequestId, onAutoTransitioned]
  );

  // Mapbox map initialization
  useEffect(() => {
    if (!mapContainerRef.current || !isMapboxConfigured()) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: getMapboxStyleUrl(),
      center: [schoolLongitude, schoolLatitude],
      zoom: 14,
      attributionControl: false
    });
    mapRef.current = map;
    attachMapboxStyleRecovery(map);

    map.on('load', () => {
      // School zone circle
      const zoneFeature = arrivalZoneFeature(schoolLatitude, schoolLongitude, arrivalRadiusKm);
      map.addSource(SOURCE_SCHOOL_ZONE, { type: 'geojson', data: zoneFeature });
      const firstSymbol = findFirstSymbolLayerId(map);
      map.addLayer(
        {
          id: LAYER_ZONE_FILL,
          type: 'fill',
          source: SOURCE_SCHOOL_ZONE,
          paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.12 }
        },
        firstSymbol
      );
      map.addLayer(
        {
          id: LAYER_ZONE_LINE,
          type: 'line',
          source: SOURCE_SCHOOL_ZONE,
          paint: { 'line-color': '#2563eb', 'line-width': 2, 'line-opacity': 0.6 }
        },
        firstSymbol
      );

      // School marker (pin)
      const schoolEl = mapPinElement('#dc2626', '#991b1b');
      schoolMarkerRef.current = new mapboxgl.Marker({ element: schoolEl })
        .setLngLat([schoolLongitude, schoolLatitude])
        .addTo(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [schoolLatitude, schoolLongitude, arrivalRadiusKm]);

  // GPS watch + parent marker update
  useEffect(() => {
    let lastSentAt = 0;
    const GPS_SEND_INTERVAL_MS = 6_000;

    const stopWatch = watchCircuitPosition(
      ({ latitude, longitude }) => {
        setGpsError(null);

        // Update parent marker on map
        const map = mapRef.current;
        if (map) {
          if (!parentMarkerRef.current) {
            const el = mapPinElement('#16a34a', '#15803d');
            parentMarkerRef.current = new mapboxgl.Marker({ element: el })
              .setLngLat([longitude, latitude])
              .addTo(map);
          } else {
            parentMarkerRef.current.setLngLat([longitude, latitude]);
          }
          // Auto-pan to keep parent in view
          map.panTo([longitude, latitude], { duration: 800 });
        }

        // Throttle GPS sends to backend
        const now = Date.now();
        if (now - lastSentAt >= GPS_SEND_INTERVAL_MS) {
          lastSentAt = now;
          void sendGpsUpdate(latitude, longitude);
        }
      },
      (errMsg) => setGpsError(errMsg)
    );

    return stopWatch;
  }, [sendGpsUpdate]);

  if (!isMapboxConfigured()) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/35 dark:text-amber-100">
        El mapa en vivo requiere configurar la clave de Mapbox (VITE_MAPBOX_TOKEN). Tu ubicación se sigue enviando
        al plantel aunque no se muestre el mapa.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {inRadius && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border-2 border-emerald-500 bg-emerald-50 px-4 py-4 shadow-md dark:border-emerald-400 dark:bg-emerald-950/50"
        >
          <span className="relative flex h-4 w-4 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500" />
          </span>
          <div>
            <p className="font-semibold text-emerald-900 dark:text-emerald-100">Ya estás en el radio del plantel</p>
            <p className="text-xs text-emerald-800 dark:text-emerald-200">
              El personal fue notificado automáticamente. Espera la autorización de salida.
            </p>
          </div>
        </div>
      )}

      {gpsError && !inRadius && (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/35 dark:text-amber-100">
          {gpsError}
        </p>
      )}

      <div className="relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <div ref={mapContainerRef} className="h-64 w-full" aria-label="Mapa de seguimiento en vivo" />
        {distanceKm !== null && (
          <div className="absolute bottom-2 right-2 rounded bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 shadow dark:bg-slate-900/90 dark:text-slate-200">
            {distanceKm < 1
              ? `${Math.round(distanceKm * 1000)} m del plantel`
              : `${distanceKm.toFixed(2)} km del plantel`}
          </div>
        )}
        <div className="absolute top-2 left-2 flex flex-col gap-1 text-xs">
          <span className="flex items-center gap-1 rounded bg-white/90 px-2 py-0.5 shadow dark:bg-slate-900/90">
            <span className="inline-block h-2 w-2 rounded-full bg-red-600" /> Plantel
          </span>
          <span className="flex items-center gap-1 rounded bg-white/90 px-2 py-0.5 shadow dark:bg-slate-900/90">
            <span className="inline-block h-2 w-2 rounded-full bg-green-600" /> Tu posición
          </span>
        </div>
      </div>

      {!inRadius && (
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Tu ubicación se comparte con el plantel en tiempo real. Cuando entres al radio (círculo azul),
          el sistema registrará tu llegada automáticamente.
        </p>
      )}
    </div>
  );
}

import { useEffect, useRef } from 'react';
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

const SOURCE_ARRIVAL = 'escuela-circuit-arrival-zone';
const LAYER_ARRIVAL_FILL = 'escuela-circuit-arrival-fill';
const LAYER_ARRIVAL_LINE = 'escuela-circuit-arrival-outline';

export type MapContextPayload = {
  schoolLatitude: number;
  schoolLongitude: number;
  arrivalSnapshotLatitude: string | null;
  arrivalSnapshotLongitude: string | null;
  arrivalSnapshotAt: string | null;
  /** Respaldo si la instantánea aún no está en el cliente (misma posición guardada al marcar llegada). */
  parentGpsLatitude?: string | null;
  parentGpsLongitude?: string | null;
  arrivalRadiusKm: number;
  distanceToSchoolKm: number | null;
  withinSchoolArrivalRadius: boolean | null;
  etaMinutes: number | null;
};

type CircuitArrivalMapProps = {
  ctx: MapContextPayload;
};

export function CircuitArrivalMap({ ctx }: CircuitArrivalMapProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const latStr = ctx.arrivalSnapshotLatitude ?? ctx.parentGpsLatitude ?? null;
  const lngStr = ctx.arrivalSnapshotLongitude ?? ctx.parentGpsLongitude ?? null;
  const lat = latStr != null ? Number(latStr) : NaN;
  const lng = lngStr != null ? Number(lngStr) : NaN;
  const hasParent = Number.isFinite(lat) && Number.isFinite(lng);
  const fromSnapshot = ctx.arrivalSnapshotLatitude != null && ctx.arrivalSnapshotLongitude != null;

  useEffect(() => {
    if (!hasParent || !isMapboxConfigured()) return;

    const container = wrapRef.current;
    if (!container) return;

    const schoolLng = ctx.schoolLongitude;
    const schoolLat = ctx.schoolLatitude;

    const map = new mapboxgl.Map({
      container,
      style: getMapboxStyleUrl(),
      center: [schoolLng, schoolLat],
      zoom: 14,
      pitch: 0
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }), 'top-right');
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

    const schoolMarker = new mapboxgl.Marker({
      element: mapPinElement('#0f766e', '#115e59'),
      anchor: 'bottom'
    })
      .setLngLat([schoolLng, schoolLat])
      .setPopup(
        new mapboxgl.Popup({ offset: 28, closeButton: true, maxWidth: '320px' }).setHTML(
          '<strong>Institución</strong><br/><span style="font-size:12px;color:#64748b">Punto de referencia del circuito</span>'
        )
      )
      .addTo(map);

    const parentTitle = fromSnapshot
      ? 'Ubicación al marcar «Ya llegué»'
      : 'Última ubicación GPS registrada';
    const parentWhen = ctx.arrivalSnapshotAt
      ? `<br/><span style="font-size:12px;color:#64748b">${escapeHtml(new Date(ctx.arrivalSnapshotAt).toLocaleString('es'))}</span>`
      : '';
    const parentMarker = new mapboxgl.Marker({
      element: mapPinElement('#d97706', '#b45309'),
      anchor: 'bottom'
    })
      .setLngLat([lng, lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 28, closeButton: true, maxWidth: '320px' }).setHTML(
          `<strong>${parentTitle}</strong>${parentWhen}`
        )
      )
      .addTo(map);

    const fit = () => {
      const bounds = new mapboxgl.LngLatBounds()
        .extend([schoolLng, schoolLat])
        .extend([lng, lat]);
      map.fitBounds(bounds, {
        padding: { top: 96, bottom: 80, left: 80, right: 80 },
        maxZoom: 16,
        duration: 640
      });
    };

    const onStyleLoad = () => {
      const radius = Number(ctx.arrivalRadiusKm);
      const showZone = Number.isFinite(radius) && radius > 0 && radius <= 200;

      if (showZone) {
        if (!map.getSource(SOURCE_ARRIVAL)) {
          const beforeId = findFirstSymbolLayerId(map);
          map.addSource(SOURCE_ARRIVAL, {
            type: 'geojson',
            data: arrivalZoneFeature(schoolLng, schoolLat, radius)
          });
          const fillSpec = {
            id: LAYER_ARRIVAL_FILL,
            type: 'fill' as const,
            source: SOURCE_ARRIVAL,
            paint: {
              'fill-color': '#0d9488',
              'fill-opacity': 0.14
            }
          };
          const lineSpec = {
            id: LAYER_ARRIVAL_LINE,
            type: 'line' as const,
            source: SOURCE_ARRIVAL,
            paint: {
              'line-color': '#0f766e',
              'line-width': 2,
              'line-opacity': 0.82
            }
          };
          if (beforeId) {
            map.addLayer(fillSpec, beforeId);
            map.addLayer(lineSpec, beforeId);
          } else {
            map.addLayer(fillSpec);
            map.addLayer(lineSpec);
          }
        }
      }

      fit();
    };

    const removeRecovery = attachMapboxStyleRecovery(map);
    map.on('style.load', onStyleLoad);

    const ro = new ResizeObserver(() => {
      try {
        map.resize();
      } catch {
        /* noop */
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      removeRecovery();
      map.off('style.load', onStyleLoad);
      schoolMarker.remove();
      parentMarker.remove();
      map.remove();
    };
  }, [
    hasParent,
    ctx.schoolLatitude,
    ctx.schoolLongitude,
    ctx.arrivalRadiusKm,
    ctx.arrivalSnapshotAt,
    fromSnapshot,
    lat,
    lng
  ]);

  if (!hasParent) {
    return (
      <p className="text-sm text-slate-600">
        Aún no hay una ubicación de llegada registrada. El padre o madre debe marcar «Ya llegué» con el GPS activo.
      </p>
    );
  }

  if (!isMapboxConfigured()) {
    return (
      <div className="rounded-lg border border-amber-200/80 bg-gradient-to-b from-amber-50 to-amber-50/50 px-5 py-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-amber-950">Mapa no disponible en este entorno</p>
        <p className="mt-2 text-xs leading-relaxed text-amber-900/85">
          Defina la variable{' '}
          <code className="rounded bg-amber-100/90 px-1.5 py-0.5 font-mono text-[11px] text-amber-950">
            VITE_MAPBOX_ACCESS_TOKEN
          </code>{' '}
          en el build del frontend (p. ej. Vercel o Railway) con un{' '}
          <a
            className="font-medium text-amber-800 underline decoration-amber-600/60 underline-offset-2 hover:text-amber-950"
            href="https://docs.mapbox.com/help/getting-started/access-tokens/"
            target="_blank"
            rel="noreferrer"
          >
            token de acceso Mapbox
          </a>
          . El backend ya puede usar la API de Mapbox para rutas; el mismo proyecto puede reutilizarse.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={wrapRef}
        className="relative h-80 min-h-[18rem] w-full overflow-hidden rounded-lg border border-slate-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.06)] ring-1 ring-slate-900/5"
      />
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Distancia a la institución</dt>
          <dd className="mt-0.5 font-medium text-slate-900">
            {ctx.distanceToSchoolKm != null ? `${ctx.distanceToSchoolKm} km` : '—'}
            {ctx.etaMinutes != null ? ` · ~${ctx.etaMinutes} min` : ''}
          </dd>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Dentro del radio configurado</dt>
          <dd className="mt-0.5 font-medium text-slate-900">
            {ctx.withinSchoolArrivalRadius === null
              ? '—'
              : ctx.withinSchoolArrivalRadius
                ? 'Sí'
                : 'No (considere pedir nueva confirmación)'}
            {ctx.arrivalRadiusKm != null ? ` (radio ${ctx.arrivalRadiusKm} km)` : ''}
          </dd>
        </div>
      </dl>
      <p className="text-[11px] leading-snug text-slate-400">
        © Mapbox © OpenStreetMap. El área sombreada muestra el radio de llegada configurado para la institución.
      </p>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

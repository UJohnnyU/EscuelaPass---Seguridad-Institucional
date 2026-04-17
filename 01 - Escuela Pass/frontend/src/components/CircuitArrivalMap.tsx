import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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
  accessToken: string;
  ctx: MapContextPayload;
};

export function CircuitArrivalMap({ accessToken, ctx }: CircuitArrivalMapProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const latStr = ctx.arrivalSnapshotLatitude ?? ctx.parentGpsLatitude ?? null;
  const lngStr = ctx.arrivalSnapshotLongitude ?? ctx.parentGpsLongitude ?? null;
  const lat = latStr != null ? Number(latStr) : NaN;
  const lng = lngStr != null ? Number(lngStr) : NaN;
  const hasParent = Number.isFinite(lat) && Number.isFinite(lng);
  const fromSnapshot = ctx.arrivalSnapshotLatitude != null && ctx.arrivalSnapshotLongitude != null;

  useEffect(() => {
    const el = wrapRef.current;
    if (!accessToken || !hasParent || !el) return;

    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      container: el,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [ctx.schoolLongitude, ctx.schoolLatitude],
      zoom: 14
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    const schoolMarker = new mapboxgl.Marker({ color: '#0f766e' })
      .setLngLat([ctx.schoolLongitude, ctx.schoolLatitude])
      .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML('<strong>Institución</strong>'))
      .addTo(map);

    const parentMarker = new mapboxgl.Marker({ color: '#b45309' })
      .setLngLat([lng, lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 16 }).setHTML(
          `<strong>${fromSnapshot ? 'Ubicación al marcar «Ya llegué»' : 'Última ubicación GPS registrada'}</strong>` +
            (ctx.arrivalSnapshotAt
              ? `<br/><span style="font-size:12px">${new Date(ctx.arrivalSnapshotAt).toLocaleString('es')}</span>`
              : '')
        )
      )
      .addTo(map);

    const bounds = new mapboxgl.LngLatBounds()
      .extend([ctx.schoolLongitude, ctx.schoolLatitude])
      .extend([lng, lat]);
    map.fitBounds(bounds, { padding: 72, maxZoom: 16, duration: 0 });

    return () => {
      schoolMarker.remove();
      parentMarker.remove();
      map.remove();
    };
  }, [accessToken, ctx.schoolLatitude, ctx.schoolLongitude, ctx.arrivalSnapshotAt, fromSnapshot, hasParent, lat, lng]);

  if (!accessToken) {
    return (
      <p className="text-sm text-amber-900">
        Falta <code className="rounded bg-amber-100 px-1">VITE_MAPBOX_ACCESS_TOKEN</code> en el frontend para mostrar el
        mapa.
      </p>
    );
  }

  if (!hasParent) {
    return (
      <p className="text-sm text-slate-600">
        Aún no hay una ubicación de llegada registrada. El padre o madre debe marcar «Ya llegué» con el GPS activo.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={wrapRef} className="h-72 w-full overflow-hidden rounded-lg border border-slate-200 shadow-inner" />
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Distancia a la institución</dt>
          <dd className="font-medium text-slate-900">
            {ctx.distanceToSchoolKm != null ? `${ctx.distanceToSchoolKm} km` : '—'}
            {ctx.etaMinutes != null ? ` · ~${ctx.etaMinutes} min` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Dentro del radio configurado</dt>
          <dd className="font-medium text-slate-900">
            {ctx.withinSchoolArrivalRadius === null
              ? '—'
              : ctx.withinSchoolArrivalRadius
                ? 'Sí'
                : 'No (considere pedir nueva confirmación)'}
            {ctx.arrivalRadiusKm != null ? ` (radio ${ctx.arrivalRadiusKm} km)` : ''}
          </dd>
        </div>
      </dl>
    </div>
  );
}

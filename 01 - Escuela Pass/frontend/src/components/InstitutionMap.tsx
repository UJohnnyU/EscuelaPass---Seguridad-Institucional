import { useEffect, useRef } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { attachMapboxStyleRecovery, getMapboxStyleUrl, isMapboxConfigured, mapPinElement, mapboxgl } from '@/lib/mapbox-basemap';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function InstitutionMap({
  latitude,
  longitude,
  name
}: {
  latitude: number;
  longitude: number;
  name?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMapboxConfigured()) return;
    const el = wrapRef.current;
    if (!el) return;

    const map = new mapboxgl.Map({
      container: el,
      style: getMapboxStyleUrl(),
      center: [longitude, latitude],
      zoom: 15.5,
      pitch: 0
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }), 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

    const marker = new mapboxgl.Marker({ element: mapPinElement('#0f766e', '#115e59'), anchor: 'bottom' })
      .setLngLat([longitude, latitude])
      .setPopup(
        new mapboxgl.Popup({ offset: 28, closeButton: true, maxWidth: '300px' }).setHTML(
          `<strong>${escapeHtml(name ?? 'Institución')}</strong><br/><span style="font-size:12px;color:#64748b">Ubicación registrada</span>`
        )
      )
      .addTo(map);

    const removeRecovery = attachMapboxStyleRecovery(map);

    const ro = new ResizeObserver(() => {
      try {
        map.resize();
      } catch {
        /* noop */
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      removeRecovery();
      marker.remove();
      map.remove();
    };
  }, [latitude, longitude, name]);

  if (!isMapboxConfigured()) {
    return (
      <div className="flex h-72 min-h-[18rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-600">
        <p className="font-medium text-slate-800">Vista de mapa no configurada</p>
        <p className="max-w-sm text-xs leading-relaxed text-slate-500">
          Añada{' '}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800 ring-1 ring-slate-200">
            VITE_MAPBOX_ACCESS_TOKEN
          </code>{' '}
          al entorno del frontend. Las coordenadas siguen mostrándose en texto y en el enlace a OpenStreetMap.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="h-72 min-h-[18rem] w-full overflow-hidden rounded-xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] ring-1 ring-slate-900/5"
    />
  );
}

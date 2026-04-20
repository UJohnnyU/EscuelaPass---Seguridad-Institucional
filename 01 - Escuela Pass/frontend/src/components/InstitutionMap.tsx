import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors'
    }
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
};

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
    const el = wrapRef.current;
    if (!el) return;
    const map = new maplibregl.Map({
      container: el,
      style: OSM_STYLE as never,
      center: [longitude, latitude],
      zoom: 15
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    const marker = new maplibregl.Marker({ color: '#0f766e' })
      .setLngLat([longitude, latitude])
      .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(`<strong>${name ?? 'Institución'}</strong>`))
      .addTo(map);
    return () => {
      marker.remove();
      map.remove();
    };
  }, [latitude, longitude, name]);

  return <div ref={wrapRef} className="h-72 w-full overflow-hidden rounded-xl border border-slate-200 shadow-inner" />;
}

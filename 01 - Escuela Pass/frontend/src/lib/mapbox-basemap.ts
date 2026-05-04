import mapboxgl from 'mapbox-gl';

const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim();

if (token) {
  mapboxgl.accessToken = token;
}

/** Estilo claro y legible para contexto educativo; se puede sustituir por estilo personalizado en Mapbox Studio. */
export function getMapboxStyleUrl(): string {
  const custom = import.meta.env.VITE_MAPBOX_STYLE_URL?.trim();
  if (custom) return custom;
  return 'mapbox://styles/mapbox/light-v11';
}

export function isMapboxConfigured(): boolean {
  return Boolean(token);
}

/** Inserta capas vectoriales debajo de etiquetas para que los textos del mapa sigan legibles. */
export function findFirstSymbolLayerId(map: mapboxgl.Map): string | undefined {
  const layers = map.getStyle()?.layers;
  if (!layers) return undefined;
  const sym = layers.find((l) => l.type === 'symbol');
  return sym?.id;
}

/**
 * Polígono aproximado del radio de llegada (km) alrededor de la institución.
 * Válido para radios pequeños respecto a la curvatura terrestre (típico en circuito escolar).
 */
export function arrivalZoneFeature(
  centerLng: number,
  centerLat: number,
  radiusKm: number,
  steps = 80
): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: [number, number][] = [];
  const latRad = (centerLat * Math.PI) / 180;
  const kmPerDegLat = 110.574;
  const kmPerDegLng = 110.574 * Math.max(0.02, Math.cos(latRad));

  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    const dxKm = radiusKm * Math.cos(theta);
    const dyKm = radiusKm * Math.sin(theta);
    ring.push([centerLng + dxKm / kmPerDegLng, centerLat + dyKm / kmPerDegLat]);
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [ring]
    }
  };
}

export function mapPinElement(fill: string, stroke: string): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'escuela-map-pin';
  wrap.setAttribute('role', 'presentation');
  wrap.style.width = '40px';
  wrap.style.height = '48px';
  wrap.style.cursor = 'pointer';
  wrap.innerHTML = `
<svg width="40" height="48" viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path style="filter: drop-shadow(0 2px 3px rgba(15,23,42,0.35))"
        d="M20 2C11.8 2 5 8.5 5 16.2c0 11.2 15 26.5 15 26.5s15-15.3 15-26.5C35 8.5 28.2 2 20 2z"
        fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
  <circle cx="20" cy="16.5" r="4" fill="white" fill-opacity="0.95"/>
</svg>`;
  return wrap;
}

export { mapboxgl };

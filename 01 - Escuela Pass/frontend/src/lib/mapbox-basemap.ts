import mapboxgl from 'mapbox-gl';

const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim();

if (token) {
  mapboxgl.accessToken = token;
}

/** Estilo Mapbox estable por defecto si el de Studio falla o el token no puede cargarlo. */
export const MAPBOX_FALLBACK_STYLE = 'mapbox://styles/mapbox/light-v11';

/** Estilo claro y legible para contexto educativo; se puede sustituir por estilo personalizado en Mapbox Studio. */
export function getMapboxStyleUrl(): string {
  const custom = import.meta.env.VITE_MAPBOX_STYLE_URL?.trim();
  if (custom) return custom;
  return MAPBOX_FALLBACK_STYLE;
}

export function isMapboxConfigured(): boolean {
  return Boolean(token);
}

/** True si hay URL de estilo propia (p. ej. Mapbox Studio), para activar recuperación ante fallos. */
export function hasCustomMapboxStyle(): boolean {
  return Boolean(import.meta.env.VITE_MAPBOX_STYLE_URL?.trim());
}

function mapErrorMessage(e: mapboxgl.ErrorEvent): string {
  const err = e.error;
  if (err instanceof Error) return err.message;
  if (err != null && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err ?? '');
}

/**
 * Si el estilo Studio o las teselas fallan (token sin URL permitida, 401/403, estilo no publicado),
 * el canvas queda en blanco pero los controles y el marcador HTML sí aparecen. Cambia al estilo light oficial.
 */
export function attachMapboxStyleRecovery(map: mapboxgl.Map): () => void {
  if (!hasCustomMapboxStyle()) {
    return () => {};
  }

  let didFallback = false;
  const fallback = (reason: string) => {
    if (didFallback) return;
    didFallback = true;
    if (import.meta.env.DEV) {
      console.warn(
        `[mapbox] Estilo personalizado no usable (${reason}). Revisá URLs permitidas del token (p. ej. http://localhost:5173), que el estilo esté publicado en Studio y el token del mismo usuario. Usando ${MAPBOX_FALLBACK_STYLE}.`
      );
    }
    map.setStyle(MAPBOX_FALLBACK_STYLE);
  };

  const onError = (e: mapboxgl.ErrorEvent) => {
    const msg = mapErrorMessage(e);
    if (
      /style|tiles|glyphs|sprite|Unauthorized|Forbidden|401|403|404|Failed to fetch|NetworkError|could not be loaded|ERR_FAILED|ACL|Not Found/i.test(
        msg
      )
    ) {
      fallback(msg || 'error');
    }
  };

  map.on('error', onError);

  const timer = window.setTimeout(() => {
    if (didFallback) return;
    if (!map.isStyleLoaded()) {
      fallback('timeout: estilo sin cargar');
    }
  }, 12000);

  map.once('style.load', () => {
    window.clearTimeout(timer);
  });

  return () => {
    window.clearTimeout(timer);
    map.off('error', onError);
  };
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

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

import mapboxgl from 'mapbox-gl';
import mapboxglWorkerUrl from 'mapbox-gl/dist/mapbox-gl-csp-worker.js?url';

/**
 * En Vercel/hosts con CSP estricto, el worker por defecto (blob:) queda bloqueado y el mapa sale en blanco
 * aunque logo y controles carguen. El worker CSP se sirve como asset con URL propia.
 * @see https://docs.mapbox.com/mapbox-gl-js/guides/install/#csp-directives
 */
mapboxgl.workerUrl = mapboxglWorkerUrl;

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

function shouldFallbackToLightStyle(errorMessage: string): boolean {
  const msg = errorMessage;
  if (!msg.trim()) return false;
  const lower = msg.toLowerCase();
  // Solo fallback ante fallos “duros”: auth, estilo inexistente, red al cargar el JSON del estilo.
  if (/\b401\b|\b403\b|\b404\b/.test(msg)) return true;
  if (/unauthorized|forbidden|access denied|invalid\s+access\s+token|not\s+found/i.test(msg)) return true;
  if (
    /failed\s+to\s+load\s+style|could\s+not\s+load\s+style|error\s+loading\s+the\s+style|style\s+(is\s+)?not\s+available|style\s+not\s+found|fetch\s+style/i.test(
      lower
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Último recurso si el JSON del estilo nunca termina de cargar (muy lento o bloqueado).
 * No usa heurísticas de teselas (areTilesLoaded) para no forzar light-v11 en estilos Studio válidos.
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
        `[mapbox] Estilo personalizado no usable (${reason}). Revisá token del mismo usuario que el estilo, estilo publicado en Studio (puede tardar unos minutos) y URLs permitidas del token para este dominio. Usando ${MAPBOX_FALLBACK_STYLE}. Ver https://docs.mapbox.com/help/tutorials/add-data-to-mapbox-style/ · troubleshooting.`
      );
    } else {
      console.warn(
        `[mapbox] Estilo personalizado no cargó (${reason}). Mostrando mapa base Mapbox. Revise token, estilo publicado y restricciones de URL en mapbox.com/account/access-tokens.`
      );
    }
    map.setStyle(MAPBOX_FALLBACK_STYLE);
  };

  const onError = (e: mapboxgl.ErrorEvent) => {
    const msg = mapErrorMessage(e);
    if (shouldFallbackToLightStyle(msg)) {
      fallback(msg || 'error');
    }
  };

  map.on('error', onError);

  const timer = window.setTimeout(() => {
    if (didFallback) return;
    if (!map.isStyleLoaded()) {
      fallback('timeout: estilo sin cargar');
    }
  }, 30000);

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
  const sym = layers.find((l: { type?: string }) => l.type === 'symbol');
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

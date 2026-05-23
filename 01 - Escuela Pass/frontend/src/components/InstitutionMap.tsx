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

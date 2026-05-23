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

/** Transiciones que puede aplicar personal (alineado al backend). */
/** Alineado al backend: la entrega final la confirma el padre (o consentimiento solo por institución). */
export const STAFF_ALLOWED_NEXT: Record<string, string[]> = {
  PENDIENTE: ['PADRE_EN_CAMINO', 'CANCELADO', 'CONSENTIDO_SOLO'],
  PADRE_EN_CAMINO: ['CANCELADO'],
  NOTIFICADO_LLEGADA: ['AUTORIZADO_SALIR', 'PADRE_EN_CAMINO', 'CANCELADO'],
  AUTORIZADO_SALIR: ['EN_CAMINO', 'CANCELADO'],
  EN_CAMINO: ['CANCELADO'],
  ENTREGADO: [],
  CERRADO_SIN_CONFIRMACION_PADRE: [],
  CONSENTIDO_SOLO: ['ENTREGADO', 'CANCELADO'],
  CANCELADO: []
};

/**
 * Un solo paso siguiente en el flujo operativo “feliz” (sin saltos en la UI).
 * Debe existir en STAFF_ALLOWED_NEXT para el estado actual.
 */
const STAFF_PRIMARY_CHAIN: Record<string, string | null> = {
  PENDIENTE: 'PADRE_EN_CAMINO',
  PADRE_EN_CAMINO: null,
  NOTIFICADO_LLEGADA: 'AUTORIZADO_SALIR',
  AUTORIZADO_SALIR: 'EN_CAMINO',
  EN_CAMINO: null,
  CONSENTIDO_SOLO: 'ENTREGADO'
};

export function getPrimaryNextOperationalStatus(status: string): string | null {
  const next = STAFF_PRIMARY_CHAIN[status];
  if (next === undefined || next === null) return null;
  const allowed = STAFF_ALLOWED_NEXT[status] ?? [];
  return allowed.includes(next) ? next : null;
}

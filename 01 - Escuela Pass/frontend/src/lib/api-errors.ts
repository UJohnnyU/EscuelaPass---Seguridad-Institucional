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

import type { AxiosError } from 'axios';

/** Convierte errores de red o API en mensajes legibles para personas (nunca JSON crudo). */
export function getUserFacingMessage(err: unknown, fallback = 'Ocurrió un error. Intenta de nuevo.'): string {
  if (typeof err === 'string' && err.trim()) return err.trim();

  const ax = err as AxiosError<{ message?: string | string[]; error?: string } | string | undefined>;
  const data = ax?.response?.data as unknown;
  if (data !== undefined && data !== null) {
    if (typeof data === 'string' && data.trim()) return data.trim();
    if (typeof data === 'object' && !Array.isArray(data)) {
      const d = data as { message?: string | string[]; error?: string };
      if (typeof d.message === 'string' && d.message.trim()) return d.message.trim();
      if (Array.isArray(d.message) && d.message.length) {
        const joined = d.message.map((m) => String(m).trim()).filter(Boolean).join('. ');
        if (joined) return joined;
      }
      if (typeof d.error === 'string' && d.error.trim()) return d.error.trim();
    }
  }

  if (ax?.message === 'Network Error') {
    return 'No hay conexión con el servidor. Comprueba tu red o que la aplicación esté disponible.';
  }

  /** `throw new Error(...)` en el cliente (p. ej. geolocalización); no es Axios. */
  if (!ax?.response && err instanceof Error && err.message.trim()) {
    return err.message.trim();
  }

  const status = ax?.response?.status;
  if (status === 401) return 'Sesión expirada o credenciales incorrectas. Inicia sesión de nuevo.';
  if (status === 403) return 'No tienes permiso para esta acción.';
  if (status === 404) return 'No se encontró lo que buscabas.';
  if (status === 400) {
    return 'La solicitud no fue aceptada por el servidor. Revise los datos e intente de nuevo.';
  }
  if (status === 409) return 'Conflicto con datos existentes. Revisa e intenta de nuevo.';
  if (status === 422) return 'Algunos datos no son válidos. Revisa el formulario.';
  if (status === 503) return 'El servicio no está disponible en este momento. Intenta más tarde.';
  if (status && status >= 500) return 'El servidor tuvo un problema. Intenta más tarde.';

  return fallback;
}

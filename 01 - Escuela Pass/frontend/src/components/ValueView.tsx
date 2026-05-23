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

import type { ReactNode } from 'react';

/** Elimina identificadores técnicos antes de mostrar datos a usuarios finales. */
export function stripTechnicalIds(value: unknown, depth = 0): unknown {
  if (depth > 8) return value;
  if (Array.isArray(value)) {
    return value.map((v) => stripTechnicalIds(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    const o = { ...(value as Record<string, unknown>) };
    for (const k of Object.keys(o)) {
      if (
        k === 'id' ||
        k.endsWith('Id') ||
        k.endsWith('_id') ||
        k === 'passwordHash' ||
        k === 'tokenHash'
      ) {
        delete o[k];
        continue;
      }
      o[k] = stripTechnicalIds(o[k], depth + 1);
    }
    return o;
  }
  if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return '—';
  }
  return value;
}

/** Presenta datos de API de forma legible (sin JSON crudo ni IDs innecesarios). */
export function ValueView({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const cleaned = depth === 0 ? stripTechnicalIds(data) : data;

  if (cleaned === null || cleaned === undefined) {
    return <span className="text-slate-400 dark:text-slate-500">—</span>;
  }
  if (typeof cleaned === 'boolean') return <span>{cleaned ? 'Sí' : 'No'}</span>;
  if (typeof cleaned === 'number') return <span>{cleaned}</span>;
  if (typeof cleaned === 'string') {
    if (cleaned === '—') return <span className="text-slate-400 dark:text-slate-500">—</span>;
    const iso = /^\d{4}-\d{2}-\d{2}T/.test(cleaned);
    if (iso) {
      try {
        return <span>{new Date(cleaned).toLocaleString('es')}</span>;
      } catch {
        /* fallthrough */
      }
    }
    return <span className="break-words">{cleaned}</span>;
  }
  if (Array.isArray(cleaned)) {
    if (cleaned.length === 0) return <span className="text-slate-400 dark:text-slate-500">Sin registros</span>;
    if (depth > 4) return <span className="text-slate-500 dark:text-slate-400">…</span>;
    return (
      <ul className="space-y-3 border-l border-slate-200 pl-3 dark:border-slate-700">
        {cleaned.map((item, i) => (
          <li key={i} className="text-sm">
            <ValueView data={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }
  if (typeof cleaned === 'object') {
    const o = cleaned as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 0) return <span className="text-slate-400 dark:text-slate-500">Sin datos</span>;
    return (
      <dl className="grid gap-2 text-sm">
        {keys.map((k) => (
          <div key={k} className="grid grid-cols-1 gap-0.5 border-b border-slate-100 py-2 dark:border-slate-700 sm:grid-cols-3 sm:gap-4">
            <dt className="font-medium text-slate-500 dark:text-slate-400">{labelKey(k)}</dt>
            <dd className="text-slate-900 dark:text-slate-100 sm:col-span-2">
              <ValueView data={o[k]} depth={depth + 1} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span>{String(cleaned)}</span>;
}

function labelKey(k: string): string {
  const map: Record<string, string> = {
    total: 'Total',
    date: 'Fecha',
    status: 'Estado',
    message: 'Mensaje',
    title: 'Título',
    fullName: 'Nombre',
    nombreCompleto: 'Nombre completo',
    matriculaAlumno: 'Matrícula',
    rol: 'Rol',
    entities: 'Resumen',
    attendanceToday: 'Asistencia del día',
    payments: 'Pagos',
    circuitToday: 'Circuito',
    accessToday: 'Accesos',
    persona: 'Persona',
    nonInstructionalDay: 'Día no lectivo',
    records: 'Registros',
    email: 'Correo',
    name: 'Nombre',
    amount: 'Importe',
    dueDate: 'Vencimiento',
    matricula: 'Matrícula',
    content: 'Contenido',
    version: 'Versión',
    effectiveAt: 'Vigencia desde',
    acceptedAt: 'Aceptado el',
    policyVersion: 'Versión aceptada'
  };
  return map[k] ?? k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
}

export function Panel({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
        <h2 className="font-serif text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>}
      </div>
      <div className="min-w-0 p-5">{children}</div>
    </section>
  );
}

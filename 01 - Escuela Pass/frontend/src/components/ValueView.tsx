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
    return <span className="text-slate-400">—</span>;
  }
  if (typeof cleaned === 'boolean') return <span>{cleaned ? 'Sí' : 'No'}</span>;
  if (typeof cleaned === 'number') return <span>{cleaned}</span>;
  if (typeof cleaned === 'string') {
    if (cleaned === '—') return <span className="text-slate-400">—</span>;
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
    if (cleaned.length === 0) return <span className="text-slate-400">Sin registros</span>;
    if (depth > 4) return <span className="text-slate-500">…</span>;
    return (
      <ul className="space-y-3 border-l border-slate-200 pl-3">
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
    if (keys.length === 0) return <span className="text-slate-400">Sin datos</span>;
    return (
      <dl className="grid gap-2 text-sm">
        {keys.map((k) => (
          <div key={k} className="grid grid-cols-1 gap-0.5 border-b border-slate-100 py-2 sm:grid-cols-3 sm:gap-4">
            <dt className="font-medium text-slate-500">{labelKey(k)}</dt>
            <dd className="sm:col-span-2 text-slate-900">
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
    <section className="rounded border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
        <h2 className="font-serif text-lg font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

import type { ReactNode } from 'react';

/** Scroll vertical (y horizontal si hace falta) con altura acotada para listas largas */
export const DATA_TABLE_SCROLL =
  'max-h-[min(70vh,28rem)] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700';

/** Cabecera de tabla que permanece visible al hacer scroll dentro del contenedor */
export const DATA_TABLE_HEAD =
  'sticky top-0 z-[1] bg-white shadow-[0_1px_0_0_rgb(226_232_240)] dark:bg-slate-900 dark:shadow-[0_1px_0_0_rgb(71_85_105)]';

export function DataTableScroll({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${DATA_TABLE_SCROLL} ${className}`.trim()}>{children}</div>;
}

export const DATA_TABLE_SEARCH_INPUT =
  'w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500';

/** Listas largas dentro de tarjetas/paneles (solo scroll, sin borde extra) */
export const SCROLLABLE_PANEL_BODY =
  'max-h-[min(70vh,28rem)] overflow-y-auto overflow-x-hidden';

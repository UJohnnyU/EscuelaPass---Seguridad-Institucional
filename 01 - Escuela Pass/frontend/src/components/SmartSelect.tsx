import { type KeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

export type SmartSelectOption = {
  value: string;
  label: string;
  searchText?: string;
};

const ROW_H = 36;
const LIST_MAX_H = 224; /* max-h-56 */
const DEFAULT_DEBOUNCE = 300;
const VIRTUALIZE_AT = 48;
const OVERSCAN = 6;

type SmartSelectProps = {
  /** Modo local: lista completa en cliente (filtrada por el buscador). */
  options?: SmartSelectOption[];
  /** Modo remoto: resultados por búsqueda (debounce + cancelación). */
  loadOptions?: (query: string, signal: AbortSignal) => Promise<SmartSelectOption[]>;
  debounceMs?: number;
  value: string;
  /** Al elegir una fila: valor y opción completa (p. ej. etiqueta para chips fuera del select). */
  onChange: (value: string, option?: SmartSelectOption) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyLabel?: string;
  noResultsLabel?: string;
  loadingLabel?: string;
  /** Si hay `value` y no está en opciones cargadas, mostrar esta etiqueta. */
  selectedLabel?: string;
  /** Virtualizar lista local cuando hay al menos N filas visibles. */
  virtualizeThreshold?: number;
};

export function SmartSelect({
  options = [],
  loadOptions,
  debounceMs = DEFAULT_DEBOUNCE,
  value,
  onChange,
  placeholder = 'Seleccionar',
  disabled = false,
  emptyLabel = 'Sin opciones',
  noResultsLabel = 'Sin resultados',
  loadingLabel = 'Buscando…',
  selectedLabel,
  virtualizeThreshold = VIRTUALIZE_AT
}: SmartSelectProps) {
  const remote = typeof loadOptions === 'function';
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [remoteRows, setRemoteRows] = useState<SmartSelectOption[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [picked, setPicked] = useState<{ value: string; label: string } | null>(null);

  const filteredLocal = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const hay = `${opt.label} ${opt.searchText ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  const items = remote ? remoteRows : filteredLocal;

  const selected = useMemo(() => {
    if (!value) return null;
    const o = options.find((x) => x.value === value);
    if (o) return o;
    const r = remoteRows.find((x) => x.value === value);
    if (r) return r;
    if (picked?.value === value) return picked;
    if (selectedLabel) return { value, label: selectedLabel };
    return null;
  }, [value, options, remoteRows, picked, selectedLabel]);

  useEffect(() => {
    if (!value) setPicked(null);
  }, [value]);

  useEffect(() => {
    function onDocMouseDown(ev: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !remote || !loadOptions) return;
    const ac = new AbortController();
    const q = query.trim();
    setRemoteLoading(true);
    const t = window.setTimeout(() => {
      loadOptions(q, ac.signal)
        .then((rows) => {
          if (!ac.signal.aborted) setRemoteRows(Array.isArray(rows) ? rows : []);
        })
        .catch((err: unknown) => {
          if (!ac.signal.aborted && err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name !== 'CanceledError' && (err as { name?: string }).name !== 'AbortError') {
            setRemoteRows([]);
          }
        })
        .finally(() => {
          if (!ac.signal.aborted) setRemoteLoading(false);
        });
    }, debounceMs);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [open, remote, query, debounceMs, loadOptions]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(-1);
  }, [open, items, query, remote]);

  const scrollActiveIntoView = useCallback((index: number) => {
    const el = listRef.current;
    if (!el || index < 0) return;
    const y = index * ROW_H;
    if (y < el.scrollTop) el.scrollTop = y;
    else if (y + ROW_H > el.scrollTop + el.clientHeight) {
      el.scrollTop = y + ROW_H - el.clientHeight;
    }
  }, []);

  useEffect(() => {
    if (open && activeIndex >= 0) scrollActiveIntoView(activeIndex);
  }, [open, activeIndex, scrollActiveIntoView]);

  const useVirtual = !remote && items.length >= virtualizeThreshold;
  const [scrollTop, setScrollTop] = useState(0);
  useEffect(() => {
    if (!open) setScrollTop(0);
  }, [open, items.length, useVirtual]);

  const virtualRange = useMemo(() => {
    if (!useVirtual) return { start: 0, end: items.length, padTop: 0, padBottom: 0 };
    const total = items.length * ROW_H;
    const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
    const visible = Math.ceil(LIST_MAX_H / ROW_H) + OVERSCAN * 2;
    const end = Math.min(items.length, start + visible);
    const padTop = start * ROW_H;
    const padBottom = total - end * ROW_H;
    return { start, end, padTop, padBottom };
  }, [useVirtual, items.length, scrollTop]);

  const commit = useCallback(
    (opt: SmartSelectOption) => {
      onChange(opt.value, opt);
      setPicked({ value: opt.value, label: opt.label });
      setOpen(false);
      setQuery('');
      setActiveIndex(-1);
    },
    [onChange]
  );

  function onKeyDown(ev: KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (ev.key === 'ArrowDown' || ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        setOpen(true);
        setQuery('');
      }
      return;
    }

    if (ev.key === 'Escape') {
      ev.preventDefault();
      setOpen(false);
      setQuery('');
      setActiveIndex(-1);
      return;
    }

    const len = items.length;
    if (len === 0) return;

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setActiveIndex((i) => (i < len - 1 ? i + 1 : 0));
      return;
    }
    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setActiveIndex((i) => (i <= 0 ? len - 1 : i - 1));
      return;
    }
    if (ev.key === 'Home') {
      ev.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (ev.key === 'End') {
      ev.preventDefault();
      setActiveIndex(len - 1);
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const idx = activeIndex >= 0 ? activeIndex : 0;
      const opt = items[idx];
      if (opt) commit(opt);
      return;
    }
    if (ev.key === 'Tab') {
      setOpen(false);
    }
  }

  const showEmptyLocal = !remote && options.length === 0;
  const showNoHitsLocal = !remote && options.length > 0 && filteredLocal.length === 0;
  const showEmptyRemote = remote && !remoteLoading && items.length === 0 && !query.trim();
  const showNoHitsRemote = remote && !remoteLoading && items.length === 0 && !!query.trim();

  function renderRow(opt: SmartSelectOption, index: number, key: string) {
    const highlighted = index === activeIndex;
    const sel = opt.value === value;
    return (
      <div key={key} role="presentation" className="p-0">
        <button
          type="button"
          role="option"
          id={`${listboxId}-opt-${index}`}
          aria-selected={sel}
          className={`flex min-h-[36px] w-full items-center rounded px-2 py-2 text-left text-sm ${
            highlighted ? 'bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-700 dark:ring-slate-600' : ''
          } ${
            sel
              ? 'bg-brand-50 text-brand-900 dark:bg-brand-950/50 dark:text-brand-100'
              : 'text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700'
          }`}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => commit(opt)}
        >
          <span className="truncate">{opt.label}</span>
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative min-w-0 w-full" onKeyDown={onKeyDown}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className="flex w-full min-w-0 items-center justify-between rounded border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
          setQuery('');
        }}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? placeholder}</span>
        <span className="ml-2 shrink-0 text-xs text-slate-500 dark:text-slate-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full rounded border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <div className="border-b border-slate-100 p-2 dark:border-slate-700">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Buscar…"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
            />
          </div>
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Opciones"
            className="max-h-56 overflow-y-auto p-1"
            onScroll={(e) => {
              if (useVirtual) setScrollTop((e.target as HTMLDivElement).scrollTop);
            }}
          >
            {remoteLoading && (
              <div className="px-2 py-2 text-sm text-slate-500 dark:text-slate-400" role="status">
                {loadingLabel}
              </div>
            )}
            {showEmptyLocal && (
              <div className="px-2 py-2 text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</div>
            )}
            {showNoHitsLocal && (
              <div className="px-2 py-2 text-sm text-slate-500 dark:text-slate-400">{noResultsLabel}</div>
            )}
            {showEmptyRemote && (
              <div className="px-2 py-2 text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</div>
            )}
            {showNoHitsRemote && (
              <div className="px-2 py-2 text-sm text-slate-500 dark:text-slate-400">{noResultsLabel}</div>
            )}
            {!useVirtual &&
              !(remote && remoteLoading) &&
              !showEmptyLocal &&
              !showNoHitsLocal &&
              !showEmptyRemote &&
              !showNoHitsRemote &&
              items.map((opt, index) => renderRow(opt, index, opt.value))}
            {useVirtual && !showEmptyLocal && !showNoHitsLocal && !(remote && remoteLoading) && (
              <div className="relative" style={{ minHeight: items.length * ROW_H }}>
                <div
                  className="absolute left-0 right-0 top-0"
                  style={{ transform: `translateY(${virtualRange.padTop}px)` }}
                >
                  {items.slice(virtualRange.start, virtualRange.end).map((opt, j) => {
                    const index = virtualRange.start + j;
                    return renderRow(opt, index, `${opt.value}-${index}`);
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

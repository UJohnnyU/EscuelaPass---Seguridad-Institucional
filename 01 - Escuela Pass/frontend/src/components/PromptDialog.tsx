import { type FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type PromptDialogProps = {
  open: boolean;
  title: string;
  subtitle?: string | null;
  /** Texto de contexto bajo el título */
  description?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  /** Botón principal en tono de alerta (p. ej. cancelar evento) */
  danger?: boolean;
  maxLength?: number;
  rows?: number;
  overlayZClass?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export function PromptDialog({
  open,
  title,
  subtitle,
  description,
  label,
  placeholder = '',
  initialValue = '',
  confirmLabel,
  cancelLabel = 'Cancelar',
  busy = false,
  danger = false,
  maxLength = 2000,
  rows = 4,
  overlayZClass = 'z-[120]',
  onConfirm,
  onCancel
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    onConfirm(value);
  };

  const confirmClasses = danger
    ? 'rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50'
    : 'rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50';

  const modal = (
    <div
      className={`modal-overlay-enter fixed inset-0 ${overlayZClass} flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4`}
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-dialog-title"
        className="modal-card-enter w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 id="prompt-dialog-title" className="font-serif text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p> : null}
            {description ? (
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
            ) : null}
          </div>
          <div className="space-y-3 px-6 py-5">
            {label ? (
              <label className="block text-sm font-medium text-slate-800">
                {label}
                <textarea
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={placeholder}
                  maxLength={maxLength}
                  rows={rows}
                  disabled={busy}
                  className="mt-2 min-h-[96px] w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none ring-brand-500/15 focus:border-brand-500 focus:ring-4 disabled:opacity-60"
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Opcional — máximo {maxLength} caracteres
                </span>
              </label>
            ) : (
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                maxLength={maxLength}
                rows={rows}
                disabled={busy}
                className="min-h-[96px] w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none ring-brand-500/15 focus:border-brand-500 focus:ring-4 disabled:opacity-60"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button type="submit" disabled={busy} className={confirmClasses}>
              {busy ? 'Procesando…' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}

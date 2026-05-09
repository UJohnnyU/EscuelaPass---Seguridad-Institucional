import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export type AlertDialogProps = {
  open: boolean;
  title: string;
  description: string;
  okLabel?: string;
  busy?: boolean;
  overlayZClass?: string;
  /** Tono visual del mensaje (solo refuerzo sutil; el botón sigue siendo de acción principal). */
  variant?: 'neutral' | 'warning' | 'error';
  onDismiss: () => void;
};

export function AlertDialog({
  open,
  title,
  description,
  okLabel = 'Entendido',
  busy = false,
  overlayZClass = 'z-[100]',
  variant = 'neutral',
  onDismiss
}: AlertDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onDismiss();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busy, onDismiss]);

  if (!open) return null;

  const band =
    variant === 'error'
      ? 'border-l-4 border-l-rose-500'
      : variant === 'warning'
        ? 'border-l-4 border-l-amber-500'
        : 'border-l-4 border-l-brand-500';

  const modal = (
    <div
      className={`fixed inset-0 ${overlayZClass} flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm`}
      role="presentation"
      onClick={() => {
        if (!busy) onDismiss();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-desc"
        className={`w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl ring-1 ring-black/5 ${band}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="alert-dialog-title" className="font-serif text-lg font-semibold text-slate-900">
          {title}
        </h3>
        <p id="alert-dialog-desc" className="mt-3 text-sm leading-relaxed text-slate-600">
          {description}
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? '…' : okLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}

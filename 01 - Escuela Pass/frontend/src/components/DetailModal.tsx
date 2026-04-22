import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

export function DetailModal({
  open,
  title,
  subtitle,
  badge,
  onClose,
  children,
  footer
}: {
  open: boolean;
  title: string;
  subtitle?: string | null;
  badge?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const modal = (
    <div className="modal-overlay-enter fixed inset-0 z-[90] overflow-y-auto bg-slate-950/60 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div
          className="modal-card-enter relative my-auto w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-serif text-lg font-semibold text-slate-900">{title}</h2>
                {badge}
              </div>
              {subtitle ? <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Cerrar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="max-h-[72vh] overflow-y-auto px-6 py-5 text-sm leading-relaxed text-slate-700 sm:max-h-[70vh]">
            {children}
          </div>
          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-3">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}

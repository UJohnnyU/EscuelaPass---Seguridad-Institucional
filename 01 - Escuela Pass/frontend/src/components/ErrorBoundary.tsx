/* eslint-disable react-refresh/only-export-components */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function isAuthError(error: Error): boolean {
  const msg = error.message?.toLowerCase() ?? '';
  return (
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('unauthorized') ||
    msg.includes('autenticaci') ||
    msg.includes('sesi')
  );
}

function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center p-6" role="alert" aria-live="assertive">
      <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-sm dark:border-red-800/50 dark:bg-red-950/45 dark:shadow-slate-950/30">
        <p className="font-serif text-lg font-semibold text-red-900 dark:text-red-100">Algo salió mal</p>
        <p className="mt-1 text-sm text-red-700 dark:text-red-200/90">
          Ocurrió un error inesperado. Puede intentar recargar esta sección.
        </p>
        {import.meta.env.DEV && (
          <pre className="mt-3 overflow-auto rounded bg-red-100 px-3 py-2 text-left font-mono text-xs text-red-800 dark:bg-red-950/60 dark:text-red-100">
            {error.message}
          </pre>
        )}
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:border-red-600/50 dark:bg-slate-900 dark:text-red-100 dark:hover:bg-slate-800"
          >
            Reintentar
          </button>
          {isAuthError(error) && (
            <a
              href="/login"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cerrar sesión
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
    this.props.onError?.(error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.reset);
      }
      return <DefaultFallback error={error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

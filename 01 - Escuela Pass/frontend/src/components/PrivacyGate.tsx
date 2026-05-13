import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { useAuth } from '@/context/useAuth';

type Policy = {
  id: string;
  version: string;
  title: string;
  content: string;
  effectiveAt: string | null;
  createdAt: string;
};

type Acceptance = {
  userId: string;
  policyVersion: string;
  acceptedAt: string;
  ipAddress: string | null;
};

type GateState =
  | { kind: 'loading' }
  | { kind: 'ok' }
  | { kind: 'no-policy' }
  | { kind: 'must-accept'; policy: Policy }
  | { kind: 'error'; message: string };

/**
 * Bloquea el uso de la aplicación hasta que el usuario acepta la versión vigente
 * del aviso de privacidad. Cumple con LFPDPPP (Mexico) art. 16-18 (información y
 * consentimiento previo).
 */
export function PrivacyGate({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [state, setState] = useState<GateState>({ kind: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setState({ kind: 'loading' });
    try {
      const [policyResp, acceptancesResp] = await Promise.all([
        api.get<Policy>('/api/v1/privacy/policy/latest').catch((err) => {
          if (err?.response?.status === 404) return { data: null } as { data: null };
          throw err;
        }),
        api.get<Acceptance[]>('/api/v1/privacy/me/acceptances')
      ]);
      const policy = policyResp.data;
      const acceptances = acceptancesResp.data ?? [];
      if (!policy) {
        setState({ kind: 'no-policy' });
        return;
      }
      const accepted = acceptances.some((a) => a.policyVersion === policy.version);
      if (accepted) {
        setState({ kind: 'ok' });
      } else {
        setState({ kind: 'must-accept', policy });
      }
    } catch (err) {
      setState({
        kind: 'error',
        message: getUserFacingMessage(err, 'No fue posible cargar el aviso de privacidad.')
      });
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void refresh();
    }
  }, [user, refresh]);

  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const reachedEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 16;
    if (reachedEnd) setScrolledToEnd(true);
  }, []);

  const accept = useCallback(async () => {
    if (state.kind !== 'must-accept') return;
    setSubmitting(true);
    try {
      await api.post('/api/v1/privacy/accept', { version: state.policy.version });
      setState({ kind: 'ok' });
    } catch (err) {
      setState({
        kind: 'error',
        message: getUserFacingMessage(err, 'No fue posible registrar la aceptación.')
      });
    } finally {
      setSubmitting(false);
    }
  }, [state]);

  const policyTitle = useMemo(() => {
    if (state.kind === 'must-accept') return state.policy.title || 'Aviso de privacidad';
    return 'Aviso de privacidad';
  }, [state]);

  if (state.kind === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true">
        <p className="animate-pulse text-slate-600 dark:text-slate-400">Cargando…</p>
      </div>
    );
  }

  if (state.kind === 'no-policy' || state.kind === 'ok') {
    return <>{children}</>;
  }

  if (state.kind === 'error') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="max-w-md text-slate-700 dark:text-slate-300">{state.message}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            Reintentar
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 px-2 py-4 dark:bg-slate-950/75 sm:items-center sm:p-6">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Versión {state.policy.version}
          </p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{policyTitle}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Para continuar usando Escuela Pass debe leer y aceptar el aviso de privacidad vigente.
          </p>
        </div>
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="prose prose-sm max-w-none flex-1 overflow-y-auto bg-white px-6 py-4 text-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800 dark:text-slate-200">
            {state.policy.content}
          </pre>
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {scrolledToEnd
              ? 'Ha leído el aviso. Puede aceptar para continuar.'
              : 'Desplácese hasta el final del aviso para habilitar el botón Aceptar.'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cerrar sesión
            </button>
            <button
              type="button"
              disabled={!scrolledToEnd || submitting}
              onClick={() => void accept()}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-brand-600 dark:hover:bg-brand-500 dark:disabled:bg-slate-600"
            >
              {submitting ? 'Registrando…' : 'Acepto el aviso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

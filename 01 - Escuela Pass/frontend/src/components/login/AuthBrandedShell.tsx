import type { ReactNode } from 'react';
import { BubbleField } from '@/components/login/BubbleField';

/** Fondo y capas visuales alineadas con `LoginPage` (gradiente, burbujas, grano). */
export function AuthBrandedShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-[#0f1f52] font-sans">
      <div className="absolute inset-0 z-0 opacity-[0.45]">
        <BubbleField />
      </div>
      <div className="login-grain-overlay z-[1]" />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-brand-950/80 via-transparent to-brand-900/30" />

      <div
        className="pointer-events-none absolute -left-32 top-[15%] z-[3] h-72 w-72 rounded-full bg-sky-400/15 blur-3xl motion-safe:animate-auth-ambient motion-reduce:animate-none"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-[10%] z-[3] h-64 w-64 rounded-full bg-brand-500/20 blur-3xl motion-safe:animate-auth-ambient motion-reduce:animate-none [animation-delay:-7s]"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-screen flex-col justify-center px-5 py-12 sm:px-10 lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

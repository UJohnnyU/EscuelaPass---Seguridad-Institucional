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

import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { AuthBrandedShell } from '@/components/login/AuthBrandedShell';
import { MailIcon } from '@/components/login/AuthFormIcons';
import logoUrl from '@/assets/landing/logo.png';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const { data } = await api.post<{ message: string }>('/api/v1/auth/forgot-password', {
        email: email.trim().toLowerCase()
      });
      setMsg(data.message);
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo procesar la solicitud. Intente de nuevo.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthBrandedShell>
      <Link
        to="/"
        className="inline-flex origin-left items-center gap-2.5 text-white/90 transition-all duration-200 hover:text-white motion-safe:animate-auth-in motion-reduce:animate-none hover:scale-[1.02] active:scale-[0.98]"
      >
        <img src={logoUrl} alt="" className="h-9 w-auto object-contain sm:h-10" aria-hidden />
        <span className="text-lg font-semibold tracking-tight">Escuela Pass</span>
      </Link>

      <div className="motion-safe:animate-auth-in-delay-sm motion-reduce:animate-none">
        <h1 className="mt-10 text-3xl font-bold tracking-tight text-white sm:text-4xl">Recuperar contraseña</h1>
        <p className="mt-2 text-sm leading-relaxed text-brand-100/80">
          Ingrese el correo institucional y le enviaremos un enlace para restablecer su contraseña.
        </p>
      </div>

      {msg ? (
        <div
          className="mt-8 rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-4 text-sm leading-relaxed text-emerald-50 ring-1 ring-emerald-400/25 motion-safe:animate-fade-in motion-reduce:animate-none"
          role="status"
        >
          {msg}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-10 space-y-5 motion-safe:animate-auth-in-delay-md motion-reduce:animate-none">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-100/70"
            >
              Correo electrónico
            </label>
            <div className="relative">
              <div className="flex min-h-[3rem] w-full overflow-hidden rounded-2xl border border-white/15 bg-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition focus-within:border-brand-300/45 focus-within:ring-2 focus-within:ring-brand-400/25">
                <div
                  className="flex w-11 shrink-0 items-center justify-center border-r border-white/10 bg-brand-950/35 text-white"
                  aria-hidden
                >
                  <MailIcon />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@colegio.edu"
                  className="min-w-0 flex-1 border-0 bg-transparent py-3 pl-3 pr-4 text-sm text-white placeholder:text-brand-200/45 outline-none ring-0 focus:ring-0"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-100 ring-1 ring-red-400/30" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full rounded-2xl bg-brand-950 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-950/40 ring-1 ring-white/10 transition hover:bg-brand-900 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
          >
            {loading ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>
      )}

      <div className="motion-safe:animate-auth-in-delay-md motion-reduce:animate-none">
        <p className="mt-10 text-center text-sm">
          <Link
            to="/login"
            className="font-medium text-brand-200 underline-offset-4 transition hover:text-white hover:underline"
          >
            Volver al inicio de sesión
          </Link>
        </p>
        <p className="mt-4 text-center text-sm text-brand-200/70">
          <Link to="/" className="transition hover:text-brand-100 hover:underline">
            Ir al sitio público
          </Link>
        </p>
      </div>
    </AuthBrandedShell>
  );
}

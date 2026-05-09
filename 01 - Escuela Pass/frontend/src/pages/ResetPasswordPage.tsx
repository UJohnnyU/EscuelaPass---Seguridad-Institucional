import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { AuthBrandedShell } from '@/components/login/AuthBrandedShell';
import { LockIcon } from '@/components/login/AuthFormIcons';
import logoUrl from '@/assets/landing/logo.png';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<{ message: string }>('/api/v1/auth/reset-password', {
        token,
        newPassword
      });
      setMsg(data.message);
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo restablecer la contraseña.'));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
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
          <h1 className="mt-10 text-3xl font-bold tracking-tight text-white sm:text-4xl">Enlace no válido</h1>
          <p className="mt-2 text-sm text-brand-100/80">El enlace de restablecimiento está incompleto o expiró.</p>
        </div>

        <div className="mt-8 rounded-2xl border border-red-400/35 bg-red-500/10 px-5 py-6 text-center ring-1 ring-red-400/25 motion-safe:animate-auth-in-delay-md motion-reduce:animate-none">
          <p className="text-sm text-red-100">Solicite un nuevo correo desde la pantalla de recuperación.</p>
          <Link
            to="/recuperar-contrasena"
            className="mt-4 inline-block text-sm font-medium text-brand-200 underline-offset-4 transition hover:text-white hover:underline"
          >
            Solicitar nuevo enlace
          </Link>
        </div>

        <p className="mt-10 text-center text-sm motion-safe:animate-auth-in-delay-md motion-reduce:animate-none">
          <Link
            to="/login"
            className="font-medium text-brand-200 underline-offset-4 transition hover:text-white hover:underline"
          >
            Volver al inicio de sesión
          </Link>
        </p>
      </AuthBrandedShell>
    );
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
        <h1 className="mt-10 text-3xl font-bold tracking-tight text-white sm:text-4xl">Nueva contraseña</h1>
        <p className="mt-2 text-sm leading-relaxed text-brand-100/80">
          Elija una contraseña segura; deberá usarla en el próximo inicio de sesión.
        </p>
      </div>

      {msg ? (
        <div
          className="mt-8 rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-50 ring-1 ring-emerald-400/25 motion-safe:animate-fade-in motion-reduce:animate-none"
          role="status"
        >
          {msg}
          <p className="mt-2 text-xs text-emerald-100/90">Redirigiendo al inicio de sesión…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-10 space-y-5 motion-safe:animate-auth-in-delay-md motion-reduce:animate-none">
          <div>
            <label
              htmlFor="new-pass"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-100/70"
            >
              Nueva contraseña
            </label>
            <div className="flex min-h-[3rem] w-full overflow-hidden rounded-2xl border border-white/15 bg-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition focus-within:border-brand-300/45 focus-within:ring-2 focus-within:ring-brand-400/25">
              <div
                className="flex w-11 shrink-0 items-center justify-center border-r border-white/10 bg-brand-950/35 text-white"
                aria-hidden
              >
                <LockIcon />
              </div>
              <input
                id="new-pass"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="min-w-0 flex-1 border-0 bg-transparent py-3 pl-3 pr-4 text-sm text-white placeholder:text-brand-200/45 outline-none ring-0 focus:ring-0"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="confirm-pass"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-100/70"
            >
              Confirmar contraseña
            </label>
            <div className="flex min-h-[3rem] w-full overflow-hidden rounded-2xl border border-white/15 bg-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition focus-within:border-brand-300/45 focus-within:ring-2 focus-within:ring-brand-400/25">
              <div
                className="flex w-11 shrink-0 items-center justify-center border-r border-white/10 bg-brand-950/35 text-white"
                aria-hidden
              >
                <LockIcon />
              </div>
              <input
                id="confirm-pass"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repita la contraseña"
                className="min-w-0 flex-1 border-0 bg-transparent py-3 pl-3 pr-4 text-sm text-white placeholder:text-brand-200/45 outline-none ring-0 focus:ring-0"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-100 ring-1 ring-red-400/30" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !newPassword || !confirm}
            className="w-full rounded-2xl bg-brand-950 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-950/40 ring-1 ring-white/10 transition hover:bg-brand-900 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
          >
            {loading ? 'Guardando…' : 'Restablecer contraseña'}
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

import { type FormEvent, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { BubbleField } from '@/components/login/BubbleField';
import { API_BASE_URL } from '@/lib/api';
import logoUrl from '@/assets/landing/logo.png';

const REMEMBER_KEY = 'ep_login_remember_email';

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function LoginPage() {
  const { user, login, ready } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  if (ready && user) {
    return <Navigate to="/app" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      try {
        if (remember) {
          localStorage.setItem(REMEMBER_KEY, email.trim());
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-[#0f1f52] font-sans">
      <div className="absolute inset-0 z-0 opacity-[0.45]">
        <BubbleField />
      </div>
      <div className="login-grain-overlay z-[1]" />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-brand-950/80 via-transparent to-brand-900/30" />

      <div className="relative z-10 flex min-h-screen flex-col lg:grid lg:grid-cols-2">
        {/* Columna formulario */}
        <div className="flex flex-1 flex-col justify-center px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
          <div className="mx-auto w-full max-w-md">
            <Link to="/" className="inline-flex items-center gap-2 text-white/90 transition hover:text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-sm font-bold text-white ring-1 ring-white/20">
                EP
              </span>
              <span className="text-lg font-semibold tracking-tight">Escuela Pass</span>
            </Link>

            <h1 className="mt-10 text-3xl font-bold tracking-tight text-white sm:text-4xl">Iniciar sesión</h1>
            <p className="mt-2 text-sm text-brand-100/80">Acceda con el correo institucional asignado por su colegio.</p>

            {import.meta.env.PROD && !API_BASE_URL && (
              <div
                className="mt-6 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-50"
                role="status"
              >
                <strong className="block font-semibold">El servicio no está disponible en este momento</strong>
                <p className="mt-1 text-amber-100/90">
                  Inténtelo nuevamente más tarde. Si el problema continúa, comuníquese con el área de sistemas de su
                  plantel.
                </p>
              </div>
            )}

            <form className="mt-10 space-y-5" onSubmit={onSubmit}>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-100/70">
                  Correo electrónico
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-200/70">
                    <MailIcon />
                  </span>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="nombre@colegio.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border border-white/15 bg-white/10 py-3 pl-11 pr-4 text-sm text-white placeholder:text-brand-200/40 outline-none ring-brand-400/30 backdrop-blur-sm transition focus:border-brand-300/40 focus:ring-2"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-100/70">
                  Contraseña
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-200/70">
                    <LockIcon />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-white/15 bg-white/10 py-3 pl-11 pr-12 text-sm text-white placeholder:text-brand-200/40 outline-none ring-brand-400/30 backdrop-blur-sm transition focus:border-brand-300/40 focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-brand-200/70 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-brand-100/85">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-white/30 bg-white/10 text-brand-600 focus:ring-brand-500"
                  />
                  Recordar correo en este equipo
                </label>
                <Link
                  to="/recuperar-contrasena"
                  className="shrink-0 text-xs font-medium text-brand-200 underline-offset-2 hover:underline"
                >
                  ¿Olvidó su contraseña?
                </Link>
              </div>

              {error && (
                <div className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-100 ring-1 ring-red-400/30" role="alert">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-brand-950 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-950/40 ring-1 ring-white/10 transition hover:bg-brand-900 disabled:opacity-60"
              >
                {loading ? 'Entrando…' : 'Entrar'}
              </button>
            </form>

            <p className="mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm text-brand-200/70">
              <span>¿No puede acceder?</span>
              <span className="text-brand-100">Solicite o restablezca su acceso con secretaría o sistemas del plantel.</span>
            </p>
            <p className="mt-6 text-center text-sm">
              <Link to="/" className="font-medium text-brand-200 underline-offset-4 transition hover:text-white hover:underline">
                Volver al sitio público
              </Link>
            </p>
          </div>
        </div>

        {/* Columna marca / bienvenida (desktop) */}
        <div className="relative hidden min-h-0 flex-col justify-between overflow-hidden rounded-t-[2.5rem] border-t border-white/10 bg-slate-950/55 p-10 backdrop-blur-md lg:flex lg:min-h-screen lg:rounded-none lg:rounded-l-[2.5rem] lg:border-l lg:border-t-0 lg:p-12 xl:p-14">
          <div className="pointer-events-none absolute -right-16 top-8 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
            <img
              src={logoUrl}
              alt=""
              aria-hidden
              className="w-[70%] max-w-[min(70%,28rem)] object-contain opacity-[0.1] sm:opacity-[0.12]"
            />
          </div>

          <div className="relative z-[1] max-w-md">
            <h2 className="text-3xl font-bold leading-tight text-white xl:text-4xl">Bienvenido a Escuela Pass</h2>
            <p className="mt-5 text-base leading-relaxed text-brand-100/75">
              Software para la operación diaria del plantel: accesos, recogida de alumnos y comunicación con familias y
              personal, con un mismo criterio de seguridad y privacidad.
            </p>
            <p className="mt-6 text-sm leading-relaxed text-brand-200/65">
              Pensado para instituciones que necesitan orden en horarios críticos y trazabilidad sin sustituir el criterio
              del colegio.
            </p>
          </div>

          <div className="relative z-[1] mt-12 rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20">
            <p className="text-sm font-medium text-white">Un mismo entorno para familias y equipo</p>
            <p className="mt-2 text-xs leading-relaxed text-brand-200/60">
              Cada perfil dispone de las pantallas que corresponden a su función en la institución.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <div className="flex -space-x-2">
                {['FA', 'DC', 'AD', 'SG'].map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-900 bg-gradient-to-br from-brand-500 to-brand-700 text-[10px] font-bold text-white"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <span className="text-xs font-medium text-brand-200/70">Roles típicos</span>
            </div>
          </div>
        </div>

        {/* Resumen móvil bajo el formulario */}
        <div className="col-span-2 border-t border-white/10 bg-slate-950/40 px-5 py-8 backdrop-blur-sm lg:hidden">
          <p className="text-center text-sm font-medium text-white">Escuela Pass</p>
          <p className="mx-auto mt-2 max-w-sm text-center text-xs leading-relaxed text-brand-200/65">
            Plataforma institucional para accesos, recogida y comunicación operativa.
          </p>
        </div>
      </div>
    </div>
  );
}

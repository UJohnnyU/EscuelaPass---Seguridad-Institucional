import { type FormEvent, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { BubbleField } from '@/components/login/BubbleField';
import { API_BASE_URL } from '@/lib/api';
import logoUrl from '@/assets/landing/logo.png';

const REMEMBER_KEY = 'ep_login_remember_email';

const ROLE_BADGES: Array<{ label: string; className: string }> = [
  {
    label: 'Alumno',
    className:
      'border-white/[0.12] bg-gradient-to-b from-slate-700/35 to-slate-900/55 text-brand-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] hover:border-white/20 hover:from-slate-600/30'
  },
  {
    label: 'Padre',
    className:
      'border-brand-400/18 bg-gradient-to-b from-brand-900/45 to-brand-950/70 text-brand-50 shadow-[inset_0_1px_0_0_rgba(96,165,250,0.14)] hover:border-brand-300/28'
  },
  {
    label: 'Docente',
    className:
      'border-brand-500/22 bg-gradient-to-b from-brand-800/50 to-brand-950/75 text-white shadow-[inset_0_1px_0_0_rgba(96,165,250,0.14)] hover:border-brand-400/35'
  },
  {
    label: 'Administrativo',
    className:
      'border-brand-600/28 bg-gradient-to-b from-brand-900/70 to-brand-950 text-white shadow-[inset_0_1px_0_0_rgba(59,130,246,0.18)] hover:border-brand-500/40'
  }
];

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
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
            <Link to="/" className="inline-flex items-center gap-2.5 text-white/90 transition hover:text-white">
              <img src={logoUrl} alt="" className="h-9 w-auto object-contain sm:h-10" aria-hidden />
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
                      autoComplete="email"
                      required
                      placeholder="nombre@colegio.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="min-w-0 flex-1 border-0 bg-transparent py-3 pl-3 pr-4 text-sm text-white placeholder:text-brand-200/45 outline-none ring-0 focus:ring-0"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-100/70">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="flex min-h-[3rem] w-full overflow-hidden rounded-2xl border border-white/15 bg-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition focus-within:border-brand-300/45 focus-within:ring-2 focus-within:ring-brand-400/25">
                    <div
                      className="flex w-11 shrink-0 items-center justify-center border-r border-white/10 bg-brand-950/35 text-white"
                      aria-hidden
                    >
                      <LockIcon />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="min-w-0 flex-1 border-0 bg-transparent py-3 pl-3 pr-2 text-sm text-white placeholder:text-brand-200/45 outline-none ring-0 focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="flex shrink-0 items-center justify-center px-3 text-brand-100/90 transition hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-400"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
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
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden login-welcome-logo-perspective">
            <img
              src={logoUrl}
              alt=""
              aria-hidden
              className="login-welcome-logo-spin w-[70%] max-w-[min(70%,28rem)] object-contain opacity-[0.1] sm:opacity-[0.12]"
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
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-300/45">
              Perfiles en la institución
            </p>
            <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
              {ROLE_BADGES.map((role) => (
                <div
                  key={role.label}
                  className={`rounded-md border px-2.5 py-2 text-center text-[11px] font-medium leading-tight antialiased transition duration-200 sm:px-3 sm:py-2 sm:text-xs ${role.className}`}
                >
                  {role.label}
                </div>
              ))}
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

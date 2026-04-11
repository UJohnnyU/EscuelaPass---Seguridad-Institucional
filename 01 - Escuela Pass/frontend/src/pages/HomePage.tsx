import { Link } from 'react-router-dom';

const NAV_LINKS = [
  { href: '#beneficios', label: 'Beneficios' },
  { href: '#plataforma', label: 'La plataforma' },
  { href: '#faq', label: 'Preguntas frecuentes' },
  { href: '#datos-personales', label: 'Privacidad' }
];

const BENEFITS = [
  {
    title: 'Accesos al plantel',
    text: 'Credenciales y registro de entradas y salidas con el flujo que defina la institución, para reducir incertidumbre en portería y horarios críticos.',
    gradient: 'from-brand-800 to-slate-950'
  },
  {
    title: 'Salidas y recogida',
    text: 'Circuito de recogida con coordinación entre familia y aula: estados visibles y cierre acorde a la norma interna del colegio.',
    gradient: 'from-brand-700 to-slate-950'
  },
  {
    title: 'Información por perfil',
    text: 'Cada usuario trabaja con pantallas acordes a su rol: familia, docencia o administración, sin saturar con datos que no corresponden.',
    gradient: 'from-slate-800 to-slate-950'
  },
  {
    title: 'Comunicación operativa',
    text: 'Módulos para avisos y gestión cotidiana en un mismo entorno, alineado a la operación real del plantel.',
    gradient: 'from-brand-900 to-slate-950'
  }
];

const PLATFORM_PILLARS = [
  {
    title: 'Operación diaria',
    body: 'Escuela Pass está pensado para el uso recurrente: ingreso al panel, consultas y acciones habituales con mensajes claros y respuesta ante errores comprensible para el usuario final.'
  },
  {
    title: 'Criterio institucional',
    body: 'Las políticas de privacidad, la normativa interna y las decisiones pedagógicas siguen siendo del colegio; la herramienta las respeta en la medida en que se configuren en el sistema.'
  },
  {
    title: 'Escalable por rol',
    body: 'Desde la familia que confirma una recogida hasta el personal que supervisa listados o informes autorizados, el alcance de cada cuenta se ajusta a lo que la institución habilite.'
  }
];

function PhoneMock({ label }: { label: string }) {
  return (
    <div
      className="relative h-[220px] w-[110px] shrink-0 rounded-[1.75rem] border border-white/25 bg-gradient-to-b from-white/15 to-slate-900/80 p-2 shadow-2xl shadow-brand-950/50 sm:h-[260px] sm:w-[128px]"
      aria-hidden
    >
      <div className="mx-auto h-1 w-8 rounded-full bg-white/30" />
      <div className="mt-3 space-y-2 rounded-lg bg-slate-950/60 p-2">
        <div className="h-2 w-3/4 rounded bg-white/20" />
        <div className="h-2 w-1/2 rounded bg-white/15" />
        <div className="mt-2 grid grid-cols-3 gap-1">
          <div className="aspect-square rounded bg-white/10" />
          <div className="aspect-square rounded bg-white/10" />
          <div className="aspect-square rounded bg-white/10" />
        </div>
        <div className="mt-2 flex items-center justify-center rounded border border-dashed border-brand-400/30 py-6">
          <span className="text-[10px] font-medium uppercase tracking-wider text-brand-200/80">QR</span>
        </div>
      </div>
      <p className="absolute -bottom-8 left-0 right-0 text-center text-[10px] text-white/40">{label}</p>
    </div>
  );
}

function SocialLinks() {
  const cls = 'text-brand-200/80 transition hover:text-white';
  return (
    <div className="flex items-center gap-4 pt-8">
      <a href="#" className={cls} aria-label="Facebook">
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      </a>
      <a href="#" className={cls} aria-label="Instagram">
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      </a>
      <a href="#" className={cls} aria-label="YouTube">
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      </a>
    </div>
  );
}

export function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans text-white">
      <header className="sticky top-0 z-50 border-b border-brand-900/60 bg-brand-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 lg:px-6">
          <Link to="/" className="text-lg font-bold tracking-tight text-white">
            Escuela Pass
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium text-brand-100/90 md:flex lg:gap-4">
            {NAV_LINKS.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="-my-1 rounded-lg px-3 py-2.5 transition hover:bg-white/5 hover:text-white"
              >
                {n.label}
              </a>
            ))}
            <Link
              to="/login"
              className="rounded-full border border-brand-400/50 bg-brand-800/50 px-4 py-2 text-white transition hover:bg-brand-700/60"
            >
              Acceso a clientes
            </Link>
          </nav>
          <Link
            to="/login"
            className="rounded-full border border-brand-400/50 px-3 py-1.5 text-sm font-semibold text-white md:hidden"
          >
            Entrar
          </Link>
        </div>
        <div className="flex gap-4 overflow-x-auto border-t border-brand-900/50 px-4 py-2 text-xs font-medium text-brand-100/85 md:hidden">
          {NAV_LINKS.map((n) => (
            <a key={n.href} href={n.href} className="shrink-0 whitespace-nowrap">
              {n.label}
            </a>
          ))}
        </div>
      </header>

      <section className="relative overflow-x-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-slate-950">
        <div className="pointer-events-none absolute -right-20 top-1/4 h-96 w-96 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-64 w-64 rounded-full bg-brand-400/10 blur-3xl" />
        <div className="mx-auto grid min-w-0 max-w-6xl gap-12 px-4 py-16 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-6 lg:py-24">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-200/70">Software para instituciones educativas</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.25rem]">
              Escuela Pass
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-brand-50/90">
              Plataforma para ordenar accesos, circuito de recogida y comunicación operativa del plantel, con cuentas por
              rol y criterios de privacidad alineados a la institución.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href="mailto:contacto@institucion.edu"
                className="inline-flex items-center justify-center rounded-full border-2 border-white/90 bg-transparent px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Contacto comercial
              </a>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-brand-900 shadow-lg shadow-brand-950/40 transition hover:bg-brand-50"
              >
                Acceder al panel
              </Link>
            </div>
            <SocialLinks />
          </div>
          <div className="flex min-w-0 justify-center px-1 pb-10 sm:gap-5 lg:justify-center lg:pb-12">
            <div className="flex max-w-full justify-center gap-2 sm:gap-4 md:gap-5">
              <PhoneMock label="Perfil" />
              <PhoneMock label="Grupos" />
              <PhoneMock label="Credencial" />
            </div>
          </div>
        </div>
      </section>

      <section id="beneficios" className="scroll-mt-20 border-t border-brand-950 bg-slate-950 py-20">
        <div className="mx-auto max-w-6xl px-4 text-center lg:px-6">
          <h2 className="mx-auto max-w-3xl text-2xl font-bold leading-snug text-white sm:text-3xl">
            Beneficios pensados para la operación real del colegio
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-brand-100/75">
            Funciones orientadas a portería, aulas y familias: menos fricción en horarios de entrada y salida, más claridad
            en quién hace qué en cada momento.
          </p>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <article
                key={b.title}
                className="group flex flex-col overflow-hidden rounded-2xl border border-brand-900/60 bg-brand-950/40 text-left shadow-lg transition hover:border-brand-700/50"
              >
                <div className={`relative h-36 bg-gradient-to-br ${b.gradient}`}>
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40" />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-brand-100">{b.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-brand-100/70">{b.text}</p>
                </div>
              </article>
            ))}
          </div>
          <a
            href="#plataforma"
            className="mt-12 inline-block text-sm font-semibold text-brand-400 underline-offset-4 hover:text-brand-300 hover:underline"
          >
            Cómo encaja en la institución
          </a>
        </div>
      </section>

      <section id="plataforma" className="scroll-mt-20 border-t border-brand-950 bg-slate-900 py-20">
        <div className="mx-auto max-w-6xl px-4 lg:px-6">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">Un producto, varios perfiles</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-brand-100/75">
            Escuela Pass ofrece un conjunto de módulos y pantallas que la institución puede adoptar según su modelo de
            trabajo; no es un experimento aislado, sino una solución pensada para convivir con las políticas y procesos
            del colegio.
          </p>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {PLATFORM_PILLARS.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-brand-800/50 bg-brand-950/50 p-8 shadow-md shadow-brand-950/30"
              >
                <h3 className="text-lg font-semibold text-white">{p.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-brand-100/75">{p.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="mailto:contacto@institucion.edu?subject=Informaci%C3%B3n%20Escuela%20Pass"
              className="inline-flex rounded-full bg-brand-600 px-10 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-900/40 transition hover:bg-brand-500"
            >
              Solicitar una demostración
            </a>
            <Link to="/login" className="text-sm font-semibold text-brand-300 underline-offset-4 hover:text-white hover:underline">
              Ya tengo acceso
            </Link>
          </div>
        </div>
      </section>

      <section id="alcance" className="scroll-mt-20 border-t border-brand-950 bg-slate-950 py-16">
        <div className="mx-auto max-w-5xl px-4 lg:px-6">
          <h2 className="text-center font-serif text-2xl font-semibold text-white">Qué cubre la solución</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-brand-100/70">
            Resumen de capacidades habituales; el detalle de licencias y alcance lo acuerda la institución con su proveedor.
          </p>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              {
                title: 'Circuito de recogida',
                text: 'Solicitudes y estados de recogida con la lógica que configure el colegio, incluyendo confirmaciones cuando el flujo lo requiera.'
              },
              {
                title: 'Cumplimiento y consultas',
                text: 'Registros e informes para perfiles autorizados, respetando quién puede ver qué dentro de la organización.'
              },
              {
                title: 'Interfaz para el día a día',
                text: 'Formulación de mensajes y vistas orientadas a usuarios finales, no a tablas técnicas de explotación.'
              }
            ].map((c) => (
              <div key={c.title} className="rounded-xl border border-brand-900/60 bg-brand-950/30 p-6">
                <h3 className="font-semibold text-white">{c.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-brand-100/70">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-20 border-t border-brand-950 bg-slate-900 py-16">
        <div className="mx-auto max-w-2xl px-4 lg:px-6">
          <h2 className="text-center text-xl font-bold text-white">Preguntas frecuentes</h2>
          <dl className="mt-10 space-y-4">
            {[
              {
                q: '¿Quién puede utilizar Escuela Pass?',
                a: 'La institución crea y distribuye cuentas según el rol: familia, personal docente, administración u otros perfiles que defina. El acceso a datos concretos depende de ese rol.'
              },
              {
                q: '¿Sustituye las normas o contratos del colegio?',
                a: 'No. Las políticas internas, el reglamento y el tratamiento de datos vinculante los establece la institución; la plataforma es el canal operativo donde se aplican las configuraciones acordadas.'
              },
              {
                q: '¿Cómo se obtiene acceso?',
                a: 'Los usuarios reciben sus credenciales por los canales oficiales del colegio. Para incorporar la solución en un nuevo centro, el contacto inicial suele ser dirección, secretaría o el área de sistemas.'
              }
            ].map((f) => (
              <div key={f.q} className="rounded-xl border border-brand-800/50 bg-brand-950/40 px-5 py-4">
                <dt className="font-semibold text-white">{f.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-brand-100/75">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="datos-personales" className="scroll-mt-20 border-t border-brand-950 bg-slate-950 py-16">
        <div className="mx-auto max-w-3xl px-4 lg:px-6">
          <h2 className="text-xl font-bold text-white">Tratamiento de datos personales</h2>
          <p className="mt-4 text-sm leading-relaxed text-brand-100/75">
            El tratamiento de datos personales se rige por la normativa aplicable y por las políticas que la institución
            publique y, en su caso, las aceptaciones registradas en la aplicación. Las credenciales de acceso son
            personales e intransferibles cuando así lo disponga el colegio.
          </p>
          <p className="mt-4 text-xs text-brand-200/50">
            La información jurídica definitiva es la aprobada por la institución y la facilitada al usuario en el momento
            del alta o de la contratación del servicio.
          </p>
        </div>
      </section>

      <footer className="border-t border-brand-900 bg-gradient-to-b from-brand-950 to-slate-950 py-14">
        <div className="mx-auto max-w-6xl px-4 lg:px-6">
          <p className="text-center text-sm text-brand-100/80">Síganos en las redes de la institución</p>
          <div className="mt-6 flex justify-center">
            <SocialLinks />
          </div>
          <div className="mt-14 grid gap-10 border-t border-brand-900/60 pt-10 md:grid-cols-3">
            <div>
              <p className="text-lg font-bold text-white">Escuela Pass</p>
              <p className="mt-2 text-sm text-brand-200/70">Operación y seguridad escolar en un entorno unificado.</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-300/60">Enlaces</p>
              <ul className="mt-4 space-y-2 text-sm text-brand-100/85">
                <li>
                  <a href="#beneficios" className="hover:text-white">
                    Beneficios
                  </a>
                </li>
                <li>
                  <a href="#plataforma" className="hover:text-white">
                    La plataforma
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white">
                    Preguntas frecuentes
                  </a>
                </li>
                <li>
                  <Link to="/login" className="hover:text-white">
                    Acceso a clientes
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-300/60">Contacto</p>
              <p className="mt-4 text-sm text-brand-100/85">
                <a href="tel:+525555555555" className="hover:text-white">
                  +52 55 5555 5555
                </a>
                <br />
                <a href="mailto:contacto@institucion.edu" className="hover:text-white">
                  contacto@institucion.edu
                </a>
              </p>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-brand-900/60 pt-8 text-xs text-brand-200/50 sm:flex-row">
            <span>© {new Date().getFullYear()} Escuela Pass. Todos los derechos reservados.</span>
            <div className="flex gap-6">
              <a href="#datos-personales" className="hover:text-brand-200">
                Políticas de privacidad
              </a>
              <a href="#faq" className="hover:text-brand-200">
                Términos de uso
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

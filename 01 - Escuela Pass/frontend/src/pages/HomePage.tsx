import { Link } from 'react-router-dom';

import logoUrl from '@/assets/landing/logo.png';
import phonePadreUrl from '@/assets/landing/phone-padre.png';
import phoneEstudianteUrl from '@/assets/landing/phone-estudiante.png';
import phoneDocenteUrl from '@/assets/landing/phone-docente.png';
import accesosUrl from '@/assets/landing/accesos-plantel.png';
import salidasUrl from '@/assets/landing/salidas-recogida.png';
import informacionUrl from '@/assets/landing/informacion-perfil.png';
import comunicacionUrl from '@/assets/landing/comunicacion-operativa.png';
import operacionUrl from '@/assets/landing/operacion-diaria.png';
import criterioUrl from '@/assets/landing/criterio-institucional.png';
import escalableUrl from '@/assets/landing/escalable-rol.png';

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
    img: accesosUrl
  },
  {
    title: 'Salidas y recogida',
    text: 'Circuito de recogida con coordinación entre familia y aula: estados visibles y cierre acorde a la norma interna del colegio.',
    img: salidasUrl
  },
  {
    title: 'Información por perfil',
    text: 'Cada usuario trabaja con pantallas acordes a su rol: familia, docencia o administración, sin saturar con datos que no corresponden.',
    img: informacionUrl
  },
  {
    title: 'Comunicación operativa',
    text: 'Módulos para avisos y gestión cotidiana en un mismo entorno, alineado a la operación real del plantel.',
    img: comunicacionUrl
  }
];

const PLATFORM_PILLARS = [
  {
    title: 'Operación diaria',
    body: 'Escuela Pass está pensado para el uso recurrente: ingreso al panel, consultas y acciones habituales con mensajes claros y respuesta ante errores comprensible para el usuario final.',
    img: operacionUrl
  },
  {
    title: 'Criterio institucional',
    body: 'Las políticas de privacidad, la normativa interna y las decisiones pedagógicas siguen siendo del colegio; la herramienta las respeta en la medida en que se configuren en el sistema.',
    img: criterioUrl
  },
  {
    title: 'Escalable por rol',
    body: 'Desde la familia que confirma una recogida hasta el personal que supervisa listados o informes autorizados, el alcance de cada cuenta se ajusta a lo que la institución habilite.',
    img: escalableUrl
  }
];

const PHONES = [
  { src: phonePadreUrl,      label: 'Padres',     delay: '0s'    },
  { src: phoneEstudianteUrl, label: 'Estudiantes', delay: '0.6s'  },
  { src: phoneDocenteUrl,    label: 'Docentes',    delay: '1.2s'  }
];

const FOOTER_LINKS = [
  {
    heading: 'Plataforma',
    links: [
      { label: 'Beneficios',           href: '#beneficios' },
      { label: 'La plataforma',         href: '#plataforma' },
      { label: 'Preguntas frecuentes',  href: '#faq' },
      { label: 'Acceso a clientes',     href: '/login', isRoute: true }
    ]
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacidad', href: '#datos-personales' },
      { label: 'Términos de uso', href: '#faq' }
    ]
  },
  {
    heading: 'Contacto',
    links: [
      { label: '+52 55 5555 5555',       href: 'tel:+525555555555' },
      { label: 'contacto@institucion.edu', href: 'mailto:contacto@institucion.edu' }
    ]
  }
];

const WAVE_STYLE = (delay: string) => ({
  animationName: 'floatWave',
  animationDuration: '3s',
  animationTimingFunction: 'ease-in-out',
  animationIterationCount: 'infinite',
  animationDelay: delay
} as React.CSSProperties);

const GLOW_STYLE = (delay: string) => ({
  animationName: 'glowWave',
  animationDuration: '3s',
  animationTimingFunction: 'ease-in-out',
  animationIterationCount: 'infinite',
  animationDelay: delay
} as React.CSSProperties);

import type React from 'react';

function SocialLinks({ className = '' }: { className?: string }) {
  const cls = 'text-brand-200/70 transition hover:text-white';
  return (
    <div className={`flex items-center gap-4 ${className}`}>
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

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-brand-900/60 bg-brand-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-6 py-4 lg:px-12">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white">
            <img src={logoUrl} alt="" className="h-8 w-auto object-contain" aria-hidden />
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
        <div className="flex gap-4 overflow-x-auto border-t border-brand-900/50 px-6 py-2 text-xs font-medium text-brand-100/85 md:hidden">
          {NAV_LINKS.map((n) => (
            <a key={n.href} href={n.href} className="shrink-0 whitespace-nowrap">
              {n.label}
            </a>
          ))}
        </div>
      </header>

      {/* ─── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-x-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-slate-950">
        <div className="pointer-events-none absolute -right-20 top-1/4 h-96 w-96 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-64 w-64 rounded-full bg-brand-400/10 blur-3xl" />
        <div className="mx-auto grid min-w-0 max-w-screen-2xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:gap-20 lg:px-12 lg:py-28 xl:px-20">
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
            <SocialLinks className="pt-8" />
          </div>

          {/* Phone images with wave-float animation */}
          <div className="flex min-w-0 items-end justify-center pb-10 lg:justify-end lg:pb-16">
            <div className="flex items-end gap-6 sm:gap-8 md:gap-10">
              {PHONES.map((p, i) => (
                <div key={p.label} className="relative flex flex-col items-center">
                  {/* Glow behind the phone */}
                  <div
                    className="absolute inset-x-0 top-6 mx-auto h-[70%] w-[60%] rounded-full bg-white blur-3xl"
                    style={GLOW_STYLE(p.delay)}
                  />
                  <img
                    src={p.src}
                    alt={p.label}
                    className="relative z-10 w-[105px] object-contain drop-shadow-2xl sm:w-[122px] lg:w-[132px]"
                    style={{
                      ...WAVE_STYLE(p.delay),
                      /* stagger vertical start position for natural wave silhouette */
                      marginBottom: i === 1 ? '20px' : '0px'
                    }}
                  />
                  <p className="relative z-10 mt-12 text-center text-[10px] text-white/40">{p.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Benefits ───────────────────────────────────────────────────── */}
      <section id="beneficios" className="scroll-mt-20 border-t border-brand-950 bg-slate-950 py-20">
        <div className="mx-auto max-w-screen-2xl px-6 text-center lg:px-12 xl:px-20">
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
                className="group flex flex-col overflow-hidden rounded-2xl border border-brand-900/60 bg-brand-950/40 text-left shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-brand-700/50 hover:shadow-brand-900/40"
              >
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={b.img}
                    alt={b.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-950/80 via-brand-950/20 to-transparent" />
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

      {/* ─── Platform ───────────────────────────────────────────────────── */}
      <section id="plataforma" className="scroll-mt-20 border-t border-brand-950 bg-slate-900 py-20">
        <div className="mx-auto max-w-screen-2xl px-6 lg:px-12 xl:px-20">
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
                className="group overflow-hidden rounded-2xl border border-brand-800/50 bg-brand-950/50 shadow-md shadow-brand-950/30 transition-all duration-300 hover:-translate-y-1 hover:border-brand-700/50 hover:shadow-lg"
              >
                <div className="relative h-36 overflow-hidden">
                  <img
                    src={p.img}
                    alt={p.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-950/80 via-brand-950/20 to-transparent" />
                </div>
                <div className="p-8">
                  <h3 className="text-lg font-semibold text-white">{p.title}</h3>
                  <p className="mt-4 text-sm leading-relaxed text-brand-100/75">{p.body}</p>
                </div>
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

      {/* ─── FAQ ────────────────────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-20 border-t border-brand-950 bg-slate-950 py-16">
        <div className="mx-auto max-w-3xl px-6 lg:px-12">
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

      {/* ─── Privacy ────────────────────────────────────────────────────── */}
      <section id="datos-personales" className="scroll-mt-20 border-t border-brand-950 bg-slate-900 py-16">
        <div className="mx-auto max-w-3xl px-6 lg:px-12">
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

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-brand-900/60 bg-slate-950 py-16">
        <div className="mx-auto max-w-screen-2xl px-6 lg:px-12 xl:px-20">

          {/* Main grid: brand + 3 columns */}
          <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr_1fr]">

            {/* Brand column */}
            <div className="flex flex-col gap-5">
              <Link to="/" className="flex items-center gap-2 text-base font-bold text-white">
                <img src={logoUrl} alt="" className="h-7 w-auto object-contain" aria-hidden />
                Escuela Pass
              </Link>
              <p className="max-w-xs text-sm leading-relaxed text-brand-200/65">
                Operación y seguridad escolar en un entorno unificado: accesos, recogida y comunicación para toda la comunidad del plantel.
              </p>
              <SocialLinks />
            </div>

            {/* Link columns */}
            {FOOTER_LINKS.map((col) => (
              <div key={col.heading}>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-300/60">{col.heading}</p>
                <ul className="mt-5 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {'isRoute' in l && l.isRoute ? (
                        <Link to={l.href} className="text-sm text-brand-100/70 transition-colors hover:text-white">
                          {l.label}
                        </Link>
                      ) : (
                        <a href={l.href} className="text-sm text-brand-100/70 transition-colors hover:text-white">
                          {l.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-brand-900/60 pt-8 text-xs text-brand-200/45 sm:flex-row">
            <span>© {new Date().getFullYear()} Escuela Pass. Todos los derechos reservados.</span>
            <div className="flex gap-6">
              <a href="#datos-personales" className="transition-colors hover:text-brand-200">Política de privacidad</a>
              <a href="#faq" className="transition-colors hover:text-brand-200">Términos de uso</a>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}

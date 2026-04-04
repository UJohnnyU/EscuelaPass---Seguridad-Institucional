import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-20 lg:py-28">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Plataforma institucional</p>
        <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Escuela Pass
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
          Operación diaria de accesos, circuito de recogida, comunicación y datos académicos con criterios de seguridad,
          trazabilidad y respeto a la privacidad de las personas.
        </p>
        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded border border-white bg-white px-8 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Acceder
          </Link>
          <a
            href="#alcance"
            className="inline-flex items-center justify-center rounded border border-slate-600 px-8 py-3 text-sm font-medium text-slate-200 hover:border-slate-400"
          >
            Alcance
          </a>
          <a
            href="#datos-personales"
            className="inline-flex items-center justify-center rounded border border-slate-600 px-8 py-3 text-sm font-medium text-slate-200 hover:border-slate-400"
          >
            Tratamiento de datos
          </a>
        </div>
      </div>

      <section id="alcance" className="border-t border-slate-800 bg-slate-900/50 py-20">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 lg:grid-cols-3">
          {[
            {
              title: 'Circuito de recogida',
              text: 'Turnos claros entre familia y docencia: señales pedagógicas y confirmación final del acudiente.'
            },
            {
              title: 'Cumplimiento y auditoría',
              text: 'Registros alineados a políticas institucionales; consulta acotada según el rol de cada usuario.'
            },
            {
              title: 'Experiencia de usuario',
              text: 'Pantallas pensadas para el día a día: mensajes claros, sin tecnicismos innecesarios.'
            }
          ].map((c) => (
            <div key={c.title} className="border-b border-slate-800 pb-8 lg:border-b-0 lg:pb-0">
              <h2 className="font-serif text-lg font-semibold text-white">{c.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="datos-personales" className="border-t border-slate-800 py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="font-serif text-2xl font-semibold text-white">Tratamiento de datos personales</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            El uso de Escuela Pass implica el tratamiento de datos personales de estudiantes, familias y personal,
            conforme a la normativa aplicable en materia de protección de datos (habeas data) y a las políticas que la
            institución adopte y publique dentro de la plataforma.
          </p>
          <ul className="mt-6 list-disc space-y-3 pl-5 text-sm leading-relaxed text-slate-400">
            <li>
              Los datos se utilizan para fines educativos, de seguridad del plantel, comunicación institucional y
              gestión académica autorizada.
            </li>
            <li>
              Cada usuario accede solo a la información necesaria según su rol; no se exponen identificadores técnicos
              de sistema en las pantallas destinadas al uso cotidiano.
            </li>
            <li>
              Las credenciales de acceso (incluidos códigos QR cuando aplique) son personales y no deben compartirse;
              el registro de ingresos y salidas tiene fines de control y trazabilidad institucional.
            </li>
            <li>
              Para ejercer derechos de consulta, rectificación o supresión cuando la ley lo permita, debe dirigirse por
              los canales oficiales que la institución habilite.
            </li>
          </ul>
          <p className="mt-8 text-xs leading-relaxed text-slate-500">
            Texto informativo de referencia. El texto jurídico vinculante es el definido por la institución y, cuando
            corresponda, el aceptado electrónicamente dentro de la aplicación.
          </p>
        </div>
      </section>
    </div>
  );
}

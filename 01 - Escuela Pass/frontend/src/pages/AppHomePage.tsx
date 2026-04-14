import { Link } from 'react-router-dom';
import { AdminDashboardPanel } from '@/components/admin/AdminDashboardPanel';
import { useAuth } from '@/context/useAuth';

export function AppHomePage() {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const isAdminPanel = role === 'ADMIN' || role === 'ADMINISTRATIVO';

  const cards: { to: string; title: string; desc: string; show: boolean; emphasis?: boolean }[] = [
    {
      to: '/app/modulos',
      title: 'Módulos operativos',
      desc: 'Comunicación, pagos, académico, visitas, informes y herramientas para evaluación en ejecución.',
      show: true,
      emphasis: true
    },
    {
      to: '/app/institucion',
      title: 'Institución',
      desc: 'Datos de contacto y perfil visible para la comunidad educativa.',
      show: true
    },
    {
      to: '/app/circuito',
      title: 'Circuito de recogida',
      desc: 'Solicitudes de retiro y avisos de la familia (en camino, llegada, confirmación de recibimiento).',
      show: role === 'PADRE'
    },
    {
      to: '/app/circuito/hoy',
      title: 'Circuito del día',
      desc: 'Seguimiento del día para docencia y administración.',
      show: role === 'DOCENTE' || role === 'ADMIN' || role === 'ADMINISTRATIVO'
    },
    {
      to: '/app/horario',
      title: 'Mi horario',
      desc: 'Clases semanales, días sin clases de la institución y avisos enviados a su cuenta.',
      show: role === 'ALUMNO'
    }
  ];

  return (
    <div className={`animate-fade-in ${isAdminPanel ? 'max-w-6xl' : 'max-w-5xl'}`}>
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-slate-900">
        Hola{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
        {isAdminPanel ? (
          <>
            Bienvenido. El resumen inferior muestra indicadores del día y la tendencia de circuitos; use los accesos
            rápidos para profundizar en informes o en el seguimiento en vivo del circuito de recogida.
          </>
        ) : (
          <>
            Bienvenido al panel de trabajo. Use los módulos operativos para revisar cada área; el circuito de recogida
            exige la confirmación final de la familia cuando el menor está en tránsito hacia la salida.
          </>
        )}
      </p>
      {isAdminPanel && (
        <div className="mt-10">
          <AdminDashboardPanel />
        </div>
      )}
      {role === 'ALUMNO' && (
        <p className="mt-6 rounded border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          Su cuenta puede consultar información institucional. Otras gestiones las coordina la escuela con usted.
        </p>
      )}
      <ul className={`grid gap-4 sm:grid-cols-2 ${isAdminPanel ? 'mt-10' : 'mt-12'}`}>
        {cards
          .filter((c) => c.show)
          .map((c) => (
            <li key={c.to}>
              <Link
                to={c.to}
                className={`block h-full rounded border bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow ${
                  c.emphasis ? 'border-brand-800/30 ring-1 ring-brand-900/10' : 'border-slate-200'
                }`}
              >
                <h2 className="font-medium text-slate-900">{c.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.desc}</p>
                <span className="mt-4 inline-block text-xs font-semibold uppercase tracking-wide text-brand-800">
                  Abrir
                </span>
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}

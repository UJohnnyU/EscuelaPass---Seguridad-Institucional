import { useMemo } from 'react';
import { AdminDashboardPanel } from '@/components/admin/AdminDashboardPanel';
import { useAuth } from '@/context/useAuth';

export function AppHomePage() {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const isInstitutionPanel = role === 'ADMIN' || role === 'ADMINISTRATIVO';

  const todayLong = useMemo(
    () =>
      new Date().toLocaleDateString('es', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }),
    []
  );

  const summaryBullets = useMemo(() => {
    if (role === 'ALUMNO') {
      return [
        'Consulte su horario semanal, calificaciones y boletines desde las entradas correspondientes del menú.',
        'En Comunicación encontrará avisos institucionales y notificaciones dirigidas a su usuario.',
        'En Institución puede ver los datos de contacto y el perfil público de la escuela.'
      ];
    }
    if (role === 'PADRE') {
      return [
        'En Circuito (familia) siga las solicitudes de recogida y confirme la entrega cuando corresponda.',
        'Mis calificaciones y Boletines concentran el rendimiento académico de sus hijos.',
        'Comunicación y Finanzas reúnen avisos y obligaciones de pago según lo que la institución publique.'
      ];
    }
    if (role === 'DOCENTE') {
      return [
        'Circuito del día y el módulo Académico le permiten seguir asistencia y el trabajo en clase.',
        'Actividades y notas y Anotaciones son el canal principal de evaluación y observaciones a familias.',
        'Visitas externas y Reuniones organizan agendas con externos y con la comunidad educativa.'
      ];
    }
    return [
      'Use el menú lateral para abrir cada área habilitada para su rol.',
      'Si no ve alguna opción, su cuenta no tiene permisos para esa función.'
    ];
  }, [role]);

  return (
    <div className={`animate-fade-in ${isInstitutionPanel ? 'max-w-6xl' : 'max-w-3xl'}`}>
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-slate-900">
        Hola{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
      </h1>
      <p className="mt-1 text-sm capitalize text-slate-500">{todayLong}</p>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
        {isInstitutionPanel ? (
          <>
            Este inicio muestra indicadores del día y la tendencia de circuitos para su institución. El detalle de cada
            área (comunicación, finanzas, visitas, reuniones, informes) está en el{' '}
            <strong className="font-medium text-slate-800">menú lateral</strong>, según los permisos de su rol.
          </>
        ) : (
          <>
            Aquí encontrará un resumen orientativo. Todas las herramientas y pantallas de trabajo están en el{' '}
            <strong className="font-medium text-slate-800">menú lateral</strong>, filtradas por su tipo de cuenta.
          </>
        )}
      </p>

      {isInstitutionPanel && (
        <div className="mt-10">
          <AdminDashboardPanel />
        </div>
      )}

      {!isInstitutionPanel && (
        <section className="mt-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-lg font-semibold text-slate-900">Qué puede hacer con su cuenta</h2>
          <ul className="mt-4 list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-slate-700">
            {summaryBullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {role === 'ALUMNO' && (
        <p className="mt-8 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
          Otras gestiones las coordina la escuela con usted o con su familia; ante dudas, consulte en secretaría.
        </p>
      )}
    </div>
  );
}

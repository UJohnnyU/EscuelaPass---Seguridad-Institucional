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
        'Revise su horario, sus calificaciones y descargue sus boletines desde las opciones del menú.',
        'En Comunicación encontrará los avisos de la escuela y los mensajes dirigidos a usted.',
        'En Institución puede ver el contacto y la información pública de la escuela.'
      ];
    }
    if (role === 'PADRE') {
      return [
        'En Circuito puede pedir la recogida de sus hijos y avisar cuando esté en camino.',
        'En Mis calificaciones y Boletines sigue el rendimiento académico de sus hijos.',
        'En Comunicación recibe los avisos de la escuela y en Finanzas consulta los pagos pendientes.'
      ];
    }
    if (role === 'DOCENTE') {
      return [
        'Tome asistencia y siga el día de clases desde Académico y Circuito del día.',
        'Cargue actividades, califique y deje observaciones a las familias en Actividades y notas y en Anotaciones.',
        'Programe encuentros con familias o externos en Reuniones y Visitas externas.'
      ];
    }
    return [
      'Abra cualquier opción del menú lateral para entrar a esa sección.',
      'Si no ve alguna opción, es porque su cuenta no la tiene habilitada.'
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
            Aquí tiene un vistazo del día y de la última semana en su escuela. Para entrar a comunicación, finanzas,
            visitas, reuniones e informes use el{' '}
            <strong className="font-medium text-slate-800">menú lateral</strong>.
          </>
        ) : (
          <>
            Este es su punto de partida. Todas las funciones de su cuenta están a un clic en el{' '}
            <strong className="font-medium text-slate-800">menú lateral</strong>.
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
          Para cualquier otra gestión, hable con su familia o acérquese a secretaría.
        </p>
      )}
    </div>
  );
}

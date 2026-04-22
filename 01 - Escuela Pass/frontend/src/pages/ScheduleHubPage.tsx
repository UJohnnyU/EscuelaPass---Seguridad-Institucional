import { useAuth } from '@/context/useAuth';
import { StaffScheduleBrowsePage } from '@/pages/StaffScheduleBrowsePage';
import { StudentSchedulePage } from '@/pages/StudentSchedulePage';

export function ScheduleHubPage() {
  const { user } = useAuth();
  if (user?.role === 'ALUMNO' || user?.role === 'DOCENTE') {
    return <StudentSchedulePage />;
  }
  if (user?.role === 'ADMIN' || user?.role === 'ADMINISTRATIVO') {
    return <StaffScheduleBrowsePage />;
  }
  return (
    <p className="text-sm text-slate-600">
      Esta sección no está disponible para su tipo de cuenta.
    </p>
  );
}

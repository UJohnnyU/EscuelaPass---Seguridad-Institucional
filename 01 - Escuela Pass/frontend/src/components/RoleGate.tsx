import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';

type Role = string;

export function RoleGate({
  allow,
  children
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        Cargando permisos…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/app" replace />;
  }

  // ADMIN siempre puede entrar aunque no esté en allow.
  if (user.role !== 'ADMIN' && !allow.includes(user.role)) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}

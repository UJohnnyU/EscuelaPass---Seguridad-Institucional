import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { navVisibleForRole, SIDEBAR_NAV } from '@/navigation/navConfig';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  ADMINISTRATIVO: 'Administrativo',
  DOCENTE: 'Docente',
  PADRE: 'Familia',
  ALUMNO: 'Estudiante'
};

const navCls = ({ isActive }: { isActive: boolean }) =>
  `block rounded px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-white/10 font-medium text-white'
      : 'text-slate-300 hover:bg-white/5 hover:text-white'
  }`;

export function AppShell() {
  const { user, logout } = useAuth();
  const role = user?.role;
  const navItems = SIDEBAR_NAV.filter((item) => navVisibleForRole(item, role));

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-slate-100 lg:flex">
        <div className="border-b border-slate-800 px-4 py-5">
          <Link to="/app" className="block font-serif text-lg font-semibold tracking-tight text-white">
            Escuela Pass
          </Link>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-widest text-slate-500">
            Gestión institucional
          </p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/app'} className={navCls}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-4 text-xs text-slate-500">
          Uso autorizado de la institución
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <Link to="/app" className="font-serif font-semibold text-slate-900">
            Escuela Pass
          </Link>
          <nav className="flex max-w-[70%] flex-1 flex-wrap items-center justify-end gap-2 text-[11px] font-medium">
            {navItems.slice(0, 5).map((item) => (
              <Link key={item.to} to={item.to} className="text-brand-800">
                {item.label}
              </Link>
            ))}
            <button type="button" onClick={() => void logout()} className="text-slate-600">
              Salir
            </button>
          </nav>
        </header>

        <header className="hidden items-center justify-between gap-4 border-b border-slate-200/80 bg-white px-8 py-4 lg:flex">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{user?.fullName}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              {ROLE_LABEL[role ?? ''] ?? role}
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-8 lg:px-10">
          <Outlet />
        </main>

        <footer className="border-t border-slate-200/80 bg-white px-4 py-6 text-center text-[11px] text-slate-500 lg:px-10">
          Escuela Pass — plataforma para instituciones educativas. La información se muestra de forma clara y acotada a
          su perfil.
        </footer>
      </div>
    </div>
  );
}

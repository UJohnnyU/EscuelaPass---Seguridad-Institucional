import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { publicAssetUrl } from '@/lib/asset-url';
import { navVisibleForRole, SIDEBAR_NAV } from '@/navigation/navConfig';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationsBadge } from '@/components/NotificationsBadge';

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

function headerInitials(fullName: string) {
  const n = fullName.trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

export function AppShell() {
  const { user, logout } = useAuth();
  const role = user?.role;
  const avatarSrc = publicAssetUrl(user?.avatarUrl ?? null);
  const navItems = SIDEBAR_NAV.filter((item) => navVisibleForRole(item, role));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

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
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-main-menu"
            >
              Menú
            </button>
            <Link to="/app" className="min-w-0">
              <p className="font-serif font-semibold text-slate-900">Escuela Pass</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Gestión institucional</p>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBadge compact />
            <ThemeToggle compact />
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded bg-brand-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800"
            >
              Salir
            </button>
          </div>
        </header>
        {mobileMenuOpen && (
          <div className="lg:hidden">
            <button
              type="button"
              className="fixed inset-0 z-30 bg-slate-950/40"
              aria-label="Cerrar menú"
              onClick={closeMobileMenu}
            />
            <aside
              id="mobile-main-menu"
              className="fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r border-slate-800 bg-slate-950 text-slate-100 shadow-2xl"
            >
              <div className="flex items-start justify-between border-b border-slate-800 px-4 py-5">
                <div>
                  <Link to="/app" onClick={closeMobileMenu} className="block font-serif text-lg font-semibold text-white">
                    Escuela Pass
                  </Link>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-widest text-slate-500">
                    Gestión institucional
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
                >
                  Cerrar
                </button>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/app'}
                    className={navCls}
                    onClick={closeMobileMenu}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="border-t border-slate-800 p-4 text-xs text-slate-500">Uso autorizado de la institución</div>
            </aside>
          </div>
        )}

        <header className="hidden items-center justify-between gap-4 border-b border-slate-200/80 bg-white px-8 py-4 lg:flex">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-200">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-900 text-xs font-semibold text-white">
                  {user?.fullName ? headerInitials(user.fullName) : '—'}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{user?.fullName}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              {ROLE_LABEL[role ?? ''] ?? role}
            </span>
            <NotificationsBadge />
            <ThemeToggle />
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

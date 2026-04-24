import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { publicAssetUrl } from '@/lib/asset-url';
import { uploadReportEvidence } from '@/lib/uploads-api';
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
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<'ERROR' | 'SUGERENCIA' | 'PETICION' | 'OTRO'>('ERROR');
  const [reportSubject, setReportSubject] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [reportSending, setReportSending] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportOk, setReportOk] = useState<string | null>(null);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function resetReportForm() {
    setReportType('ERROR');
    setReportSubject('');
    setReportMessage('');
    setReportFiles([]);
    setReportError(null);
    setReportOk(null);
  }

  async function submitReport() {
    setReportError(null);
    setReportOk(null);
    if (reportSubject.trim().length < 5) {
      setReportError('El asunto debe tener al menos 5 caracteres.');
      return;
    }
    if (reportMessage.trim().length < 10) {
      setReportError('El detalle debe tener al menos 10 caracteres.');
      return;
    }
    try {
      setReportSending(true);
      const evidenceUrls: string[] = [];
      for (const file of reportFiles.slice(0, 5)) {
        const uploaded = await uploadReportEvidence(file);
        if (uploaded?.evidenceUrl) evidenceUrls.push(uploaded.evidenceUrl);
      }
      await api.post('/api/v1/notifications/admin-reports', {
        type: reportType,
        subject: reportSubject.trim(),
        message: reportMessage.trim(),
        evidenceUrls
      });
      setReportOk('Reporte enviado al equipo administrador.');
      resetReportForm();
      setReportOpen(false);
    } catch (e) {
      setReportError(getUserFacingMessage(e, 'No se pudo enviar el reporte.'));
    } finally {
      setReportSending(false);
    }
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-slate-100 text-slate-900">
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
        <div className="px-3 pb-3">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded border border-red-700/70 bg-red-900/30 px-3 py-2 text-left text-sm font-medium text-red-200 hover:bg-red-900/50"
            onClick={() => setReportOpen(true)}
          >
            <span aria-hidden="true" className="text-red-400">▲</span>
            Reportar problema
          </button>
        </div>
        <div className="border-t border-slate-800 p-4 text-xs text-slate-500">
          Uso autorizado de la institución
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
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
              className="rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800"
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
              <div className="px-3 pb-3">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded border border-red-700/70 bg-red-900/30 px-3 py-2 text-left text-sm font-medium text-red-200 hover:bg-red-900/50"
                  onClick={() => {
                    setReportOpen(true);
                    closeMobileMenu();
                  }}
                >
                  <span aria-hidden="true" className="text-red-400">▲</span>
                  Reportar problema
                </button>
              </div>
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
              className="rounded border border-red-700 bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-8 lg:px-10">
          <div className="mx-auto w-full max-w-6xl min-w-0 [&>*]:mx-auto [&>*]:min-w-0 [&>*]:w-full">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-slate-200/80 bg-white px-4 py-6 text-center text-[11px] text-slate-500 lg:px-10">
          Escuela Pass — plataforma para instituciones educativas. La información se muestra de forma clara y acotada a
          su perfil.
        </footer>
      </div>
      {reportOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Reporte de incidencia</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Envíe un reporte profesional al equipo administrador. Puede incluir capturas para facilitar el diagnóstico.
                </p>
              </div>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
                onClick={() => {
                  setReportOpen(false);
                  setReportError(null);
                  setReportOk(null);
                }}
              >
                Cerrar
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-slate-700">Tipo</span>
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as 'ERROR' | 'SUGERENCIA' | 'PETICION' | 'OTRO')}
                >
                  <option value="ERROR">Error</option>
                  <option value="SUGERENCIA">Sugerencia</option>
                  <option value="PETICION">Petición</option>
                  <option value="OTRO">Otro</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-slate-700">Asunto</span>
                <input
                  type="text"
                  maxLength={160}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  value={reportSubject}
                  onChange={(e) => setReportSubject(e.target.value)}
                  placeholder="Ej. Error al guardar la asistencia"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="text-slate-700">Detalle</span>
                <textarea
                  className="mt-1 min-h-[140px] w-full rounded border border-slate-300 px-3 py-2"
                  maxLength={4000}
                  value={reportMessage}
                  onChange={(e) => setReportMessage(e.target.value)}
                  placeholder="Indique qué intentó hacer, qué ocurrió y cómo se puede reproducir."
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="text-slate-700">Capturas (opcional, hasta 5)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? []).slice(0, 5);
                    setReportFiles(selected);
                  }}
                />
                {reportFiles.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {reportFiles.map((f, idx) => (
                      <li key={`${f.name}-${idx}`} className="flex items-center justify-between gap-2">
                        <span className="truncate">{f.name}</span>
                        <button
                          type="button"
                          className="text-red-700 underline"
                          onClick={() => setReportFiles((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </label>
            </div>
            {reportError ? (
              <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{reportError}</p>
            ) : null}
            {reportOk ? (
              <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{reportOk}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700"
                onClick={() => {
                  resetReportForm();
                  setReportOpen(false);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                onClick={() => void submitReport()}
                disabled={reportSending}
              >
                {reportSending ? 'Enviando…' : 'Enviar reporte'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

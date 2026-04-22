import { publicAssetUrl } from '@/lib/asset-url';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  ADMINISTRATIVO: 'Administrativo',
  DOCENTE: 'Docente',
  PADRE: 'Familia / acudiente',
  ALUMNO: 'Estudiante'
};

export type ScanPersona = {
  nombreCompleto?: string;
  rol?: string;
  matriculaAlumno?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  grupo?: string | null;
  acceso?: string | null;
  eventoTipo?: string | null;
  eventoTiempo?: string | null;
};

export type ScanResponse = {
  persona?: ScanPersona;
  message?: string;
};

export function QrScanResultModal({
  result,
  onClose,
  onRescan
}: {
  result: ScanResponse;
  onClose: () => void;
  onRescan: () => void;
}) {
  const p = result.persona ?? {};
  const avatar = publicAssetUrl(p.avatarUrl ?? null);
  const roleLabel = ROLE_LABEL[p.rol ?? ''] ?? p.rol ?? '—';
  const access = p.acceso === 'AUTORIZADO';
  const initials = (() => {
    const n = (p.nombreCompleto ?? '?').trim();
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  })();
  const timeLabel = p.eventoTiempo
    ? new Date(p.eventoTiempo).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className={`px-6 pb-16 pt-8 text-white ${access ? 'bg-gradient-to-br from-emerald-600 to-emerald-700' : 'bg-gradient-to-br from-rose-600 to-rose-700'}`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
            {access ? 'Acceso autorizado' : 'Acceso restringido'}
          </p>
          <p className="mt-1 text-sm">
            {p.eventoTipo === 'ENTRY' ? 'Ingreso registrado' : p.eventoTipo === 'EXIT' ? 'Salida registrada' : 'Evento registrado'}
            {timeLabel ? ` · ${timeLabel}` : ''}
          </p>
        </div>
        <div className="-mt-14 px-6">
          <div className="mx-auto h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-lg">
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-2xl font-semibold text-white">
                {initials}
              </div>
            )}
          </div>
        </div>
        <div className="px-6 pb-6 pt-4 text-center">
          <h2 className="font-serif text-xl font-semibold text-slate-900 dark:text-slate-100">{p.nombreCompleto ?? '—'}</h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{roleLabel}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-left text-sm">
            {p.matriculaAlumno ? (
              <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Matrícula</dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{p.matriculaAlumno}</dd>
              </div>
            ) : null}
            {p.grupo ? (
              <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Grupo</dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{p.grupo}</dd>
              </div>
            ) : null}
            {p.email ? (
              <div className="col-span-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Correo</dt>
                <dd className="mt-0.5 truncate font-medium text-slate-900 dark:text-slate-100">{p.email}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={onRescan}
              className="flex-1 rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70"
            >
              Escanear otro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

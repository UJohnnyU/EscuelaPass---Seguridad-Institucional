import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { publicAssetUrl } from '@/lib/asset-url';
import { Panel } from '@/components/ValueView';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  ADMINISTRATIVO: 'Administrativo',
  DOCENTE: 'Docente',
  PADRE: 'Familia / acudiente',
  ALUMNO: 'Estudiante'
};

type ScanPersona = {
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

type ScanResponse = {
  persona?: ScanPersona;
  message?: string;
};

const READER_ID = 'escaner-qr-region';

export function EscanerAccesoPage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [eventType, setEventType] = useState<'ENTRY' | 'EXIT'>('ENTRY');

  const stopCamera = useCallback(async () => {
    const s = scannerRef.current;
    if (!s) return;
    try {
      await s.stop();
      await s.clear();
    } catch {
      /* ignorar */
    }
    scannerRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  async function handleDecoded(text: string) {
    setErr(null);
    try {
      const { data } = await api.post<ScanResponse>('/api/v1/access-events/scan', {
        method: 'QR',
        credentialValue: text.trim(),
        eventType
      });
      setResult(data);
    } catch (e) {
      setErr(getUserFacingMessage(e));
      setResult(null);
    }
  }

  async function startCamera() {
    setErr(null);
    setResult(null);
    await stopCamera();
    const html5 = new Html5Qrcode(READER_ID);
    scannerRef.current = html5;
    setScanning(true);
    try {
      await html5.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          void handleDecoded(decoded);
          void stopCamera();
        },
        () => undefined
      );
    } catch (e) {
      scannerRef.current = null;
      setScanning(false);
      setErr(getUserFacingMessage(e) || 'No se pudo abrir la cámara. Verifique los permisos del navegador.');
    }
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Escáner de acceso</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Use la cámara para leer el código QR de un estudiante, padre o visitante autorizado. Aparecerán su nombre y
          los datos necesarios para registrar el ingreso o la salida.
        </p>
      </div>

      <Panel title="Tipo de registro">
        <div className="flex flex-wrap gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="ev"
              checked={eventType === 'ENTRY'}
              onChange={() => setEventType('ENTRY')}
            />
            Ingreso
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="ev"
              checked={eventType === 'EXIT'}
              onChange={() => setEventType('EXIT')}
            />
            Salida
          </label>
        </div>
      </Panel>

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}

      <Panel title="Lectura con cámara">
        <div
          id={READER_ID}
          className="min-h-[200px] w-full overflow-hidden rounded border border-slate-200 bg-slate-50"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          {!scanning ? (
            <button
              type="button"
              onClick={() => void startCamera()}
              className="rounded bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-950"
            >
              Iniciar cámara
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void stopCamera()}
              className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900"
            >
              Detener
            </button>
          )}
        </div>
      </Panel>

      {result?.persona ? (
        <ScanResultModal result={result} onClose={() => setResult(null)} onRescan={() => { setResult(null); void startCamera(); }} />
      ) : null}
    </div>
  );
}

function ScanResultModal({
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
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
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
          <h2 className="font-serif text-xl font-semibold text-slate-900">{p.nombreCompleto ?? '—'}</h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">{roleLabel}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-left text-sm">
            {p.matriculaAlumno ? (
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Matrícula</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{p.matriculaAlumno}</dd>
              </div>
            ) : null}
            {p.grupo ? (
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Grupo</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{p.grupo}</dd>
              </div>
            ) : null}
            {p.email ? (
              <div className="col-span-2 rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Correo</dt>
                <dd className="mt-0.5 truncate font-medium text-slate-900">{p.email}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={onRescan}
              className="flex-1 rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Escanear otro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

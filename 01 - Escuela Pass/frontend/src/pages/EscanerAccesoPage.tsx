import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
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
      setErr(getUserFacingMessage(e) || 'No se pudo abrir la cámara. Compruebe permisos o use entrada manual.');
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

      <Panel title="Si la cámara no funciona, escriba el código">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const v = String(fd.get('manual') ?? '').trim();
            if (v) void handleDecoded(v);
          }}
        >
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600">Texto del código QR</label>
            <input
              name="manual"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Pegue o escriba el contenido del código"
            />
          </div>
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Consultar
          </button>
        </form>
      </Panel>

      {result && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
          <p className="text-sm font-semibold">Resultado del escaneo</p>
          {result.persona && (
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-xs uppercase text-emerald-800">Nombre</dt>
                <dd className="font-medium">{result.persona.nombreCompleto ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-emerald-800">Rol</dt>
                <dd>{ROLE_LABEL[result.persona.rol ?? ''] ?? result.persona.rol ?? '—'}</dd>
              </div>
              {result.persona.matriculaAlumno != null && result.persona.matriculaAlumno !== '' && (
                <div>
                  <dt className="text-xs uppercase text-emerald-800">Matrícula</dt>
                  <dd>{result.persona.matriculaAlumno}</dd>
                </div>
              )}
            </dl>
          )}
          {result.message && <p className="mt-4 text-sm">{result.message}</p>}
        </div>
      )}
    </div>
  );
}

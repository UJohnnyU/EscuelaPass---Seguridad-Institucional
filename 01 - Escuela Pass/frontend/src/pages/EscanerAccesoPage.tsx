import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { QrScanResultModal, type ScanResponse } from '@/components/QrScanResultModal';
import { Panel } from '@/components/ValueView';

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
    <div className="mx-auto max-w-3xl animate-fade-in space-y-8">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow-sm dark:border-slate-700 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Control de acceso</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Escáner de acceso</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
          Use la cámara para leer el código QR de un estudiante, padre o visitante autorizado. Aparecerán su nombre y
          los datos necesarios para registrar el ingreso o la salida.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/90">
          <span className={`h-2 w-2 rounded-full ${scanning ? 'bg-emerald-300' : 'bg-amber-300'}`} />
          {scanning ? 'Cámara activa' : 'Cámara en espera'}
        </div>
      </header>

      <Panel title="Tipo de registro" description="Seleccione qué evento desea registrar antes de escanear.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className={`group flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
              eventType === 'ENTRY'
                ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-500/60 dark:bg-emerald-900/30 dark:text-emerald-100'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600'
            }`}
          >
            <input
              type="radio"
              name="ev"
              checked={eventType === 'ENTRY'}
              onChange={() => setEventType('ENTRY')}
              className="h-4 w-4"
            />
            <div>
              <p className="text-sm font-semibold">Ingreso</p>
              <p className="text-xs opacity-80">Entrada al plantel</p>
            </div>
          </label>
          <label
            className={`group flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
              eventType === 'EXIT'
                ? 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500/60 dark:bg-amber-900/30 dark:text-amber-100'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600'
            }`}
          >
            <input
              type="radio"
              name="ev"
              checked={eventType === 'EXIT'}
              onChange={() => setEventType('EXIT')}
              className="h-4 w-4"
            />
            <div>
              <p className="text-sm font-semibold">Salida</p>
              <p className="text-xs opacity-80">Salida del plantel</p>
            </div>
          </label>
        </div>
      </Panel>

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      )}

      <Panel title="Lectura con cámara" description="Alinee el código QR dentro del recuadro y espere la confirmación.">
        <div
          id={READER_ID}
          className="min-h-[260px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-inner dark:border-slate-700 dark:bg-slate-900"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          {!scanning ? (
            <button
              type="button"
              onClick={() => void startCamera()}
              className="rounded-xl bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70"
            >
              Iniciar cámara
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void stopCamera()}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Detener
            </button>
          )}
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          Consejo: mantenga buena iluminación y evite reflejos en la pantalla del QR para una lectura más rápida.
        </div>
      </Panel>

      {result?.persona ? (
        <QrScanResultModal
          result={result}
          onClose={() => setResult(null)}
          onRescan={() => {
            setResult(null);
            void startCamera();
          }}
        />
      ) : null}
    </div>
  );
}

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

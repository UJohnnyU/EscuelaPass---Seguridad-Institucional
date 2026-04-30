import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { QrScanResultModal, type ScanResponse } from '@/components/QrScanResultModal';
import { Panel } from '@/components/ValueView';

const READER_ID = 'escaner-qr-region';

/** Web NFC API – solo disponible en Chrome/Android. */
interface NDEFRecord {
  recordType: string;
  toText?: () => string;
  data?: DataView;
}
interface NDEFReadingEvent {
  serialNumber: string;
  message: { records: NDEFRecord[] };
}
interface NDEFReader extends EventTarget {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
}
declare global {
  interface Window {
    NDEFReader?: new () => NDEFReader;
  }
}

function nfcIsSupported(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

function extractNfcCredentialValue(event: NDEFReadingEvent): string {
  for (const record of event.message.records) {
    if (record.recordType === 'text') {
      try {
        if (typeof record.toText === 'function') {
          const text = record.toText().trim();
          if (text) return text;
        }
        if (record.data) {
          const enc = new TextDecoder('utf-8');
          const text = enc.decode(record.data).trim();
          if (text) return text;
        }
      } catch {
        // continúa con el siguiente registro o usa el serial
      }
    }
  }
  return event.serialNumber.replace(/:/g, '').toUpperCase();
}

export function EscanerAccesoPage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const nfcAbortRef = useRef<AbortController | null>(null);

  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [eventType, setEventType] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [nfcScanning, setNfcScanning] = useState(false);
  const [nfcErr, setNfcErr] = useState<string | null>(null);
  const [nfcInfo, setNfcInfo] = useState<string | null>(null);

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

  const stopNfc = useCallback(() => {
    if (nfcAbortRef.current) {
      nfcAbortRef.current.abort();
      nfcAbortRef.current = null;
    }
    setNfcScanning(false);
    setNfcInfo(null);
  }, []);

  useEffect(() => {
    return () => {
      void stopCamera();
      stopNfc();
    };
  }, [stopCamera, stopNfc]);

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

  async function handleNfcRead(credentialValue: string) {
    setNfcErr(null);
    setNfcInfo(`Tarjeta detectada: ${credentialValue}`);
    try {
      const { data } = await api.post<ScanResponse>('/api/v1/access-events/scan', {
        method: 'NFC',
        credentialValue,
        eventType
      });
      stopNfc();
      setResult(data);
    } catch (e) {
      setNfcErr(getUserFacingMessage(e));
      setNfcInfo(null);
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

  async function startNfc() {
    setNfcErr(null);
    setNfcInfo(null);
    setResult(null);
    if (!nfcIsSupported()) {
      setNfcErr(
        'NFC no está disponible en este navegador. Use Chrome en Android con NFC activado en el dispositivo.'
      );
      return;
    }
    stopNfc();
    const controller = new AbortController();
    nfcAbortRef.current = controller;
    setNfcScanning(true);
    setNfcInfo('Acerque la tarjeta NFC al lector del dispositivo…');
    try {
      const ndef = new window.NDEFReader!();
      await ndef.scan({ signal: controller.signal });
      ndef.onreading = (event: NDEFReadingEvent) => {
        const value = extractNfcCredentialValue(event);
        void handleNfcRead(value);
      };
      ndef.onerror = () => {
        setNfcErr('Error al leer la tarjeta NFC. Acerque la tarjeta de nuevo.');
      };
    } catch (e) {
      nfcAbortRef.current = null;
      setNfcScanning(false);
      setNfcInfo(null);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('Permission')) {
        setNfcErr('Permiso NFC denegado. Habilite el permiso de NFC para este sitio en el navegador.');
      } else if (msg.includes('abort')) {
        /* cancelado por el usuario */
      } else {
        setNfcErr(`No se pudo iniciar el lector NFC: ${msg}`);
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in space-y-8">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow-sm dark:border-slate-700 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Control de acceso</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Escáner de acceso</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
          Use la cámara para leer el código QR, o acerque una tarjeta NFC al dispositivo para registrar el ingreso o
          la salida de estudiantes, docentes y personal autorizado.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/90">
            <span className={`h-2 w-2 rounded-full ${scanning ? 'bg-emerald-300' : 'bg-amber-300'}`} />
            {scanning ? 'Cámara activa' : 'Cámara en espera'}
          </div>
          {nfcIsSupported() && (
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/90">
              <span className={`h-2 w-2 rounded-full ${nfcScanning ? 'bg-blue-300' : 'bg-slate-400'}`} />
              {nfcScanning ? 'NFC activo' : 'NFC en espera'}
            </div>
          )}
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

      <Panel title="Lectura con cámara (QR)" description="Alinee el código QR dentro del recuadro y espere la confirmación.">
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

      <Panel
        title="Lectura con tarjeta NFC"
        description={
          nfcIsSupported()
            ? 'Acerque la tarjeta NFC al lector del dispositivo Android. La tarjeta debe estar registrada en el sistema.'
            : 'NFC requiere Chrome en Android con NFC activado. No disponible en este navegador o dispositivo.'
        }
      >
        {nfcErr && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {nfcErr}
          </div>
        )}
        {nfcInfo && (
          <div className="mb-3 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
            {nfcInfo}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {!nfcScanning ? (
            <button
              type="button"
              onClick={() => void startNfc()}
              disabled={!nfcIsSupported()}
              className="rounded-xl bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Activar lector NFC
            </button>
          ) : (
            <button
              type="button"
              onClick={stopNfc}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Detener NFC
            </button>
          )}
        </div>
        {!nfcIsSupported() && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Para usar NFC, abra esta página en Chrome para Android en un dispositivo con NFC habilitado.
          </p>
        )}
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

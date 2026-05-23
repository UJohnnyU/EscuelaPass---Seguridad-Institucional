import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { QrScanResultModal, type ScanResponse } from '@/components/QrScanResultModal';
import { Panel } from '@/components/ValueView';
import { SmartSelect, type SmartSelectOption } from '@/components/SmartSelect';
import { useAuth } from '@/context/useAuth';

type NfcCredential = {
  id: string;
  userId: string;
  credentialType: string;
  credentialValue: string;
  status: string;
  createdAt: string;
  userFullName: string | null;
  userEmail: string | null;
  userRole: string | null;
  matricula?: string | null;
};

type CredListMeta = { total: number; page: number; limit: number; pages: number };

const ROLE_LABEL: Record<string, string> = {
  ALUMNO: 'Alumno',
  DOCENTE: 'Docente',
  ADMINISTRATIVO: 'Administrativo',
  PADRE: 'Padre / familia',
  ADMIN: 'Administrador'
};

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

/** Sin separadores y en mayúsculas; alinea lectores USB/keyboard wedge, pegado manual y UIDs guardados en el sistema. */
function normalizeNfcUidInput(raw: string): string {
  return raw.trim().replace(/[:-]/g, '').toUpperCase();
}

/** UID hardware del chip (serialNumber), sin texto NDEF ni separadores. */
function extractNfcCredentialValue(event: NDEFReadingEvent): string {
  return normalizeNfcUidInput(event.serialNumber);
}

export function EscanerAccesoPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'ADMINISTRATIVO';

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const nfcAbortRef = useRef<AbortController | null>(null);
  const assignNfcAbortRef = useRef<AbortController | null>(null);

  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [eventType, setEventType] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [nfcScanning, setNfcScanning] = useState(false);
  const [nfcErr, setNfcErr] = useState<string | null>(null);
  const [nfcInfo, setNfcInfo] = useState<string | null>(null);
  const [manualUid, setManualUid] = useState('');
  const [manualErr, setManualErr] = useState<string | null>(null);
  const [manualBusy, setManualBusy] = useState(false);

  // NFC credential management (ADMIN/ADMINISTRATIVO only)
  const [nfcCredentials, setNfcCredentials] = useState<NfcCredential[]>([]);
  const [credMeta, setCredMeta] = useState<CredListMeta | null>(null);
  const [credBusy, setCredBusy] = useState(false);
  const [credErr, setCredErr] = useState<string | null>(null);
  const [credMsg, setCredMsg] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignNfcUid, setAssignNfcUid] = useState('');
  const [assignNfcReading, setAssignNfcReading] = useState(false);
  const [showCredPanel, setShowCredPanel] = useState(false);
  const [credSearchQ, setCredSearchQ] = useState('');
  const [credRole, setCredRole] = useState('');
  const [credListLoading, setCredListLoading] = useState(false);

  const roleFilterOptions = useMemo<SmartSelectOption[]>(
    () => [
      { value: '', label: 'Todos los roles' },
      { value: 'ALUMNO', label: 'Alumnos' },
      { value: 'DOCENTE', label: 'Docentes' },
      { value: 'ADMINISTRATIVO', label: 'Administrativos' },
      { value: 'PADRE', label: 'Padres / familia' }
    ],
    []
  );

  const loadAssignableUsers = useCallback(async (query: string, signal: AbortSignal) => {
    const { data } = await api.get<
      Array<{
        userId: string;
        fullName: string;
        email: string | null;
        role: string;
        matricula: string | null;
      }>
    >('/api/v1/access-events/credentials/assignable-users', {
      params: { q: query.trim(), limit: 40 },
      signal
    });
    return data.map(
      (u): SmartSelectOption => ({
        value: u.userId,
        label: [u.fullName || u.email || u.userId, u.matricula ? `Mat. ${u.matricula}` : null].filter(Boolean).join(' · '),
        searchText: `${u.email ?? ''} ${u.role} ${u.matricula ?? ''}`
      })
    );
  }, []);

  const loadCredentials = useCallback(async () => {
    if (!isAdmin) return;
    setCredListLoading(true);
    try {
      const { data } = await api.get<{ data: NfcCredential[]; meta: CredListMeta }>(
        '/api/v1/access-events/credentials',
        {
          params: {
            type: 'NFC',
            q: credSearchQ.trim() || undefined,
            role: credRole.trim() || undefined,
            limit: 200,
            page: 1
          }
        }
      );
      setNfcCredentials(
        data.data.filter((c) => c.credentialType === 'NFC')
      );
      setCredMeta(data.meta);
    } catch {
      /* silencioso */
    } finally {
      setCredListLoading(false);
    }
  }, [isAdmin, credSearchQ, credRole]);

  useEffect(() => {
    if (!showCredPanel || !isAdmin) return;
    const delay = credSearchQ === '' && credRole === '' ? 0 : 280;
    const t = window.setTimeout(() => {
      void loadCredentials();
    }, delay);
    return () => window.clearTimeout(t);
  }, [showCredPanel, isAdmin, credSearchQ, credRole, loadCredentials]);

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

  const stopAssignNfcRead = useCallback(() => {
    if (assignNfcAbortRef.current) {
      assignNfcAbortRef.current.abort();
      assignNfcAbortRef.current = null;
    }
    setAssignNfcReading(false);
  }, []);

  useEffect(() => {
    return () => {
      void stopCamera();
      stopNfc();
      stopAssignNfcRead();
    };
  }, [stopCamera, stopNfc, stopAssignNfcRead]);

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
    const normalized = normalizeNfcUidInput(credentialValue);
    if (!normalized) {
      setNfcErr('No se pudo leer el UID del chip NFC.');
      setNfcInfo(null);
      return;
    }
    setNfcErr(null);
    setNfcInfo(`UID detectado: ${normalized}`);
    try {
      const { data } = await api.post<ScanResponse>('/api/v1/access-events/scan', {
        method: 'NFC',
        credentialValue: normalized,
        eventType
      });
      stopNfc();
      setResult(data);
    } catch (e) {
      setNfcErr(getUserFacingMessage(e));
      setNfcInfo(`UID detectado: ${normalized}`);
    }
  }

  async function handleManualUidScan() {
    const normalized = normalizeNfcUidInput(manualUid);
    if (!normalized) {
      setManualErr('Ingrese el UID de la tarjeta o el valor leído.');
      return;
    }
    setManualErr(null);
    setManualBusy(true);
    setResult(null);
    try {
      const { data } = await api.post<ScanResponse>('/api/v1/access-events/scan', {
        method: 'MANUAL',
        credentialValue: normalized,
        eventType
      });
      setResult(data);
      setManualUid('');
    } catch (e) {
      setManualErr(getUserFacingMessage(e));
    } finally {
      setManualBusy(false);
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

  async function startAssignNfcRead() {
    setCredErr(null);
    if (!nfcIsSupported()) {
      setCredErr(
        'NFC no está disponible en este navegador. Use Chrome en Android con NFC activado o pegue el UID manualmente.'
      );
      return;
    }
    stopAssignNfcRead();
    stopNfc();
    const controller = new AbortController();
    assignNfcAbortRef.current = controller;
    setAssignNfcReading(true);
    try {
      const ndef = new window.NDEFReader!();
      await ndef.scan({ signal: controller.signal });
      ndef.onreading = (event: NDEFReadingEvent) => {
        const uid = extractNfcCredentialValue(event);
        if (!uid) {
          setCredErr('No se pudo leer el UID del chip NFC.');
          return;
        }
        setAssignNfcUid(uid);
        setCredMsg(`UID leído del chip: ${uid}`);
        stopAssignNfcRead();
      };
      ndef.onerror = () => {
        setCredErr('Error al leer la tarjeta NFC. Acerque la tarjeta de nuevo.');
      };
    } catch (e) {
      assignNfcAbortRef.current = null;
      setAssignNfcReading(false);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('Permission')) {
        setCredErr('Permiso NFC denegado. Habilite el permiso de NFC para este sitio en el navegador.');
      } else if (!msg.includes('abort')) {
        setCredErr(`No se pudo iniciar el lector NFC: ${msg}`);
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in space-y-8">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow-sm dark:border-slate-700 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Control de acceso</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Escáner de acceso</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
          Use la cámara para el código QR, el campo de UID para cualquier navegador (incluye lectores USB en modo
          teclado), o Web NFC en Chrome para Android si el dispositivo lo permite.
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
        title="UID NFC (todos los navegadores)"
        description="Escriba o pegue el UID hexadecimal de la tarjeta (el mismo que figura en la gestión de credenciales). Los lectores NFC USB en modo teclado pueden enfocar este campo: al terminar de &ldquo;escribir&rdquo; el UID, pulse Intro o use el botón."
      >
        {manualErr && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {manualErr}
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor="manual-nfc-uid">
              UID / valor NFC
            </label>
            <input
              id="manual-nfc-uid"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={manualUid}
              onChange={(e) => setManualUid(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleManualUidScan();
                }
              }}
              placeholder="Ej. A1B2C3D4 o A1:B2:C3:D4"
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <button
            type="button"
            disabled={manualBusy}
            onClick={() => void handleManualUidScan()}
            className="shrink-0 rounded-xl bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 disabled:opacity-50"
          >
            {manualBusy ? 'Registrando…' : 'Registrar acceso'}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          En móviles sin Web NFC puede dictar o transcribir el UID; en escritorio suele usarse un lector NFC USB que
          emula teclado.
        </p>
      </Panel>

      <Panel
        title="Lectura con tarjeta NFC"
        description={
          nfcIsSupported()
            ? 'Acerque la tarjeta NFC al lector del dispositivo Android. La tarjeta debe estar registrada en el sistema.'
            : 'Lectura por chip integrada (Web NFC): solo en Chrome para Android con NFC activado. Use el bloque «UID NFC» arriba en otros navegadores o con lector USB.'
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
            El UID manual (bloque anterior) cubre Firefox, Safari, escritorio y lectores USB. Web NFC en esta sección
            requiere Chrome en Android con NFC habilitado.
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

      {isAdmin && (
        <details
          open={showCredPanel}
          onToggle={(e) => setShowCredPanel((e.currentTarget as HTMLDetailsElement).open)}
          className="group rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold text-slate-800 outline-none marker:content-none dark:text-slate-100 [&::-webkit-details-marker]:hidden">
            <span>Gestión de credenciales NFC</span>
            <span className="text-xs font-normal text-slate-500 group-open:rotate-180 dark:text-slate-400" aria-hidden>▼</span>
          </summary>
          <div className="space-y-6 border-t border-slate-200 px-5 py-5 dark:border-slate-700">
            <p className="rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-xs leading-relaxed text-slate-600 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
              Los <strong>alumnos nuevos</strong> reciben automáticamente un valor NFC interno (32 caracteres hex) al darse
              de alta, igual que el QR. Use <strong>«Vincular chip físico»</strong> para sustituir ese valor por el UID de
              la tarjeta / llavero real; el acceso por lector seguirá validando contra el valor activo.
            </p>

            {/* Vincular UID de tarjeta física */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-4 shadow-sm dark:border-slate-600 dark:from-slate-900 dark:to-slate-900/80">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Vincular chip físico (UID de tarjeta)</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Busque a la persona y pegue o escanee el UID hexadecimal del dispositivo NFC.
              </p>
              {credErr && (
                <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                  {credErr}
                </p>
              )}
              {credMsg && (
                <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
                  {credMsg}
                </p>
              )}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Usuario</label>
                  <div className="mt-1">
                    <SmartSelect
                      loadOptions={loadAssignableUsers}
                      value={assignUserId}
                      onChange={setAssignUserId}
                      placeholder="Buscar nombre, correo o matrícula…"
                      emptyLabel="Escriba para buscar usuarios"
                      noResultsLabel="Sin coincidencias en su institución"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">UID NFC (hex, del chip)</label>
                  <input
                    type="text"
                    placeholder="Ej. A1B2C3D4E5F6…"
                    value={assignNfcUid}
                    onChange={(e) => setAssignNfcUid(e.target.value.toUpperCase())}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 font-mono text-sm shadow-inner dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  {nfcIsSupported() && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {!assignNfcReading ? (
                        <button
                          type="button"
                          disabled={credBusy}
                          onClick={() => void startAssignNfcRead()}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                        >
                          Leer chip NFC
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopAssignNfcRead}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                        >
                          Cancelar lectura
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                disabled={credBusy || !assignUserId.trim() || !assignNfcUid.trim()}
                onClick={async () => {
                  const normalizedUid = normalizeNfcUidInput(assignNfcUid);
                  if (!normalizedUid) {
                    setCredErr('Ingrese un UID NFC válido.');
                    return;
                  }
                  setCredErr(null);
                  setCredMsg(null);
                  setCredBusy(true);
                  try {
                    await api.post('/api/v1/access-events/credentials/nfc', {
                      targetUserId: assignUserId.trim(),
                      nfcUid: normalizedUid
                    });
                    setCredMsg('Credencial NFC vinculada correctamente.');
                    setAssignUserId('');
                    setAssignNfcUid('');
                    await loadCredentials();
                  } catch (e) {
                    setCredErr(getUserFacingMessage(e));
                  } finally {
                    setCredBusy(false);
                  }
                }}
                className="mt-4 rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 disabled:opacity-50"
              >
                {credBusy ? 'Guardando…' : 'Vincular UID al usuario'}
              </button>
            </div>

            {/* Tabla con filtros */}
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Credenciales NFC activas</h3>
                <button
                  type="button"
                  onClick={() => void loadCredentials()}
                  className="self-start rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-brand-300 dark:hover:bg-slate-700"
                >
                  Actualizar listado
                </button>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Filtrar</label>
                  <input
                    type="search"
                    value={credSearchQ}
                    onChange={(e) => setCredSearchQ(e.target.value)}
                    placeholder="Nombre, correo, matrícula o UID…"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="w-full lg:w-56">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Rol</label>
                  <div className="mt-1">
                    <SmartSelect options={roleFilterOptions} value={credRole} onChange={setCredRole} placeholder="Rol" />
                  </div>
                </div>
              </div>
              {credMeta ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {credListLoading
                    ? 'Cargando…'
                    : `${credMeta.total} registro${credMeta.total !== 1 ? 's' : ''} · mostrando hasta ${credMeta.limit} por consulta`}
                </p>
              ) : null}
              {nfcCredentials.length === 0 && !credListLoading ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
                  No hay credenciales NFC con los filtros actuales.
                </p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-700">
                  <div className="max-h-[min(56vh,540px)] overflow-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-100/95 backdrop-blur dark:border-slate-600 dark:bg-slate-800/95">
                        <tr>
                          <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Usuario</th>
                          <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Rol</th>
                          <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Matrícula</th>
                          <th className="min-w-[8rem] px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Valor NFC</th>
                          <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Alta</th>
                          <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-200"> </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/80">
                        {nfcCredentials.map((cred) => (
                          <tr
                            key={cred.id}
                            className="bg-white transition hover:bg-slate-50/90 dark:bg-slate-900/40 dark:hover:bg-slate-800/50"
                          >
                            <td className="max-w-[200px] px-4 py-2.5 text-slate-800 dark:text-slate-100">
                              <span className="block truncate font-medium">
                                {cred.userFullName ?? cred.userEmail ?? '—'}
                              </span>
                              {cred.userEmail && cred.userFullName ? (
                                <span className="mt-0.5 block truncate text-[11px] text-slate-500 dark:text-slate-400">{cred.userEmail}</span>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-slate-600 dark:text-slate-300">
                              {cred.userRole ? ROLE_LABEL[cred.userRole] ?? cred.userRole : '—'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 font-mono text-slate-600 dark:text-slate-300">
                              {cred.matricula?.trim() || '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              <code className="break-all rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                                {cred.credentialValue}
                              </code>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-slate-500 dark:text-slate-400">
                              {new Date(cred.createdAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5">
                              <button
                                type="button"
                                disabled={credBusy}
                                onClick={async () => {
                                  setCredErr(null);
                                  setCredMsg(null);
                                  setCredBusy(true);
                                  try {
                                    await api.delete(`/api/v1/access-events/credentials/${cred.id}`);
                                    setCredMsg('Credencial revocada.');
                                    await loadCredentials();
                                  } catch (e) {
                                    setCredErr(getUserFacingMessage(e));
                                  } finally {
                                    setCredBusy(false);
                                  }
                                }}
                                className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-950/80"
                              >
                                Revocar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

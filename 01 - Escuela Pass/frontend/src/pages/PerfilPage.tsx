import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { publicAssetUrl } from '@/lib/asset-url';
import { useAuth } from '@/context/useAuth';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  ADMINISTRATIVO: 'Administrativo',
  DOCENTE: 'Docente',
  PADRE: 'Familia / acudiente',
  ALUMNO: 'Estudiante'
};

export function PerfilPage() {
  const { user } = useAuth();
  type MePayload = {
    fullName: string;
    email: string;
    role: string;
    canAccessCampus: boolean;
    phone: string | null;
    avatarUrl?: string | null;
    schoolLogoUrl?: string | null;
    contactSections?: Array<{
      title: string;
      items: Array<{ fullName: string; phone: string | null; subtitle?: string }>;
    }>;
  };

  const [me, setMe] = useState<MePayload | null>(null);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        const [p, q] = await Promise.all([
          api.get<MePayload>('/api/v1/auth/me'),
          api.get<{ qrValue: string }>('/api/v1/access-events/my-qr')
        ]);
        if (!cancelled) {
          setMe(p.data);
          setQrValue(q.data.qrValue);
        }
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const initials = useMemo(() => {
    const n = (me?.fullName ?? user?.fullName ?? '?').trim();
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }, [me?.fullName, user?.fullName]);

  const avatarSrc = publicAssetUrl(me?.avatarUrl ?? user?.avatarUrl ?? null);

  return (
    <div className="max-w-lg animate-fade-in">
      <h1 className="font-serif text-2xl font-semibold text-slate-900">Mi perfil</h1>
      <p className="mt-1 text-sm text-slate-600">
        Sus datos personales y, si tiene autorizado el acceso, su código QR para entrar al plantel.
      </p>

      {err && (
        <div className="mt-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}

      <div className="mt-8 flex flex-col items-center rounded border border-slate-200 bg-white p-8 shadow-sm sm:flex-row sm:items-start sm:gap-8">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-slate-900" aria-hidden>
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-white">
              {initials}
            </div>
          )}
        </div>
        <dl className="mt-6 w-full text-center sm:mt-0 sm:text-left">
          <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nombre</dt>
          <dd className="text-lg font-medium text-slate-900">{me?.fullName ?? user?.fullName}</dd>
          <dt className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Correo</dt>
          <dd className="text-slate-800">{me?.email ?? user?.email}</dd>
          <dt className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Perfil</dt>
          <dd className="text-slate-800">{ROLE_LABEL[me?.role ?? user?.role ?? ''] ?? me?.role ?? user?.role}</dd>
          <dt className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Celular</dt>
          <dd className="text-slate-800">{me?.phone?.trim() ? me.phone : '—'}</dd>
          <dt className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Acceso al campus</dt>
          <dd className="text-slate-800">{me?.canAccessCampus ? 'Autorizado' : 'No autorizado o pendiente'}</dd>
        </dl>
      </div>

      {me?.contactSections?.length ? (
        <div className="mt-8 space-y-6">
          {me.contactSections.map((section) => (
            <div key={section.title} className="rounded border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-serif text-lg font-semibold text-slate-900">{section.title}</h2>
              <ul className="mt-4 divide-y divide-slate-100">
                {section.items.map((item, idx) => (
                  <li key={`${item.fullName}-${idx}`} className="py-3 first:pt-0 last:pb-0">
                    <p className="font-medium text-slate-900">{item.fullName}</p>
                    {item.subtitle ? (
                      <p className="mt-0.5 text-xs text-slate-500">{item.subtitle}</p>
                    ) : null}
                    <p className="mt-1 text-sm text-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Celular{' '}
                      </span>
                      {item.phone?.trim() ? (
                        <a href={`tel:${item.phone.replace(/\s/g, '')}`} className="text-slate-900 underline">
                          {item.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {qrValue && (
        <div className="mt-10 rounded border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-lg font-semibold text-slate-900">Mi código QR</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Muestre este código al personal del plantel para registrar su ingreso o salida. Si la pantalla es pequeña,
            ábralo en pantalla completa para que se lea mejor.
          </p>
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="rounded border border-slate-100 bg-white p-4">
              <QRCodeSVG value={qrValue} size={200} level="M" includeMargin />
            </div>
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="rounded border border-slate-900 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Pantalla completa
            </button>
          </div>
        </div>
      )}

      {fullscreen && qrValue && (
        <button
          type="button"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/95 p-6 text-white"
          onClick={() => setFullscreen(false)}
        >
          <span className="mb-6 text-sm font-medium">Toque en cualquier lugar para cerrar</span>
          <div className="rounded bg-white p-6">
            <QRCodeSVG
              value={qrValue}
              size={Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 48 : 280)}
              level="M"
              includeMargin
            />
          </div>
        </button>
      )}
    </div>
  );
}

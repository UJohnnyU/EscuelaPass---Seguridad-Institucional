import axios from 'axios';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import { QRCodeSVG } from 'qrcode.react';
import { AuthImage } from '@/components/AuthImage';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { useAuth } from '@/context/useAuth';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  ADMINISTRATIVO: 'Administrativo',
  DOCENTE: 'Docente',
  PADRE: 'Familia / acudiente',
  ALUMNO: 'Estudiante'
};

type ContactItem = { fullName: string; phone: string | null; subtitle?: string };

const CONTACT_VIRTUAL_THRESHOLD = 20;
const CONTACT_ROW_HEIGHT = 128;

function ContactArticleCard({ item }: { item: ContactItem }) {
  const initials = (() => {
    const n = (item.fullName || '?').trim();
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  })();
  const cleanPhone = item.phone?.replace(/\s/g, '');
  return (
    <article className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white"
        aria-hidden
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{item.fullName}</p>
        {item.subtitle ? <p className="mt-0.5 truncate text-xs text-slate-500">{item.subtitle}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {cleanPhone ? (
            <a
              href={`tel:${cleanPhone}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-800 transition hover:border-slate-300 hover:bg-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
                aria-hidden
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
              </svg>
              {item.phone}
            </a>
          ) : (
            <span className="text-xs text-slate-400">Sin celular registrado</span>
          )}
        </div>
      </div>
    </article>
  );
}

function VirtualContactRow({
  index,
  style,
  data
}: ListChildComponentProps<{ items: ContactItem[] }>) {
  const item = data.items[index];
  if (!item) return null;
  return (
    <div style={style} className="box-border px-0 pr-1">
      <ContactArticleCard item={item} />
    </div>
  );
}

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
  const [contactFilters, setContactFilters] = useState<Record<string, string>>({});
  const [contactExpanded, setContactExpanded] = useState<Record<string, boolean>>({});
  const CONTACT_PAGE_SIZE = 12;
  const [policyText, setPolicyText] = useState<string | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [autonomousToday, setAutonomousToday] = useState<boolean | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(800);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setContentWidth(el.clientWidth));
    ro.observe(el);
    setContentWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

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
      try {
        const pol = await api.get<{ content?: string; version?: string }>('/api/v1/privacy/policy/latest');
        if (!cancelled) {
          const content = typeof pol.data?.content === 'string' ? pol.data.content : null;
          setPolicyText(content);
        }
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          if (!cancelled) setPolicyText(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const role = me?.role ?? user?.role;
    if (role !== 'ALUMNO') {
      setAutonomousToday(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ autonomousToday: boolean }>(
          '/api/v1/departure-consent/student/me/today'
        );
        if (!cancelled) setAutonomousToday(!!data.autonomousToday);
      } catch {
        if (!cancelled) setAutonomousToday(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me?.role, user?.role]);

  const initials = useMemo(() => {
    const n = (me?.fullName ?? user?.fullName ?? '?').trim();
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }, [me?.fullName, user?.fullName]);

  return (
    <div ref={rootRef} className="mx-auto max-w-6xl animate-fade-in">
      <h1 className="font-serif text-2xl font-semibold text-slate-900">Mi perfil</h1>
      <p className="mt-1 text-sm text-slate-600">
        Sus datos personales y, si tiene autorizado el acceso, su código QR para entrar al plantel.
      </p>

      {err && (
        <div className="mt-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}

      {(me?.role ?? user?.role) === 'ALUMNO' && autonomousToday === true ? (
        <div className="mt-6 max-w-xl rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <strong className="font-semibold">Salida autónoma autorizada.</strong>{' '}
          Su familia registró salida autónoma activa; no requiere solicitud de circuito de recogida hasta que la
          desactiven.
        </div>
      ) : null}

      <div className="mx-auto mt-8 flex max-w-xl flex-col items-center rounded-xl border border-slate-200 bg-white p-8 shadow-sm sm:flex-row sm:items-start sm:gap-8">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-slate-900" aria-hidden>
          {me?.avatarUrl ?? user?.avatarUrl ? (
            <AuthImage
              src={me?.avatarUrl ?? user?.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
              fallback={
                <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-white">
                  {initials}
                </div>
              }
            />
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

      {qrValue && (
        <div className="mx-auto mt-10 max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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

      {me?.contactSections?.length
        ? me.contactSections.map((section) => {
            const filter = (contactFilters[section.title] ?? '').trim().toLowerCase();
            const filteredItems = filter
              ? section.items.filter((it) =>
                  [it.fullName, it.subtitle, it.phone]
                    .filter(Boolean)
                    .some((v) => String(v).toLowerCase().includes(filter))
                )
              : section.items;
            const showSearch = section.items.length > 6;
            const expanded = !!contactExpanded[section.title];
            const shouldPaginate = !filter && filteredItems.length > CONTACT_PAGE_SIZE && !expanded;
            const visibleItems = shouldPaginate ? filteredItems.slice(0, CONTACT_PAGE_SIZE) : filteredItems;
            const useVirtualList = visibleItems.length > CONTACT_VIRTUAL_THRESHOLD;
            const listHeight = Math.min(560, visibleItems.length * CONTACT_ROW_HEIGHT);
            const listColumnWidth = Math.min(Math.max(320, contentWidth), 42 * 16);
            return (
            <section key={section.title} className="mt-10">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h2 className="font-serif text-lg font-semibold text-slate-900">{section.title}</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {section.items.length} {section.items.length === 1 ? 'persona' : 'personas'}
                </span>
                {showSearch ? (
                  <input
                    type="search"
                    value={contactFilters[section.title] ?? ''}
                    onChange={(e) =>
                      setContactFilters((prev) => ({ ...prev, [section.title]: e.target.value }))
                    }
                    placeholder="Buscar por nombre, grupo o materia"
                    className="ml-auto w-full max-w-xs rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                ) : null}
              </div>
              {filteredItems.length === 0 ? (
                <p className="text-sm text-slate-500">Ningún contacto coincide con esa búsqueda.</p>
              ) : useVirtualList ? (
                <div className="flex w-full justify-center">
                  <FixedSizeList
                    height={listHeight}
                    width={listColumnWidth}
                    itemCount={visibleItems.length}
                    itemSize={CONTACT_ROW_HEIGHT}
                    itemData={{ items: visibleItems }}
                    overscanCount={4}
                  >
                    {VirtualContactRow}
                  </FixedSizeList>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-4">
                  {visibleItems.map((item) => (
                    <div
                      key={`${item.fullName}|${item.subtitle ?? ''}|${item.phone ?? ''}`}
                      className="w-full shrink-0 sm:w-72 md:w-80"
                    >
                      <ContactArticleCard item={item} />
                    </div>
                  ))}
                </div>
              )}
              {shouldPaginate ? (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setContactExpanded((prev) => ({ ...prev, [section.title]: true }))
                    }
                    className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-500 hover:text-slate-900"
                  >
                    Ver todos ({filteredItems.length})
                  </button>
                </div>
              ) : null}
              {expanded && filteredItems.length > CONTACT_PAGE_SIZE ? (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setContactExpanded((prev) => ({ ...prev, [section.title]: false }))
                    }
                    className="text-xs font-medium text-slate-500 hover:text-slate-800"
                  >
                    Mostrar menos
                  </button>
                </div>
              ) : null}
            </section>
          );
          })
        : null}

      <section className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <details open={policyOpen} onToggle={(e) => setPolicyOpen((e.currentTarget as HTMLDetailsElement).open)}>
          <summary className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-800">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500 shadow-sm">
              Privacidad
            </span>
            Política de privacidad institucional
          </summary>
          <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {policyText
              ? policyText
              : 'La institución aún no ha publicado el texto vigente de la política de privacidad. Consulte a secretaría si necesita una copia.'}
          </div>
        </details>
      </section>

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

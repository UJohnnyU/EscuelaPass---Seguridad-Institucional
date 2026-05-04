import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { SmartSelect } from '@/components/SmartSelect';
import { InstitutionMap } from '@/components/InstitutionMap';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { publicAssetUrl } from '@/lib/asset-url';
import { uploadSchoolLogo } from '@/lib/uploads-api';
import { useAuth } from '@/context/useAuth';
import { isPlatformAdmin } from '@/lib/roles';

type Profile = {
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  directorName?: string;
  motto?: string;
  studentMatriculaPrefix?: string;
  maxGradeScale?: string;
  logoUrl?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  shiftWindows?: {
    matutino: { start: string | null; end: string | null };
    vespertino: { start: string | null; end: string | null };
    nocturno: { start: string | null; end: string | null };
  } | null;
};

type SchoolRow = { id: string; name: string; code: string };

export function InstitutionPage() {
  const { user } = useAuth();
  const platformAdmin = isPlatformAdmin(user);
  const canEdit = user?.role === 'ADMIN' || user?.role === 'ADMINISTRATIVO';
  const canEditLocationAndLogo = user?.role === 'ADMIN';
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [schoolsReady, setSchoolsReady] = useState(!platformAdmin);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Profile>({ name: '' });
  const [isEditing, setIsEditing] = useState(false);
  /** Evita depender solo de JSON.stringify(profile); el objeto de la API y form podían compartir referencia o diverger en decimales. */
  const [formDirty, setFormDirty] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const schoolEditOptions = useMemo(
    () => schools.map((s) => ({ value: s.id, label: `${s.name} (${s.code})`, searchText: s.code })),
    [schools]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!platformAdmin) {
        setSchoolsReady(true);
        return;
      }
      try {
        const { data } = await api.get<SchoolRow[]>('/api/v1/schools');
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setSchools(list);
        setSelectedSchoolId(list[0]?.id ?? '');
      } catch {
        if (!cancelled) setSchools([]);
      } finally {
        if (!cancelled) setSchoolsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformAdmin]);

  useEffect(() => {
    if (!schoolsReady) return;
    if (platformAdmin && !selectedSchoolId) {
      setLoading(false);
      setProfile(null);
      setForm({ name: '' });
      setFormDirty(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params =
          platformAdmin && selectedSchoolId ? { schoolId: selectedSchoolId } : undefined;
        const { data } = await api.get<Profile>('/api/v1/settings/institution', { params });
        if (!cancelled) {
          setProfile(data);
          setForm({ ...data });
          setIsEditing(false);
          setFormDirty(false);
        }
      } catch (e) {
        if (!cancelled) setError(getUserFacingMessage(e, 'No se pudo cargar el perfil institucional.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformAdmin, selectedSchoolId, schoolsReady]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !isEditing || !formDirty) return;
    if (platformAdmin && !selectedSchoolId) {
      setError('Seleccione una escuela para guardar.');
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      // Horarios de jornada solo vía admin de plataforma; no se envían desde esta pantalla.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omitido del payload
      const { shiftWindows, ...formRest } = form;
      const payload: Omit<Profile, 'maxGradeScale' | 'latitude' | 'longitude' | 'shiftWindows'> & {
        maxGradeScale?: number;
        latitude?: number;
        longitude?: number;
      } = {
        ...formRest,
        maxGradeScale: undefined,
        latitude: undefined,
        longitude: undefined
      };
      if (form.maxGradeScale !== undefined) {
        const n = Number(String(form.maxGradeScale).replace(',', '.'));
        if (!Number.isFinite(n) || n < 1 || n > 999.99) {
          setError('El puntaje máximo debe estar entre 1 y 999.99.');
          setSaving(false);
          return;
        }
        if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-9) {
          setError('El puntaje máximo permite hasta 2 decimales.');
          setSaving(false);
          return;
        }
        payload.maxGradeScale = Math.round(n * 100) / 100;
      }
      if (canEditLocationAndLogo) {
        if (form.latitude !== undefined && String(form.latitude).trim() !== '') {
          const lat = Number(String(form.latitude).replace(',', '.'));
          if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
            setError('La latitud debe estar entre -90 y 90.');
            setSaving(false);
            return;
          }
          (payload as Record<string, unknown>).latitude = lat;
        }
        if (form.longitude !== undefined && String(form.longitude).trim() !== '') {
          const lng = Number(String(form.longitude).replace(',', '.'));
          if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
            setError('La longitud debe estar entre -180 y 180.');
            setSaving(false);
            return;
          }
          (payload as Record<string, unknown>).longitude = lng;
        }
      }
      const params =
        user?.role === 'ADMIN' && selectedSchoolId ? { schoolId: selectedSchoolId } : undefined;
      const { data } = await api.patch<Profile>('/api/v1/settings/institution', payload, { params });
      setProfile(data);
      setForm({ ...data });
      setIsEditing(false);
      setFormDirty(false);
      setMessage('Cambios guardados correctamente.');
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudieron guardar los cambios.'));
    } finally {
      setSaving(false);
    }
  }

  async function onLogoPick(file: File) {
    if (!canEditLocationAndLogo || !isEditing || !selectedSchoolId) return;
    setUploadingLogo(true);
    setError(null);
    setMessage(null);
    try {
      const res = await uploadSchoolLogo(selectedSchoolId, file);
      setProfile((p) => (p ? { ...p, logoUrl: res.logoUrl } : p));
      setForm((f) => ({ ...f, logoUrl: res.logoUrl }));
      setMessage('Logo actualizado correctamente.');
    } catch (e) {
      setError(getUserFacingMessage(e, 'No se pudo actualizar el logo.'));
    } finally {
      setUploadingLogo(false);
    }
  }

  if (!schoolsReady || loading) {
    return <p className="text-slate-600">Cargando datos de la institución…</p>;
  }

  if (error && !profile && !platformAdmin) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-red-800 ring-1 ring-red-200" role="alert">
        {error}
      </div>
    );
  }

  if (platformAdmin && schools.length === 0) {
    return (
      <div className="max-w-xl animate-slide-up">
        <h1 className="text-2xl font-bold text-slate-900">Institución</h1>
        <p className="mt-4 text-sm text-slate-600">
          Aún no hay escuelas registradas. Agréguelas desde <strong>Escuelas</strong> en el menú y luego podrá
          completar sus datos aquí.
        </p>
      </div>
    );
  }

  const logoSrc = profile?.logoUrl ? publicAssetUrl(profile.logoUrl) : null;

  return (
    <div className="mx-auto max-w-5xl animate-slide-up">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 backdrop-blur">
            {logoSrc ? (
              <img src={logoSrc} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="font-serif text-3xl font-semibold text-white/80">
                {(profile?.name ?? 'E').slice(0, 1)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Institución</p>
            <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
              {profile?.name ?? 'Sin nombre registrado'}
            </h1>
            {profile?.motto ? (
              <p className="mt-2 text-sm italic text-white/80">"{profile.motto}"</p>
            ) : (
              <p className="mt-2 text-sm text-white/70">
                Datos visibles para la comunidad: nombre, contacto y mensaje institucional.
              </p>
            )}
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-[11px] text-white/80 sm:justify-start">
              {profile?.city ? <span className="rounded-full bg-white/10 px-3 py-1">{profile.city}</span> : null}
              {profile?.phone ? <span className="rounded-full bg-white/10 px-3 py-1">Tel. {profile.phone}</span> : null}
              {profile?.email ? <span className="rounded-full bg-white/10 px-3 py-1">{profile.email}</span> : null}
            </div>
          </div>
        </div>
      </header>

      {platformAdmin && schools.length > 0 && (
        <div className="mt-6">
          <span className="block text-sm font-medium text-slate-700">Escuela a editar</span>
          <div className="mt-1 max-w-md">
            <SmartSelect
              options={schoolEditOptions}
              value={selectedSchoolId}
              onChange={setSelectedSchoolId}
              placeholder="— Elegir escuela —"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Elija la escuela cuyos datos quiere actualizar antes de guardar.
          </p>
        </div>
      )}

      {error && profile && (
        <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200" role="alert">
          {error}
        </div>
      )}


      {canEdit && profile ? (
        <form className="mt-8 space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm" onSubmit={onSave}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Datos institucionales</h2>
              <p className="text-xs text-slate-500">
                {isEditing
                  ? 'Modo edición activo. Revise los cambios antes de guardar.'
                  : 'Vista protegida. Presione "Editar datos" para habilitar cambios.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!profile) return;
                    setForm({ ...profile });
                    setIsEditing(true);
                    setFormDirty(false);
                    setMessage(null);
                    setError(null);
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Editar datos
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!profile) return;
                    setForm({ ...profile });
                    setIsEditing(false);
                    setFormDirty(false);
                    setMessage('Edición cancelada. Se conservaron los datos actuales.');
                    setError(null);
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
          {(
            [
              ['name', 'Nombre de la escuela', 'text'],
              ['address', 'Dirección', 'text'],
              ['city', 'Ciudad', 'text'],
              ['phone', 'Teléfono', 'text'],
              ['email', 'Correo de contacto', 'email'],
              ['directorName', 'Director/a', 'text'],
              ['motto', 'Lema o mensaje', 'text'],
              ['studentMatriculaPrefix', 'Prefijo de matrícula de alumnos', 'text']
            ] as const
          ).map(([key, label, type]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700" htmlFor={key}>
                {label}
              </label>
              <input
                id={key}
                type={type}
                value={(form[key] as string | undefined) ?? ''}
                onChange={(e) => {
                  setFormDirty(true);
                  setForm((f) => ({ ...f, [key]: e.target.value }));
                }}
                disabled={!isEditing}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 outline-none ring-brand-500/30 focus:ring-2"
              />
              {key === 'studentMatriculaPrefix' ? (
                <p className="mt-1 text-xs text-slate-500">
                  Solo letras y números. Se generan matrículas como{' '}
                  <strong>{(form.studentMatriculaPrefix || 'ABC').toUpperCase()}-0001</strong>. Si se deja vacío, se usa
                  el código de la escuela.
                </p>
              ) : null}
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="maxGradeScale">
              Puntaje máximo para calificaciones
            </label>
            <input
              id="maxGradeScale"
              type="text"
              inputMode="decimal"
              value={form.maxGradeScale ?? '100.00'}
              onChange={(e) => {
                setFormDirty(true);
                setForm((f) => ({ ...f, maxGradeScale: e.target.value }));
              }}
              disabled={!isEditing}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 outline-none ring-brand-500/30 focus:ring-2"
              placeholder="100.00"
            />
            <p className="mt-1 text-xs text-slate-500">
              Por ejemplo, escriba <strong>10</strong> si las notas se otorgan sobre 10, o <strong>100</strong> si se
              califica sobre 100.
            </p>
          </div>
          {canEditLocationAndLogo && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ubicación institucional</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Coordenadas utilizadas en mapa y documentos oficiales.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="text-slate-700 dark:text-slate-300">Latitud</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.latitude ?? ''}
                      disabled={!isEditing}
                      onChange={(e) => {
                        setFormDirty(true);
                        setForm((f) => ({ ...f, latitude: e.target.value }));
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-slate-900 outline-none ring-brand-500/30 focus:ring-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      placeholder="18.48610000"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-slate-700 dark:text-slate-300">Longitud</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.longitude ?? ''}
                      disabled={!isEditing}
                      onChange={(e) => {
                        setFormDirty(true);
                        setForm((f) => ({ ...f, longitude: e.target.value }));
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-slate-900 outline-none ring-brand-500/30 focus:ring-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      placeholder="-69.93120000"
                    />
                  </label>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Logo institucional</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Imagen oficial para portada, informes y documentos.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label
                    className={`rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                      isEditing && !uploadingLogo && selectedSchoolId
                        ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'
                        : 'cursor-not-allowed opacity-60'
                    }`}
                  >
                    {uploadingLogo ? 'Subiendo logo…' : 'Subir nuevo logo'}
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploadingLogo || !selectedSchoolId || !isEditing}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) void onLogoPick(f);
                      }}
                    />
                  </label>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Formatos: JPG, PNG o WEBP.</span>
                </div>
              </div>
            </>
          )}
          {error && !profile && (
            <div className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-900" role="status">
              {message}
            </div>
          )}
          <button
            type="submit"
            disabled={saving || !isEditing || !formDirty || (platformAdmin && !selectedSchoolId)}
            className="rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      ) : canEdit && !profile ? (
        <p className="mt-8 text-sm text-amber-800">No se pudo cargar el perfil. {error}</p>
      ) : (
        <dl className="mt-8 space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Nombre</dt>
            <dd className="text-slate-900">{profile?.name}</dd>
          </div>
          {profile?.motto && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Lema</dt>
              <dd className="text-slate-900">{profile.motto}</dd>
            </div>
          )}
          {profile?.address && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Dirección</dt>
              <dd className="text-slate-900">{profile.address}</dd>
            </div>
          )}
          {profile?.city && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Ciudad</dt>
              <dd className="text-slate-900">{profile.city}</dd>
            </div>
          )}
          {profile?.phone && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Teléfono</dt>
              <dd className="text-slate-900">{profile.phone}</dd>
            </div>
          )}
          {profile?.email && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Correo</dt>
              <dd className="text-slate-900">{profile.email}</dd>
            </div>
          )}
          {profile?.directorName && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Director/a</dt>
              <dd className="text-slate-900">{profile.directorName}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Prefijo de matrícula</dt>
            <dd className="text-slate-900">{(profile?.studentMatriculaPrefix || '').trim() || 'Automático por código escolar'}</dd>
          </div>
        </dl>
      )}

      {profile?.shiftWindows ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Horarios de jornada escolar</h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Referencia de inicio y fin de clases por turno. Se definen al crear la escuela; el personal administrativo no puede
            cambiarlos desde aquí (solo el administrador de plataforma, desde la sección Escuelas).
          </p>
          <ul className="mt-3 grid gap-2 text-sm text-slate-800 dark:text-slate-200 sm:grid-cols-3">
            <li className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mañana</span>
              <p className="font-medium">
                {profile.shiftWindows.matutino.start ?? '—'} – {profile.shiftWindows.matutino.end ?? '—'}
              </p>
            </li>
            <li className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tarde</span>
              <p className="font-medium">
                {profile.shiftWindows.vespertino.start ?? '—'} – {profile.shiftWindows.vespertino.end ?? '—'}
              </p>
            </li>
            <li className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Noche</span>
              <p className="font-medium">
                {profile.shiftWindows.nocturno.start ?? '—'} – {profile.shiftWindows.nocturno.end ?? '—'}
              </p>
            </li>
          </ul>
        </section>
      ) : null}

      {(() => {
        const lat = profile?.latitude != null ? Number(profile.latitude) : NaN;
        const lng = profile?.longitude != null ? Number(profile.longitude) : NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
        return (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Ubicación de la institución</h2>
                <p className="text-xs text-slate-500">
                  {profile?.address ? profile.address : 'Coordenadas registradas'}
                  {profile?.city ? `, ${profile.city}` : ''}
                </p>
              </div>
              <a
                href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                Ver en OpenStreetMap
              </a>
            </div>
            <InstitutionMap latitude={lat} longitude={lng} name={profile?.name} />
          </section>
        );
      })()}
    </div>
  );
}

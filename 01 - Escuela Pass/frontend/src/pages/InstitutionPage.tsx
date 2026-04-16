import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { SmartSelect } from '@/components/SmartSelect';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
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
  maxGradeScale?: string;
};

type SchoolRow = { id: string; name: string; code: string };

export function InstitutionPage() {
  const { user } = useAuth();
  const platformAdmin = isPlatformAdmin(user);
  const canEdit = user?.role === 'ADMIN' || user?.role === 'ADMINISTRATIVO';
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [schoolsReady, setSchoolsReady] = useState(!platformAdmin);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Profile>({ name: '' });
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
          setForm(data);
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
    if (!canEdit) return;
    if (platformAdmin && !selectedSchoolId) {
      setError('Seleccione una escuela para guardar.');
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload: Omit<Profile, 'maxGradeScale'> & { maxGradeScale?: number } = {
        ...form,
        maxGradeScale: undefined
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
      const params =
        user?.role === 'ADMIN' && selectedSchoolId ? { schoolId: selectedSchoolId } : undefined;
      const { data } = await api.patch<Profile>('/api/v1/settings/institution', payload, { params });
      setProfile(data);
      setForm(data);
      setMessage('Cambios guardados correctamente.');
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudieron guardar los cambios.'));
    } finally {
      setSaving(false);
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
          No hay escuelas registradas. Cree escuelas en <strong>Escuelas</strong> y luego podrá definir el perfil de
          cada una.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl animate-slide-up">
      <h1 className="text-2xl font-bold text-slate-900">Institución</h1>
      <p className="mt-1 text-slate-600">
        Estos datos corresponden a cada <strong>escuela</strong> (misma entidad que en &quot;Escuelas&quot;). El nombre
        legal o comercial y los datos de contacto se guardan aquí por institución.
      </p>

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
            Debe elegir la escuela antes de guardar. Si un campo está vacío en la base de datos de esa escuela, puede
            mostrarse el valor de respaldo global del sistema (configuración antigua).
          </p>
        </div>
      )}

      {error && profile && (
        <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200" role="alert">
          {error}
        </div>
      )}

      {canEdit && profile ? (
        <form className="mt-8 space-y-4" onSubmit={onSave}>
          {[
            ['name', 'Nombre de la escuela', 'text'],
            ['address', 'Dirección', 'text'],
            ['city', 'Ciudad', 'text'],
            ['phone', 'Teléfono', 'text'],
            ['email', 'Correo de contacto', 'email'],
            ['directorName', 'Director/a', 'text'],
            ['motto', 'Lema o mensaje', 'text']
          ].map(([key, label, type]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700" htmlFor={key}>
                {label}
              </label>
              <input
                id={key}
                type={type}
                value={(form as Record<string, string | undefined>)[key] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 outline-none ring-brand-500/30 focus:ring-2"
              />
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
              onChange={(e) => setForm((f) => ({ ...f, maxGradeScale: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 outline-none ring-brand-500/30 focus:ring-2"
              placeholder="100.00"
            />
            <p className="mt-1 text-xs text-slate-500">Rango permitido: 1 a 999.99, con máximo 2 decimales.</p>
          </div>
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
            disabled={saving || (platformAdmin && !selectedSchoolId)}
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
        </dl>
      )}
    </div>
  );
}

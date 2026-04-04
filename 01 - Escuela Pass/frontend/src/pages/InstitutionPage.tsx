import { type FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { useAuth } from '@/context/useAuth';

type Profile = {
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  directorName?: string;
  motto?: string;
};

export function InstitutionPage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'ADMINISTRATIVO';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Profile>({ name: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<Profile>('/api/v1/settings/institution');
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
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const { data } = await api.patch<Profile>('/api/v1/settings/institution', form);
      setProfile(data);
      setForm(data);
      setMessage('Cambios guardados correctamente.');
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudieron guardar los cambios.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-slate-600">Cargando datos de la institución…</p>;
  }

  if (error && !profile) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-red-800 ring-1 ring-red-200" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-xl animate-slide-up">
      <h1 className="text-2xl font-bold text-slate-900">Institución</h1>
      <p className="mt-1 text-slate-600">Información visible para usuarios de la plataforma.</p>

      {canEdit ? (
        <form className="mt-8 space-y-4" onSubmit={onSave}>
          {[
            ['name', 'Nombre', 'text'],
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
          {error && (
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
            disabled={saving}
            className="rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
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

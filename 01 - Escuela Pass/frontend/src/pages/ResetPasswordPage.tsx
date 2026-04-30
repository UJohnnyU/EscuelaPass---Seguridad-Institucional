import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<{ message: string }>('/api/v1/auth/reset-password', {
        token,
        newPassword
      });
      setMsg(data.message);
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo restablecer la contraseña.'));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
          <p className="font-medium text-red-900">Enlace inválido o incompleto.</p>
          <Link to="/recuperar-contrasena" className="mt-4 inline-block text-brand-800 underline text-sm">
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-slate-900">
            Nueva contraseña
          </h1>
          <p className="mt-2 text-sm text-slate-600">Ingrese y confirme su nueva contraseña.</p>
        </div>

        {msg ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950">
            {msg}
            <p className="mt-2 text-xs text-emerald-800">Redirigiendo al inicio de sesión…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="new-pass">
                Nueva contraseña
              </label>
              <input
                id="new-pass"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none ring-brand-500/30 focus:border-brand-500 focus:ring-2"
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="confirm-pass">
                Confirmar contraseña
              </label>
              <input
                id="confirm-pass"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none ring-brand-500/30 focus:border-brand-500 focus:ring-2"
              />
            </div>

            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !newPassword || !confirm}
              className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? 'Guardando…' : 'Restablecer contraseña'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-brand-800 hover:underline">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

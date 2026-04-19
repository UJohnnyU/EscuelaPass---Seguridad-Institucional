import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { publicAssetUrl } from '@/lib/asset-url';
import { uploadSchoolLogo } from '@/lib/uploads-api';

type School = {
  id: string;
  name: string;
  code: string;
  status: boolean;
  maxGradeScale: string;
  passingGrade: string;
  minFailedSubjectsToRepeat: number;
  latitude: string;
  longitude: string;
  logoPath?: string | null;
};

type EditDraft = {
  maxGradeScale: string;
  passingGrade: string;
  minFailedSubjectsToRepeat: string;
};

export function SchoolsAdminPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [maxGradeScale, setMaxGradeScale] = useState('100.00');
  const [passingGrade, setPassingGrade] = useState('60.00');
  const [minFailedSubjectsToRepeat, setMinFailedSubjectsToRepeat] = useState('3');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [newSchoolLogo, setNewSchoolLogo] = useState<File | null>(null);
  const [logoUploadingId, setLogoUploadingId] = useState<string | null>(null);

  const [editing, setEditing] = useState<Record<string, EditDraft>>({});

  const loadSchools = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data } = await api.get<School[]>('/api/v1/schools');
      const list = Array.isArray(data) ? data : [];
      setSchools(list);
      const next: Record<string, EditDraft> = {};
      for (const s of list) {
        next[s.id] = {
          maxGradeScale: String(parseFloat(s.maxGradeScale)),
          passingGrade: String(parseFloat(s.passingGrade)),
          minFailedSubjectsToRepeat: String(s.minFailedSubjectsToRepeat)
        };
      }
      setEditing(next);
    } catch (e) {
      setErr(getUserFacingMessage(e));
      setSchools([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSchools();
  }, []);

  const parseDec2 = (s: string): number | null => {
    const n = Number(s.replace(',', '.'));
    if (!Number.isFinite(n)) return null;
    if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-9) return null;
    return Math.round(n * 100) / 100;
  };

  const createSchool = async () => {
    if (!name.trim() || !code.trim() || !maxGradeScale.trim() || !latitude.trim() || !longitude.trim()) {
      setErr('Nombre, código, ubicación y máximo de calificación son obligatorios.');
      return;
    }
    const max = parseDec2(maxGradeScale);
    if (max === null || max < 1 || max > 999.99) {
      setErr('Máximo de calificación inválido. Use entre 1 y 999.99 con máximo 2 decimales.');
      return;
    }
    const pass = parseDec2(passingGrade);
    if (pass === null || pass < 0 || pass > max) {
      setErr(`Nota mínima aprobatoria inválida. Use un valor entre 0 y ${max}.`);
      return;
    }
    const minFailed = Number(minFailedSubjectsToRepeat);
    if (!Number.isInteger(minFailed) || minFailed < 1 || minFailed > 50) {
      setErr('Mínimo de materias reprobadas para repetir inválido. Use un entero entre 1 y 50.');
      return;
    }
    const lat = Number(latitude.replace(',', '.'));
    const lng = Number(longitude.replace(',', '.'));
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setErr('Latitud inválida. Use un valor entre -90 y 90.');
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setErr('Longitud inválida. Use un valor entre -180 y 180.');
      return;
    }
    setErr(null);
    setOk(null);
    try {
      const { data: created } = await api.post<School>('/api/v1/schools', {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        maxGradeScale: max,
        passingGrade: pass,
        minFailedSubjectsToRepeat: minFailed,
        latitude: Number(lat.toFixed(8)),
        longitude: Number(lng.toFixed(8))
      });
      if (newSchoolLogo && created?.id) {
        setLogoUploadingId(created.id);
        try {
          await uploadSchoolLogo(created.id, newSchoolLogo);
        } finally {
          setLogoUploadingId(null);
        }
      }
      setOk(newSchoolLogo ? 'Escuela creada y escudo subido.' : 'Escuela creada correctamente.');
      setName('');
      setCode('');
      setMaxGradeScale('100.00');
      setPassingGrade('60.00');
      setMinFailedSubjectsToRepeat('3');
      setLatitude('');
      setLongitude('');
      setNewSchoolLogo(null);
      await loadSchools();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  };

  const toggleSchoolStatus = async (school: School) => {
    setErr(null);
    setOk(null);
    try {
      await api.patch(`/api/v1/schools/${school.id}`, { status: !school.status });
      setOk(`Escuela ${!school.status ? 'activada' : 'desactivada'}.`);
      await loadSchools();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  };

  const saveConfig = async (school: School) => {
    const draft = editing[school.id];
    if (!draft) return;
    const max = parseDec2(draft.maxGradeScale);
    const pass = parseDec2(draft.passingGrade);
    const minFailed = Number(draft.minFailedSubjectsToRepeat);
    if (max === null || max < 1 || max > 999.99) {
      setErr('Máximo de calificación inválido.');
      return;
    }
    if (pass === null || pass < 0 || pass > max) {
      setErr(`Nota mínima aprobatoria inválida. Use un valor entre 0 y ${max}.`);
      return;
    }
    if (!Number.isInteger(minFailed) || minFailed < 1 || minFailed > 50) {
      setErr('Mínimo de materias reprobadas inválido.');
      return;
    }
    setSavingId(school.id);
    setErr(null);
    setOk(null);
    try {
      await api.patch(`/api/v1/schools/${school.id}`, {
        maxGradeScale: max,
        passingGrade: pass,
        minFailedSubjectsToRepeat: minFailed
      });
      setOk('Reglas académicas actualizadas.');
      await loadSchools();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setSavingId(null);
    }
  };

  const patchDraft = (id: string, patch: Partial<EditDraft>) =>
    setEditing((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { maxGradeScale: '', passingGrade: '', minFailedSubjectsToRepeat: '' }), ...patch }
    }));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Escuelas</h1>
        <p className="mt-2 text-sm text-slate-600">
          Defina, para cada escuela, la nota máxima con la que se califica, la nota mínima para aprobar y cuántas
          materias reprobadas hacen que un alumno aparezca como <strong>REPROBADO</strong> en su boletín final.
        </p>
      </div>

      {err && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>}
      {ok && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{ok}</div>
      )}

      <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Nueva escuela</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm">
            <span className="text-slate-700">Nombre</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Código</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="COLEGIO-NORTE"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Nota máxima de la escala</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={maxGradeScale}
              onChange={(e) => setMaxGradeScale(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Nota mínima aprobatoria</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={passingGrade}
              onChange={(e) => setPassingGrade(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Materias reprobadas para reprobar el año</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={minFailedSubjectsToRepeat}
              onChange={(e) => setMinFailedSubjectsToRepeat(e.target.value)}
              inputMode="numeric"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Latitud</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="6.21303770"
              inputMode="decimal"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Longitud</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="-75.57724700"
              inputMode="decimal"
            />
          </label>
          <label className="block text-sm sm:col-span-2 lg:col-span-3">
            <span className="text-slate-700">Escudo o logo (opcional, formatos JPG, PNG o WEBP — máximo 2&nbsp;MB)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
              onChange={(e) => setNewSchoolLogo(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="button"
              onClick={() => void createSchool()}
              disabled={!!logoUploadingId}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {logoUploadingId ? 'Subiendo escudo…' : 'Crear escuela'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Escuelas registradas</h2>
        </div>
        {loading ? (
          <p className="px-4 py-4 text-sm text-slate-600">Cargando...</p>
        ) : schools.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-600">No hay escuelas registradas.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {schools.map((s) => {
              const d = editing[s.id] ?? {
                maxGradeScale: String(parseFloat(s.maxGradeScale)),
                passingGrade: String(parseFloat(s.passingGrade)),
                minFailedSubjectsToRepeat: String(s.minFailedSubjectsToRepeat)
              };
              return (
                <li key={s.id} className="grid gap-3 px-4 py-4 md:grid-cols-[2fr,3fr,auto] md:items-center">
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {publicAssetUrl(s.logoPath ?? null) ? (
                          <img
                            src={publicAssetUrl(s.logoPath ?? null)!}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                            —
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                    <p className="font-medium text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500">
                      {s.code} · {s.status ? 'Activa' : 'Inactiva'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Ubicación: {s.latitude}, {s.longitude}
                    </p>
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                      <span className="font-medium text-slate-700">Cambiar escudo</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={logoUploadingId === s.id}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (!f) return;
                          setErr(null);
                          setOk(null);
                          setLogoUploadingId(s.id);
                          try {
                            await uploadSchoolLogo(s.id, f);
                            setOk('Escudo actualizado.');
                            await loadSchools();
                          } catch (err) {
                            setErr(getUserFacingMessage(err));
                          } finally {
                            setLogoUploadingId(null);
                          }
                        }}
                      />
                      <span className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
                        {logoUploadingId === s.id ? 'Subiendo…' : 'Elegir archivo'}
                      </span>
                    </label>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="block text-xs text-slate-700">
                      Escala máx.
                      <input
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        value={d.maxGradeScale}
                        onChange={(e) => patchDraft(s.id, { maxGradeScale: e.target.value })}
                        inputMode="decimal"
                      />
                    </label>
                    <label className="block text-xs text-slate-700">
                      Mínima aprobatoria
                      <input
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        value={d.passingGrade}
                        onChange={(e) => patchDraft(s.id, { passingGrade: e.target.value })}
                        inputMode="decimal"
                      />
                    </label>
                    <label className="block text-xs text-slate-700">
                      Mín. materias reprobadas
                      <input
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        value={d.minFailedSubjectsToRepeat}
                        onChange={(e) => patchDraft(s.id, { minFailedSubjectsToRepeat: e.target.value })}
                        inputMode="numeric"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <button
                      type="button"
                      onClick={() => void saveConfig(s)}
                      disabled={savingId === s.id}
                      className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {savingId === s.id ? 'Guardando…' : 'Guardar reglas'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleSchoolStatus(s)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                    >
                      {s.status ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

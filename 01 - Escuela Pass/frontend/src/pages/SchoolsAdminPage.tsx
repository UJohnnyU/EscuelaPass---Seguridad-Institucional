import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { publicAssetUrl } from '@/lib/asset-url';
import { DATA_TABLE_SEARCH_INPUT, SCROLLABLE_PANEL_BODY } from '@/components/DataTableScroll';
import { uploadSchoolLogo } from '@/lib/uploads-api';

const HM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

type ShiftWindowsForm = {
  matutino: { start: string; end: string };
  vespertino: { start: string; end: string };
  nocturno: { start: string; end: string };
};

const DEFAULT_SHIFT_WINDOWS: ShiftWindowsForm = {
  matutino: { start: '07:00', end: '13:00' },
  vespertino: { start: '14:00', end: '19:00' },
  nocturno: { start: '19:00', end: '22:00' }
};

function clipHm(t?: string | null): string {
  if (!t || t.length < 4) return '';
  return t.slice(0, 5);
}

function schoolRowToShiftForm(s: School): ShiftWindowsForm {
  const m = {
    start: clipHm(s.shiftMatutinoStart) || DEFAULT_SHIFT_WINDOWS.matutino.start,
    end: clipHm(s.shiftMatutinoEnd) || DEFAULT_SHIFT_WINDOWS.matutino.end
  };
  const v = {
    start: clipHm(s.shiftVespertinoStart) || DEFAULT_SHIFT_WINDOWS.vespertino.start,
    end: clipHm(s.shiftVespertinoEnd) || DEFAULT_SHIFT_WINDOWS.vespertino.end
  };
  const n = {
    start: clipHm(s.shiftNocturnoStart) || DEFAULT_SHIFT_WINDOWS.nocturno.start,
    end: clipHm(s.shiftNocturnoEnd) || DEFAULT_SHIFT_WINDOWS.nocturno.end
  };
  return { matutino: m, vespertino: v, nocturno: n };
}

function validateShiftWindows(w: ShiftWindowsForm): string | null {
  const pairs: Array<[string, { start: string; end: string }]> = [
    ['Mañana', w.matutino],
    ['Tarde', w.vespertino],
    ['Noche', w.nocturno]
  ];
  for (const [label, p] of pairs) {
    if (!HM_REGEX.test(p.start) || !HM_REGEX.test(p.end)) {
      return `${label}: use horas en formato HH:mm (24 h).`;
    }
    const [sh, sm] = p.start.split(':').map(Number);
    const [eh, em] = p.end.split(':').map(Number);
    if (sh * 60 + sm >= eh * 60 + em) {
      return `${label}: la hora de inicio debe ser anterior a la de fin.`;
    }
  }
  return null;
}

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
  shiftMatutinoStart?: string | null;
  shiftMatutinoEnd?: string | null;
  shiftVespertinoStart?: string | null;
  shiftVespertinoEnd?: string | null;
  shiftNocturnoStart?: string | null;
  shiftNocturnoEnd?: string | null;
};

type EditDraft = {
  maxGradeScale: string;
  passingGrade: string;
  minFailedSubjectsToRepeat: string;
  shiftWindows: ShiftWindowsForm;
};

type SchoolUserSummary = {
  id: string;
  email: string;
  role: string;
  fullName: string;
  status: boolean;
  phone?: string | null;
  canAccessCampus?: boolean;
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
  const [createShifts, setCreateShifts] = useState<ShiftWindowsForm>({ ...DEFAULT_SHIFT_WINDOWS });

  const [editing, setEditing] = useState<Record<string, EditDraft>>({});

  const [schoolsSearch, setSchoolsSearch] = useState('');

  const [adminSchoolId, setAdminSchoolId] = useState<string | null>(null);
  const [adminUsers, setAdminUsers] = useState<SchoolUserSummary[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [admEmail, setAdmEmail] = useState('');
  const [admPass, setAdmPass] = useState('');
  const [admName, setAdmName] = useState('');
  const [admPhone, setAdmPhone] = useState('');
  const [admCanCampus, setAdmCanCampus] = useState(true);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const [editingAdminUserId, setEditingAdminUserId] = useState<string | null>(null);
  const [admEditFullName, setAdmEditFullName] = useState('');
  const [admEditPhone, setAdmEditPhone] = useState('');
  const [admEditCampus, setAdmEditCampus] = useState(true);
  const [savingAdminUserId, setSavingAdminUserId] = useState<string | null>(null);

  const [passwordResetUserId, setPasswordResetUserId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState<string | null>(null);

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
          minFailedSubjectsToRepeat: String(s.minFailedSubjectsToRepeat),
          shiftWindows: schoolRowToShiftForm(s)
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

  const filteredSchools = useMemo(() => {
    const q = schoolsSearch.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) =>
      [s.name, s.code, String(s.latitude), String(s.longitude), s.status ? 'activa' : 'inactiva']
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [schools, schoolsSearch]);

  const toggleAdminSchool = async (schoolId: string) => {
    if (adminSchoolId === schoolId) {
      setAdminSchoolId(null);
      setEditingAdminUserId(null);
      setPasswordResetUserId(null);
      setResetPasswordValue('');
      return;
    }
    setErr(null);
    setAdminSchoolId(schoolId);
    setEditingAdminUserId(null);
    setPasswordResetUserId(null);
    setResetPasswordValue('');
    setAdmEmail('');
    setAdmPass('');
    setAdmName('');
    setAdmPhone('');
    setAdmCanCampus(true);
    setAdminUsersLoading(true);
    try {
      const { data } = await api.get<SchoolUserSummary[]>(`/api/v1/schools/${schoolId}/users`);
      const list = Array.isArray(data) ? data : [];
      setAdminUsers(list.filter((u) => u.role === 'ADMINISTRATIVO'));
    } catch (e) {
      setAdminUsers([]);
      setErr(getUserFacingMessage(e, 'No se pudo cargar el personal administrativo.'));
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const refreshAdminUsersFor = async (schoolId: string) => {
    const { data } = await api.get<SchoolUserSummary[]>(`/api/v1/schools/${schoolId}/users`);
    const list = Array.isArray(data) ? data : [];
    setAdminUsers(list.filter((u) => u.role === 'ADMINISTRATIVO'));
  };

  const createAdministrative = async (schoolId: string) => {
    if (!admEmail.trim() || !admPass || !admName.trim()) {
      setErr('Correo, contraseña y nombre son obligatorios para crear un administrativo.');
      return;
    }
    setErr(null);
    setOk(null);
    setCreatingAdmin(true);
    try {
      await api.post(`/api/v1/schools/${schoolId}/admin`, {
        email: admEmail.trim(),
        password: admPass,
        fullName: admName.trim(),
        phone: admPhone.trim() || undefined,
        canAccessCampus: admCanCampus
      });
      setOk('Administrativo creado. Puede iniciar sesión gestionando esta escuela.');
      setAdmPass('');
      setAdmEmail('');
      setAdmName('');
      setAdmPhone('');
      await refreshAdminUsersFor(schoolId);
    } catch (e) {
      setErr(getUserFacingMessage(e, 'No se pudo crear el administrativo.'));
    } finally {
      setCreatingAdmin(false);
    }
  };

  function startEditAdministrative(u: SchoolUserSummary) {
    setEditingAdminUserId(u.id);
    setPasswordResetUserId(null);
    setResetPasswordValue('');
    setAdmEditFullName(u.fullName);
    setAdmEditPhone(u.phone?.trim() ? u.phone : '');
    setAdmEditCampus(u.canAccessCampus ?? false);
  }

  function cancelAdminEdit() {
    setEditingAdminUserId(null);
  }

  async function saveAdministrativeEdits(schoolId: string) {
    if (!editingAdminUserId) return;
    setSavingAdminUserId(editingAdminUserId);
    setErr(null);
    setOk(null);
    try {
      const fullNameTrim = admEditFullName.trim();
      if (!fullNameTrim) {
        setErr('El nombre completo no puede estar vacío.');
        return;
      }
      await api.patch(`/api/v1/schools/${schoolId}/users/${editingAdminUserId}`, {
        fullName: fullNameTrim,
        phone: admEditPhone.trim(),
        canAccessCampus: admEditCampus
      });
      setOk('Datos del administrativo actualizados.');
      setEditingAdminUserId(null);
      await refreshAdminUsersFor(schoolId);
    } catch (e) {
      setErr(getUserFacingMessage(e, 'No se pudo guardar los cambios.'));
    } finally {
      setSavingAdminUserId(null);
    }
  }

  async function toggleAdministrativeStatus(schoolId: string, u: SchoolUserSummary) {
    setErr(null);
    setOk(null);
    setSavingAdminUserId(u.id);
    try {
      await api.patch(`/api/v1/schools/${schoolId}/users/${u.id}`, { status: !u.status });
      setOk(u.status ? 'Usuario desactivado.' : 'Usuario activado.');
      await refreshAdminUsersFor(schoolId);
    } catch (e) {
      setErr(getUserFacingMessage(e, 'No se pudo cambiar el estado.'));
    } finally {
      setSavingAdminUserId(null);
    }
  }

  async function submitPasswordReset(schoolId: string, userId: string) {
    if (resetPasswordValue.length < 8) {
      setErr('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setErr(null);
    setOk(null);
    setResettingPasswordUserId(userId);
    try {
      await api.post(`/api/v1/schools/${schoolId}/users/${userId}/reset-password`, {
        password: resetPasswordValue
      });
      setOk('Contraseña actualizada.');
      setPasswordResetUserId(null);
      setResetPasswordValue('');
    } catch (e) {
      setErr(getUserFacingMessage(e, 'No se pudo restablecer la contraseña.'));
    } finally {
      setResettingPasswordUserId(null);
    }
  }

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
    const shiftErr = validateShiftWindows(createShifts);
    if (shiftErr) {
      setErr(shiftErr);
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
        longitude: Number(lng.toFixed(8)),
        shiftWindows: createShifts
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
      setCreateShifts({ ...DEFAULT_SHIFT_WINDOWS });
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
    const shiftWindows = draft.shiftWindows ?? schoolRowToShiftForm(school);
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
    const shiftErr = validateShiftWindows(shiftWindows);
    if (shiftErr) {
      setErr(shiftErr);
      return;
    }
    setSavingId(school.id);
    setErr(null);
    setOk(null);
    try {
      await api.patch(`/api/v1/schools/${school.id}`, {
        maxGradeScale: max,
        passingGrade: pass,
        minFailedSubjectsToRepeat: minFailed,
        shiftWindows
      });
      setOk('Reglas académicas y jornadas actualizadas.');
      await loadSchools();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setSavingId(null);
    }
  };

  const patchDraft = (id: string, patch: Partial<EditDraft>) =>
    setEditing((prev) => {
      const cur = prev[id] ?? {
        maxGradeScale: '',
        passingGrade: '',
        minFailedSubjectsToRepeat: '',
        shiftWindows: { ...DEFAULT_SHIFT_WINDOWS }
      };
      return {
        ...prev,
        [id]: { ...cur, ...patch }
      };
    });

  const patchDraftShift = (
    id: string,
    band: keyof ShiftWindowsForm,
    field: 'start' | 'end',
    value: string
  ) =>
    setEditing((prev) => {
      const cur = prev[id] ?? {
        maxGradeScale: '',
        passingGrade: '',
        minFailedSubjectsToRepeat: '',
        shiftWindows: { ...DEFAULT_SHIFT_WINDOWS }
      };
      return {
        ...prev,
        [id]: {
          ...cur,
          shiftWindows: {
            ...cur.shiftWindows,
            [band]: { ...cur.shiftWindows[band], [field]: value }
          }
        }
      };
    });

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Escuelas</h1>
        <p className="mt-2 text-sm text-slate-600">
          Defina, para cada escuela, la nota máxima con la que se califica, la nota mínima para aprobar, cuántas
          materias reprobadas hacen que un alumno aparezca como <strong>REPROBADO</strong> en su boletín final, y los
          horarios de jornada (mañana, tarde y noche) para el cierre automático de asistencias.
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
            <span className="text-slate-700">Jornadas escolares (inicio y fin de clases, formato HH:mm)</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(
                [
                  ['Mañana', 'matutino'],
                  ['Tarde', 'vespertino'],
                  ['Noche', 'nocturno']
                ] as const
              ).map(([label, key]) => (
                <div key={key} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-2">
                  <span className="w-full text-xs font-medium text-slate-600">{label}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                    value={createShifts[key].start}
                    onChange={(e) =>
                      setCreateShifts((w) => ({ ...w, [key]: { ...w[key], start: e.target.value } }))
                    }
                    placeholder="07:00"
                    aria-label={`${label} inicio`}
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="text"
                    className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                    value={createShifts[key].end}
                    onChange={(e) =>
                      setCreateShifts((w) => ({ ...w, [key]: { ...w[key], end: e.target.value } }))
                    }
                    placeholder="13:00"
                    aria-label={`${label} fin`}
                  />
                </div>
              ))}
            </div>
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
              className="rounded border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60 dark:border-brand-500 dark:bg-brand-600 dark:text-white dark:shadow-md dark:shadow-brand-950/30 dark:hover:bg-brand-500 dark:hover:border-brand-400 dark:disabled:border-slate-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
            >
              {logoUploadingId ? 'Subiendo escudo…' : 'Crear escuela'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Escuelas registradas</h2>
          <label className="block w-full sm:max-w-xs">
            <span className="sr-only">Buscar escuelas</span>
            <input
              type="search"
              value={schoolsSearch}
              onChange={(e) => setSchoolsSearch(e.target.value)}
              placeholder="Buscar por nombre o código…"
              disabled={schools.length === 0}
              className={DATA_TABLE_SEARCH_INPUT}
            />
          </label>
        </div>
        {loading ? (
          <p className="px-4 py-4 text-sm text-slate-600">Cargando...</p>
        ) : schools.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-600">No hay escuelas registradas.</p>
        ) : filteredSchools.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-600">Ninguna escuela coincide con la búsqueda.</p>
        ) : (
          <div className={SCROLLABLE_PANEL_BODY}>
            <ul className="divide-y divide-slate-100">
            {filteredSchools.map((s) => {
              const d = editing[s.id] ?? {
                maxGradeScale: String(parseFloat(s.maxGradeScale)),
                passingGrade: String(parseFloat(s.passingGrade)),
                minFailedSubjectsToRepeat: String(s.minFailedSubjectsToRepeat),
                shiftWindows: schoolRowToShiftForm(s)
              };
              const sw = d.shiftWindows ?? schoolRowToShiftForm(s);
              return (
                <li key={s.id} className="flex flex-col gap-3 px-4 py-4">
                  <div className="grid gap-3 md:grid-cols-[2fr,3fr,auto] md:items-center">
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
                      className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60 dark:border-brand-500 dark:bg-brand-600 dark:text-white dark:shadow-md dark:shadow-brand-950/30 dark:hover:bg-brand-500 dark:hover:border-brand-400 dark:disabled:border-slate-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
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
                </div>
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-xs font-medium text-slate-600">
                      Jornadas — inicio y fin de clases (HH:mm). Definen el cierre automático de asistencia.
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {(
                        [
                          ['Mañana', 'matutino'],
                          ['Tarde', 'vespertino'],
                          ['Noche', 'nocturno']
                        ] as const
                      ).map(([label, key]) => (
                        <div
                          key={key}
                          className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-2"
                        >
                          <span className="w-full text-xs font-medium text-slate-600">{label}</span>
                          <input
                            type="text"
                            className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                            value={sw[key].start}
                            onChange={(e) => patchDraftShift(s.id, key, 'start', e.target.value)}
                            aria-label={`${s.name} ${label} inicio`}
                          />
                          <span className="text-slate-400">–</span>
                          <input
                            type="text"
                            className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                            value={sw[key].end}
                            onChange={(e) => patchDraftShift(s.id, key, 'end', e.target.value)}
                            aria-label={`${s.name} ${label} fin`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      className="text-xs font-semibold uppercase tracking-wide text-slate-700 hover:text-slate-900"
                      onClick={() => void toggleAdminSchool(s.id)}
                    >
                      Administrativos {adminSchoolId === s.id ? '▲ ocultar' : '▼ mostrar'}
                    </button>
                    {adminSchoolId === s.id ? (
                      <div className="mt-3 rounded border border-slate-100 bg-slate-50/80 p-3">
                        <p className="text-xs text-slate-600">
                          Personal con rol ADMINISTRATIVO en esta escuela. Se crea un usuario vinculado y un registro de
                          personal administrativo.
                        </p>
                        {adminUsersLoading ? (
                          <p className="mt-2 text-xs text-slate-500">Cargando…</p>
                        ) : adminUsers.length === 0 ? (
                          <p className="mt-2 text-xs text-slate-500">Aún no hay administrativos en esta institución.</p>
                        ) : (
                          <ul className="mt-2 space-y-3 text-xs">
                            {adminUsers.map((u) => (
                              <li key={u.id} className="rounded border border-slate-200 bg-white p-3">
                                {editingAdminUserId === u.id ? (
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <label className="block text-xs text-slate-700 sm:col-span-2">
                                      Nombre completo
                                      <input
                                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                        value={admEditFullName}
                                        onChange={(e) => setAdmEditFullName(e.target.value)}
                                      />
                                    </label>
                                    <label className="block text-xs text-slate-700 sm:col-span-2">
                                      Celular
                                      <input
                                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                        value={admEditPhone}
                                        onChange={(e) => setAdmEditPhone(e.target.value)}
                                        placeholder="Opcional"
                                      />
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-slate-700 sm:col-span-2">
                                      <input
                                        type="checkbox"
                                        checked={admEditCampus}
                                        onChange={(e) => setAdmEditCampus(e.target.checked)}
                                      />
                                      Acceso al campus habilitado
                                    </label>
                                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                                      <button
                                        type="button"
                                        disabled={savingAdminUserId === u.id}
                                        onClick={() => void saveAdministrativeEdits(s.id)}
                                        className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60 dark:border-brand-500 dark:bg-brand-600 dark:text-white dark:shadow-md dark:shadow-brand-950/30 dark:hover:bg-brand-500 dark:hover:border-brand-400 dark:disabled:border-slate-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
                                      >
                                        {savingAdminUserId === u.id ? 'Guardando…' : 'Guardar'}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={savingAdminUserId === u.id}
                                        onClick={cancelAdminEdit}
                                        className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div>
                                        <p className="font-medium text-slate-800">{u.fullName}</p>
                                        <p className="text-slate-600">{u.email}</p>
                                        <p className="mt-1 text-slate-500">
                                          Cel.: {u.phone?.trim() ? u.phone : '—'} · Campus:{' '}
                                          {u.canAccessCampus ? 'Sí' : 'No'}
                                        </p>
                                      </div>
                                      <span
                                        className={
                                          u.status ? 'shrink-0 text-emerald-700' : 'shrink-0 text-slate-400'
                                        }
                                      >
                                        {u.status ? 'Activo' : 'Inactivo'}
                                      </span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={savingAdminUserId !== null}
                                        onClick={() => startEditAdministrative(u)}
                                        className="text-xs font-medium text-brand-900 underline hover:no-underline disabled:opacity-50"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        disabled={savingAdminUserId === u.id}
                                        onClick={() => void toggleAdministrativeStatus(s.id, u)}
                                        className="text-xs font-medium text-slate-700 underline hover:no-underline disabled:opacity-50"
                                      >
                                        {u.status ? 'Desactivar' : 'Activar'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingAdminUserId(null);
                                          setPasswordResetUserId((prev) => (prev === u.id ? null : u.id));
                                          setResetPasswordValue('');
                                        }}
                                        className="text-xs font-medium text-slate-700 underline hover:no-underline"
                                      >
                                        {passwordResetUserId === u.id ? 'Ocultar contraseña' : 'Nueva contraseña'}
                                      </button>
                                    </div>
                                    {passwordResetUserId === u.id ? (
                                      <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-2 sm:flex-row sm:items-end">
                                        <label className="block min-w-[12rem] flex-1 text-xs text-slate-700">
                                          Nueva contraseña
                                          <input
                                            type="password"
                                            minLength={8}
                                            autoComplete="new-password"
                                            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                            value={resetPasswordValue}
                                            onChange={(e) => setResetPasswordValue(e.target.value)}
                                          />
                                        </label>
                                        <button
                                          type="button"
                                          disabled={resettingPasswordUserId === u.id}
                                          onClick={() => void submitPasswordReset(s.id, u.id)}
                                          className="rounded bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                                        >
                                          {resettingPasswordUserId === u.id ? 'Aplicando…' : 'Aplicar'}
                                        </button>
                                      </div>
                                    ) : null}
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <label className="block text-xs text-slate-700 sm:col-span-2">
                            Correo
                            <input
                              type="email"
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                              value={admEmail}
                              onChange={(e) => setAdmEmail(e.target.value)}
                              autoComplete="off"
                            />
                          </label>
                          <label className="block text-xs text-slate-700 sm:col-span-2">
                            Contraseña inicial
                            <input
                              type="password"
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                              value={admPass}
                              onChange={(e) => setAdmPass(e.target.value)}
                              minLength={8}
                              autoComplete="new-password"
                            />
                          </label>
                          <label className="block text-xs text-slate-700 sm:col-span-2">
                            Nombre completo
                            <input
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                              value={admName}
                              onChange={(e) => setAdmName(e.target.value)}
                            />
                          </label>
                          <label className="block text-xs text-slate-700 sm:col-span-2">
                            Celular (opcional)
                            <input
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                              value={admPhone}
                              onChange={(e) => setAdmPhone(e.target.value)}
                            />
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-700 sm:col-span-2">
                            <input
                              type="checkbox"
                              checked={admCanCampus}
                              onChange={(e) => setAdmCanCampus(e.target.checked)}
                            />
                            Acceso al campus habilitado
                          </label>
                          <div className="sm:col-span-2">
                            <button
                              type="button"
                              disabled={creatingAdmin}
                              onClick={() => void createAdministrative(s.id)}
                              className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60 dark:border-brand-500 dark:bg-brand-600 dark:text-white dark:shadow-md dark:shadow-brand-950/30 dark:hover:bg-brand-500 dark:hover:border-brand-400 dark:disabled:border-slate-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
                            >
                              {creatingAdmin ? 'Creando…' : 'Crear administrativo'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          </div>
        )}
      </section>
    </div>
  );
}

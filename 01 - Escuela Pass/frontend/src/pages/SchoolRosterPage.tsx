import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { type SmartSelectOption, SmartSelect } from '@/components/SmartSelect';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { useAuth } from '@/context/useAuth';
import { isPlatformAdmin } from '@/lib/roles';

type SchoolRow = { id: string; name: string; code: string };

type GroupRow = {
  id: string;
  name: string;
  grade: string | null;
  shift: string;
  schoolYear: string;
  classroom: string | null;
  capacity: number | null;
};

type StudentRow = {
  id: string;
  matricula: string;
  groupId: string | null;
  fullName: string;
  email: string;
};

type TeacherRow = {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string;
};

type ParentRow = {
  id: string;
  fullName: string;
  email: string;
  isPrimaryContact: boolean;
};

type LinkRow = {
  id: string;
  studentId: string;
  parentId: string;
  relationship: string;
  isPrimary: boolean;
  canPickup: boolean;
  studentFullName: string;
  parentFullName: string;
};

type AssignmentRow = {
  id: string;
  teacherId: string;
  groupId: string;
  subjectId: string | null;
  isMainTeacher: boolean;
  canAuthorizeDepartures: boolean;
};

function defaultSchoolYear(): string {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  const start = m >= 6 ? y : y - 1;
  return `${start}-${start + 1}`;
}

export function SchoolRosterPage() {
  const { user } = useAuth();
  const platformAdmin = isPlatformAdmin(user);

  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [schoolsReady, setSchoolsReady] = useState(!platformAdmin);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [gName, setGName] = useState('');
  const [gGrade, setGGrade] = useState('');
  const [gShift, setGShift] = useState('MATUTINO');
  const [gYear, setGYear] = useState(defaultSchoolYear());
  const [gRoom, setGRoom] = useState('');
  const [gCap, setGCap] = useState('');

  const [sEmail, setSEmail] = useState('');
  const [sPass, setSPass] = useState('');
  const [sName, setSName] = useState('');
  const [sMat, setSMat] = useState('');
  const [sGroup, setSGroup] = useState('');

  const [tEmail, setTEmail] = useState('');
  const [tPass, setTPass] = useState('');
  const [tName, setTName] = useState('');
  const [tNum, setTNum] = useState('');

  const [aTeacher, setATeacher] = useState('');
  const [aGroup, setAGroup] = useState('');

  const [pEmail, setPEmail] = useState('');
  const [pPass, setPPass] = useState('');
  const [pName, setPName] = useState('');
  const [pPrimary, setPPrimary] = useState(false);

  const [lStudent, setLStudent] = useState('');
  const [lParent, setLParent] = useState('');
  const [lRel, setLRel] = useState('Padre');
  const [lPickup, setLPickup] = useState(true);

  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);

  const schoolQuery = useMemo(() => {
    if (platformAdmin && selectedSchoolId) return { schoolId: selectedSchoolId };
    return undefined;
  }, [platformAdmin, selectedSchoolId]);
  const canLoad = !platformAdmin || !!selectedSchoolId;

  const schoolOptions = useMemo(
    () => schools.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` })),
    [schools]
  );
  const groupOptions = useMemo(
    () => groups.map((g) => ({ value: g.id, label: `${g.name} (${g.schoolYear})` })),
    [groups]
  );
  const teacherOptions = useMemo(() => teachers.map((t) => ({ value: t.id, label: t.fullName })), [teachers]);
  const loadStudentOptions = useCallback(
    async (q: string, signal: AbortSignal) => {
      if (!canLoad) return [];
      const { data } = await api.get<StudentRow[]>('/api/v1/school/students', {
        params: { ...(schoolQuery ?? {}), q: q.trim() || undefined, limit: 80 },
        signal
      });
      const rows = Array.isArray(data) ? data : [];
      return rows.map(
        (s): SmartSelectOption => ({
          value: s.id,
          label: `${s.fullName} (${s.matricula})`,
          searchText: s.matricula
        })
      );
    },
    [canLoad, schoolQuery]
  );

  const loadParentOptions = useCallback(
    async (q: string, signal: AbortSignal) => {
      if (!canLoad) return [];
      const { data } = await api.get<ParentRow[]>('/api/v1/school/parents', {
        params: { ...(schoolQuery ?? {}), q: q.trim() || undefined, limit: 80 },
        signal
      });
      const rows = Array.isArray(data) ? data : [];
      return rows.map(
        (p): SmartSelectOption => ({
          value: p.id,
          label: p.fullName
        })
      );
    },
    [canLoad, schoolQuery]
  );

  const refreshAll = useCallback(async () => {
    if (!canLoad) return;
    setError(null);
    try {
      const [g, st, te, pa, asg, lk] = await Promise.all([
        api.get<GroupRow[]>('/api/v1/school/groups', { params: schoolQuery }),
        api.get<StudentRow[]>('/api/v1/school/students', { params: schoolQuery }),
        api.get<TeacherRow[]>('/api/v1/school/teachers', { params: schoolQuery }),
        api.get<ParentRow[]>('/api/v1/school/parents', { params: schoolQuery }),
        api.get<AssignmentRow[]>('/api/v1/school/teacher-assignments', { params: schoolQuery }),
        api.get<LinkRow[]>('/api/v1/school/student-parent-links', { params: schoolQuery })
      ]);
      setGroups(Array.isArray(g.data) ? g.data : []);
      setStudents(Array.isArray(st.data) ? st.data : []);
      setTeachers(Array.isArray(te.data) ? te.data : []);
      setParents(Array.isArray(pa.data) ? pa.data : []);
      setAssignments(Array.isArray(asg.data) ? asg.data : []);
      setLinks(Array.isArray(lk.data) ? lk.data : []);
    } catch (e) {
      setError(getUserFacingMessage(e, 'No se pudieron cargar los datos de la escuela.'));
    }
  }, [canLoad, schoolQuery]);

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
      setGroups([]);
      setStudents([]);
      setTeachers([]);
      setParents([]);
      setLinks([]);
      setAssignments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refreshAll();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolsReady, platformAdmin, selectedSchoolId, refreshAll]);

  async function onCreateGroup(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: gName.trim(),
        schoolYear: gYear.trim(),
        shift: gShift
      };
      if (gGrade.trim()) body.grade = gGrade.trim();
      if (gRoom.trim()) body.classroom = gRoom.trim();
      const cap = Number.parseInt(gCap, 10);
      if (!Number.isNaN(cap) && cap > 0) body.capacity = cap;
      if (platformAdmin && selectedSchoolId) body.schoolId = selectedSchoolId;
      await api.post('/api/v1/school/groups', body);
      setGName('');
      setGGrade('');
      setGRoom('');
      setGCap('');
      setMessage('Grupo creado.');
      await refreshAll();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo crear el grupo.'));
    }
  }

  async function onCreateStudent(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        email: sEmail.trim(),
        password: sPass,
        fullName: sName.trim(),
        matricula: sMat.trim()
      };
      if (sGroup) body.groupId = sGroup;
      if (platformAdmin && selectedSchoolId) body.schoolId = selectedSchoolId;
      await api.post('/api/v1/school/students', body);
      setSEmail('');
      setSPass('');
      setSName('');
      setSMat('');
      setSGroup('');
      setMessage('Alumno registrado.');
      await refreshAll();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo registrar el alumno.'));
    }
  }

  async function updateStudentGroup(studentId: string, nextGroupId: string | null, previousGroupId: string | null) {
    if ((previousGroupId ?? null) === (nextGroupId ?? null)) return;
    setMessage(null);
    setError(null);
    setUpdatingStudentId(studentId);
    try {
      await api.patch(`/api/v1/school/students/${studentId}`, { groupId: nextGroupId });
      setMessage('Grupo del alumno actualizado.');
      await refreshAll();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo actualizar el grupo.'));
      await refreshAll();
    } finally {
      setUpdatingStudentId(null);
    }
  }

  async function onCreateTeacher(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        email: tEmail.trim(),
        password: tPass,
        fullName: tName.trim(),
        employeeNumber: tNum.trim()
      };
      if (platformAdmin && selectedSchoolId) body.schoolId = selectedSchoolId;
      await api.post('/api/v1/school/teachers', body);
      setTEmail('');
      setTPass('');
      setTName('');
      setTNum('');
      setMessage('Docente registrado.');
      await refreshAll();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo registrar el docente.'));
    }
  }

  async function onAssignTeacher(e: FormEvent) {
    e.preventDefault();
    if (!aTeacher || !aGroup) return;
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        teacherId: aTeacher,
        groupId: aGroup
      };
      if (platformAdmin && selectedSchoolId) body.schoolId = selectedSchoolId;
      await api.post('/api/v1/school/teacher-assignments', body);
      setATeacher('');
      setAGroup('');
      setMessage('Docente asignado al grupo.');
      await refreshAll();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo crear la asignación.'));
    }
  }

  async function onRemoveAssignment(id: string) {
    setMessage(null);
    setError(null);
    try {
      await api.delete(`/api/v1/school/teacher-assignments/${id}`);
      setMessage('Asignación eliminada.');
      await refreshAll();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo eliminar la asignación.'));
    }
  }

  async function onCreateParent(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        email: pEmail.trim(),
        password: pPass,
        fullName: pName.trim(),
        isPrimaryContact: pPrimary
      };
      if (platformAdmin && selectedSchoolId) body.schoolId = selectedSchoolId;
      await api.post('/api/v1/school/parents', body);
      setPEmail('');
      setPPass('');
      setPName('');
      setPPrimary(false);
      setMessage('Perfil de padre/tutor creado.');
      await refreshAll();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo crear el perfil de padre/tutor.'));
    }
  }

  async function onLink(e: FormEvent) {
    e.preventDefault();
    if (!lStudent || !lParent || !lRel.trim()) return;
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        studentId: lStudent,
        parentId: lParent,
        relationship: lRel.trim(),
        canPickup: lPickup
      };
      if (platformAdmin && selectedSchoolId) body.schoolId = selectedSchoolId;
      await api.post('/api/v1/school/student-parent-links', body);
      setLStudent('');
      setLParent('');
      setLRel('Padre');
      setLPickup(true);
      setMessage('Vínculo familia–alumno registrado.');
      await refreshAll();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo vincular padre y alumno.'));
    }
  }

  async function onUnlink(id: string) {
    setMessage(null);
    setError(null);
    try {
      await api.delete(`/api/v1/school/student-parent-links/${id}`);
      setMessage('Vínculo eliminado.');
      await refreshAll();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo eliminar el vínculo.'));
    }
  }

  if (!schoolsReady || loading) {
    return <p className="text-slate-600">Cargando plantel y grupos…</p>;
  }

  if (platformAdmin && !selectedSchoolId) {
    return (
      <div className="max-w-3xl animate-fade-in">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-slate-900">Grupos y personas</h1>
        <p className="mt-2 text-sm text-slate-600">
          Seleccione una escuela para administrar grupos, alumnos, docentes y familias.
        </p>
        {schools.length === 0 ? (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No hay escuelas registradas. Cree una desde Escuelas (administración de plataforma).
          </p>
        ) : (
          <label className="mt-8 block max-w-md text-sm">
            <span className="font-medium text-slate-700">Escuela</span>
            <div className="mt-1">
              <SmartSelect
                options={schoolOptions}
                value={selectedSchoolId}
                onChange={setSelectedSchoolId}
                placeholder="— Elegir —"
              />
            </div>
          </label>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl animate-fade-in">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-slate-900">Grupos y personas</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        Cree grupos, registre alumnos y docentes, asigne docentes a grupos y gestione padres o tutores vinculados a
        alumnos ya dados de alta.
      </p>

      {platformAdmin && schools.length > 0 && (
        <label className="mt-6 block max-w-md text-sm">
          <span className="font-medium text-slate-700">Escuela activa</span>
          <div className="mt-1">
            <SmartSelect options={schoolOptions} value={selectedSchoolId} onChange={setSelectedSchoolId} />
          </div>
        </label>
      )}

      {message && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900" role="alert">
          {error}
        </p>
      )}

      <section className="mt-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Grupos</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={onCreateGroup}>
          <label className="text-sm">
            <span className="text-slate-700">Nombre del grupo</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={gName}
              onChange={(e) => setGName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Grado (opcional)</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={gGrade}
              onChange={(e) => setGGrade(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Turno</span>
            <select
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={gShift}
              onChange={(e) => setGShift(e.target.value)}
            >
              <option value="MATUTINO">Matutino</option>
              <option value="VESPERTINO">Vespertino</option>
              <option value="NOCTURNO">Nocturno</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Ciclo escolar</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={gYear}
              onChange={(e) => setGYear(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Aula (opcional)</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={gRoom}
              onChange={(e) => setGRoom(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Cupo (opcional)</span>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={gCap}
              onChange={(e) => setGCap(e.target.value)}
            />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
            >
              Crear grupo
            </button>
          </div>
        </form>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-4 font-medium">Nombre</th>
                <th className="py-2 pr-4 font-medium">Grado</th>
                <th className="py-2 pr-4 font-medium">Turno</th>
                <th className="py-2 pr-4 font-medium">Ciclo</th>
                <th className="py-2 font-medium">Aula</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{r.name}</td>
                  <td className="py-2 pr-4">{r.grade ?? '—'}</td>
                  <td className="py-2 pr-4">{r.shift}</td>
                  <td className="py-2 pr-4">{r.schoolYear}</td>
                  <td className="py-2">{r.classroom ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {groups.length === 0 && <p className="mt-2 text-slate-500">No hay grupos en esta escuela.</p>}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Alumnos</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onCreateStudent}>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-700">Correo</span>
            <input
              type="email"
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={sEmail}
              onChange={(e) => setSEmail(e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-700">Contraseña inicial</span>
            <input
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={sPass}
              onChange={(e) => setSPass(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Nombre completo</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={sName}
              onChange={(e) => setSName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Matrícula</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={sMat}
              onChange={(e) => setSMat(e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-700">Grupo (opcional)</span>
            <div className="mt-1">
              <SmartSelect
                options={groupOptions}
                value={sGroup}
                onChange={setSGroup}
                placeholder="— Sin asignar —"
              />
            </div>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
            >
              Registrar alumno
            </button>
          </div>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          En la tabla puede cambiar el grupo de un alumno ya registrado; el cambio se guarda al elegir otra opción.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-4 font-medium">Nombre</th>
                <th className="py-2 pr-4 font-medium">Matrícula</th>
                <th className="min-w-[14rem] py-2 font-medium">Grupo</th>
              </tr>
            </thead>
            <tbody>
              {students.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 align-middle">{r.fullName}</td>
                  <td className="py-2 pr-4 align-middle">{r.matricula}</td>
                  <td className="py-2 align-middle">
                    <select
                      className="max-w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-60"
                      value={r.groupId ?? ''}
                      disabled={updatingStudentId === r.id}
                      onChange={(e) => {
                        const v = e.target.value;
                        void updateStudentGroup(r.id, v === '' ? null : v, r.groupId);
                      }}
                      aria-label={`Grupo de ${r.fullName}`}
                    >
                      <option value="">— Sin asignar —</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.schoolYear})
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {students.length === 0 && <p className="mt-2 text-slate-500">No hay alumnos registrados.</p>}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Docentes</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onCreateTeacher}>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-700">Correo</span>
            <input
              type="email"
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={tEmail}
              onChange={(e) => setTEmail(e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-700">Contraseña inicial</span>
            <input
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={tPass}
              onChange={(e) => setTPass(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Nombre completo</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={tName}
              onChange={(e) => setTName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Número de empleado</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={tNum}
              onChange={(e) => setTNum(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
            >
              Registrar docente
            </button>
          </div>
        </form>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-4 font-medium">Nombre</th>
                <th className="py-2 pr-4 font-medium">No. empleado</th>
                <th className="py-2 font-medium">Correo</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{r.fullName}</td>
                  <td className="py-2 pr-4">{r.employeeNumber}</td>
                  <td className="py-2">{r.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {teachers.length === 0 && <p className="mt-2 text-slate-500">No hay docentes registrados.</p>}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Docentes en grupos</h2>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={onAssignTeacher}>
          <label className="text-sm">
            <span className="text-slate-700">Docente</span>
            <div className="mt-1 min-w-[12rem]">
              <SmartSelect
                options={teacherOptions}
                value={aTeacher}
                onChange={setATeacher}
                placeholder="— Elegir —"
              />
            </div>
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Grupo</span>
            <div className="mt-1 min-w-[12rem]">
              <SmartSelect
                options={groupOptions}
                value={aGroup}
                onChange={setAGroup}
                placeholder="— Elegir —"
              />
            </div>
          </label>
          <button
            type="submit"
            className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Asignar
          </button>
        </form>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-4 font-medium">Docente</th>
                <th className="py-2 pr-4 font-medium">Grupo</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {assignments.map((r) => {
                const te = teachers.find((t) => t.id === r.teacherId);
                const gr = groups.find((g) => g.id === r.groupId);
                return (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{te?.fullName ?? r.teacherId}</td>
                    <td className="py-2 pr-4">{gr ? `${gr.name} (${gr.schoolYear})` : r.groupId}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        className="text-sm text-red-700 underline hover:text-red-900"
                        onClick={() => onRemoveAssignment(r.id)}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {assignments.length === 0 && <p className="mt-2 text-slate-500">No hay asignaciones.</p>}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Padres y tutores</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onCreateParent}>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-700">Correo</span>
            <input
              type="email"
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={pEmail}
              onChange={(e) => setPEmail(e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-700">Contraseña inicial</span>
            <input
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={pPass}
              onChange={(e) => setPPass(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Nombre completo</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
            />
          </label>
          <label className="mt-4 flex items-center gap-2 text-sm sm:col-span-1">
            <input type="checkbox" checked={pPrimary} onChange={(e) => setPPrimary(e.target.checked)} />
            Contacto principal
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
            >
              Crear perfil de padre/tutor
            </button>
          </div>
        </form>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-4 font-medium">Nombre</th>
                <th className="py-2 pr-4 font-medium">Correo</th>
                <th className="py-2 font-medium">Principal</th>
              </tr>
            </thead>
            <tbody>
              {parents.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{r.fullName}</td>
                  <td className="py-2 pr-4">{r.email}</td>
                  <td className="py-2">{r.isPrimaryContact ? 'Sí' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {parents.length === 0 && <p className="mt-2 text-slate-500">No hay padres/tutores registrados.</p>}
        </div>
      </section>

      <section className="mt-8 mb-12 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Vínculos padre / tutor ↔ alumno</h2>
        <p className="mt-1 text-sm text-slate-600">
          Elija un alumno y un padre ya registrados en esta escuela e indique el parentesco.
        </p>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={onLink}>
          <label className="text-sm">
            <span className="text-slate-700">Alumno</span>
            <div className="mt-1 min-w-[14rem]">
              <SmartSelect
                loadOptions={loadStudentOptions}
                value={lStudent}
                onChange={setLStudent}
                placeholder="— Elegir —"
              />
            </div>
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Padre / tutor</span>
            <div className="mt-1 min-w-[14rem]">
              <SmartSelect
                loadOptions={loadParentOptions}
                value={lParent}
                onChange={setLParent}
                placeholder="— Elegir —"
              />
            </div>
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Parentesco</span>
            <input
              required
              className="mt-1 w-40 rounded border border-slate-300 px-3 py-2"
              value={lRel}
              onChange={(e) => setLRel(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={lPickup} onChange={(e) => setLPickup(e.target.checked)} />
            Puede recoger
          </label>
          <button
            type="submit"
            className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Vincular
          </button>
        </form>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-4 font-medium">Alumno</th>
                <th className="py-2 pr-4 font-medium">Padre / tutor</th>
                <th className="py-2 pr-4 font-medium">Parentesco</th>
                <th className="py-2 pr-4 font-medium">Recogida</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {links.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{r.studentFullName}</td>
                  <td className="py-2 pr-4">{r.parentFullName}</td>
                  <td className="py-2 pr-4">{r.relationship}</td>
                  <td className="py-2 pr-4">{r.canPickup ? 'Sí' : 'No'}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      className="text-sm text-red-700 underline hover:text-red-900"
                      onClick={() => onUnlink(r.id)}
                    >
                      Quitar vínculo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {links.length === 0 && <p className="mt-2 text-slate-500">No hay vínculos registrados.</p>}
        </div>
      </section>
    </div>
  );
}

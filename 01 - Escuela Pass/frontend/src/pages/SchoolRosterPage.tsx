import { type FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTableScroll, DATA_TABLE_HEAD, DATA_TABLE_SEARCH_INPUT } from '@/components/DataTableScroll';
import { DetailModal } from '@/components/DetailModal';
import { type SmartSelectOption, SmartSelect } from '@/components/SmartSelect';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { publicAssetUrl } from '@/lib/asset-url';
import { uploadUserAvatar } from '@/lib/uploads-api';
import { useAuth } from '@/context/useAuth';
import { isPlatformAdmin, isStaff } from '@/lib/roles';

type SchoolRow = { id: string; name: string; code: string };

type GroupRow = {
  id: string;
  name: string;
  grade: string | null;
  shift: string;
  schoolYear: string;
  classroom: string | null;
  capacity: number | null;
  status?: boolean;
};

type StudentRow = {
  id: string;
  userId: string;
  matricula: string;
  groupId: string | null;
  lifecycleStatus?: 'ACTIVO' | 'BAJA' | 'TRASLADO' | 'EGRESADO';
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  canLeaveAlone?: boolean;
  canAccessCampus?: boolean;
  userStatus?: boolean;
};

type TeacherRow = {
  id: string;
  userId: string;
  employeeNumber: string;
  lifecycleStatus?: 'ACTIVO' | 'BAJA' | 'TRASLADO' | 'EGRESADO';
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  canAccessCampus?: boolean;
};

/** Coincide docente por id de fila `teachers` (lo habitual) o por `userId` si el legado guardó el otro UUID. */
function teacherForAssignment(teachers: TeacherRow[], teacherEntityId: string): TeacherRow | undefined {
  const byPk = teachers.find((t) => t.id === teacherEntityId);
  if (byPk) return byPk;
  return teachers.find((t) => t.userId === teacherEntityId);
}

type SubjectRow = {
  id: string;
  name: string;
  code: string;
  educationLevel: string | null;
  gradeScope: string | null;
  area: string | null;
  description: string | null;
};

type TeacherSubjectRow = {
  id: string;
  teacherId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
};

type ParentRow = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  isPrimaryContact: boolean;
  canAccessCampus?: boolean;
  avatarUrl?: string | null;
};

type VehicleRow = {
  id: string;
  parentId: string;
  plate: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  isActive: boolean;
  createdAt: string;
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

type AcademicPeriodRow = {
  id: string;
  schoolId: string;
  schoolYear: string;
  name: string;
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED';
  orderIndex: number;
};

type ClassSessionRow = {
  id: string;
  academicPeriodId: string;
  groupId: string;
  subjectId: string;
  teacherId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  room: string | null;
  isActive: boolean;
};

type LifecycleEventRow = {
  id: string;
  entityType: 'student' | 'teacher';
  personId: string;
  personName: string;
  schoolId: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  effectiveDate: string;
  changedByUserId: string;
  changedByName: string;
  createdAt: string;
};

type PendingDelete =
  | { kind: 'group'; id: string; label: string }
  | { kind: 'student'; id: string; label: string }
  | { kind: 'teacher'; id: string; label: string }
  | { kind: 'parent'; id: string; label: string }
  | { kind: 'assignment'; id: string; label: string }
  | { kind: 'link'; id: string; label: string };

type EditTarget =
  | { kind: 'student'; row: StudentRow }
  | { kind: 'teacher'; row: TeacherRow }
  | { kind: 'parent'; row: ParentRow }
  | { kind: 'group'; row: GroupRow }
  | { kind: 'link'; row: LinkRow };

function rosterInitials(fullName: string): string {
  const n = fullName.trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

function RosterAvatar({
  fullName,
  avatarUrl,
  canUpload,
  busy,
  onPick
}: {
  fullName: string;
  avatarUrl?: string | null;
  canUpload: boolean;
  busy: boolean;
  onPick: (file: File) => void;
}) {
  const src = publicAssetUrl(avatarUrl ?? null);
  return (
    <div className="flex items-center gap-2">
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-200 text-center text-[11px] font-semibold leading-9 text-slate-700">
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : rosterInitials(fullName)}
      </div>
      {canUpload ? (
        <label className="cursor-pointer text-[11px] text-brand-800 underline">
          {busy ? '…' : 'Foto'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onPick(f);
            }}
          />
        </label>
      ) : null}
    </div>
  );
}

function defaultSchoolYear(): string {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  const start = m >= 6 ? y : y - 1;
  return `${start}-${start + 1}`;
}

function shiftLabel(shift: string): string {
  if (shift === 'MATUTINO') return 'Mañana';
  if (shift === 'VESPERTINO') return 'Tarde';
  if (shift === 'NOCTURNO') return 'Noche';
  return shift;
}

function normalizeTableQuery(q: string): string {
  return q.trim().toLowerCase();
}

function lifecycleLabel(v?: string): string {
  if (v === 'ACTIVO') return 'Activo';
  if (v === 'BAJA') return 'Baja';
  if (v === 'TRASLADO') return 'Traslado';
  if (v === 'EGRESADO') return 'Egresado';
  return 'Activo';
}

export function SchoolRosterPage() {
  const { user } = useAuth();
  const platformAdmin = isPlatformAdmin(user);
  const isAdminRole = user?.role === 'ADMIN';
  const canUploadAvatars = isStaff(user);

  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [schoolsReady, setSchoolsReady] = useState(!platformAdmin);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<TeacherSubjectRow[]>([]);
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [lifecycleEvents, setLifecycleEvents] = useState<LifecycleEventRow[]>([]);
  const [nextMatriculaHint, setNextMatriculaHint] = useState<string>('');

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
  const [sPhone, setSPhone] = useState('');
  const [sCanLeaveAlone, setSCanLeaveAlone] = useState(false);
  const [sCanAccessCampus, setSCanAccessCampus] = useState(false);

  const [tEmail, setTEmail] = useState('');
  const [tPass, setTPass] = useState('');
  const [tName, setTName] = useState('');
  const [tNum, setTNum] = useState('');
  const [tPhone, setTPhone] = useState('');
  const [tCanAccessCampus, setTCanAccessCampus] = useState(true);
  const [tSubjectIds, setTSubjectIds] = useState<string[]>([]);
  const [tSubjectQuery, setTSubjectQuery] = useState('');

  const [aTeacher, setATeacher] = useState('');
  const [aGroup, setAGroup] = useState('');
  const [aSubject, setASubject] = useState('');
  const [aCreateSession, setACreateSession] = useState(true);
  const [aPeriod, setAPeriod] = useState('');
  const [aWeekday, setAWeekday] = useState('1');
  const [aStartTime, setAStartTime] = useState('08:00');
  const [aEndTime, setAEndTime] = useState('09:00');
  const [aRoom, setARoom] = useState('');
  const [periods, setPeriods] = useState<AcademicPeriodRow[]>([]);
  const [classSessions, setClassSessions] = useState<ClassSessionRow[]>([]);

  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subLevel, setSubLevel] = useState('');
  const [subGradeScope, setSubGradeScope] = useState('');
  const [subArea, setSubArea] = useState('');
  const [subDescription, setSubDescription] = useState('');

  const [pEmail, setPEmail] = useState('');
  const [pPass, setPPass] = useState('');
  const [pName, setPName] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pPrimary, setPPrimary] = useState(false);

  const [lStudent, setLStudent] = useState('');
  const [lParent, setLParent] = useState('');
  const [lRel, setLRel] = useState('Padre');
  const [lPickup, setLPickup] = useState(true);
  const [lIsPrimary, setLIsPrimary] = useState(false);

  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);
  const [uploadingAvatarUserId, setUploadingAvatarUserId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [confirmDeleting, setConfirmDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editMatricula, setEditMatricula] = useState('');
  const [editEmployeeNumber, setEditEmployeeNumber] = useState('');
  const [editLifecycleStatus, setEditLifecycleStatus] = useState<'ACTIVO' | 'BAJA' | 'TRASLADO' | 'EGRESADO'>('ACTIVO');
  const [editLifecycleReason, setEditLifecycleReason] = useState('');
  const [editLifecycleEffectiveDate, setEditLifecycleEffectiveDate] = useState('');
  const [editCanLeaveAlone, setEditCanLeaveAlone] = useState(false);
  const [editCanAccessCampus, setEditCanAccessCampus] = useState(false);
  const [editIsPrimaryContact, setEditIsPrimaryContact] = useState(false);
  const [editLinkRel, setEditLinkRel] = useState('');
  const [editLinkPickup, setEditLinkPickup] = useState(true);
  const [editLinkIsPrimary, setEditLinkIsPrimary] = useState(false);
  const [editGName, setEditGName] = useState('');
  const [editGGrade, setEditGGrade] = useState('');
  const [editGShift, setEditGShift] = useState('MATUTINO');
  const [editGYear, setEditGYear] = useState('');
  const [editGRoom, setEditGRoom] = useState('');
  const [editGCap, setEditGCap] = useState('');
  const [editGStatus, setEditGStatus] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [downloadingLifecycleCsv, setDownloadingLifecycleCsv] = useState(false);
  const [parentVehicles, setParentVehicles] = useState<VehicleRow[]>([]);
  const [vehicleParentId, setVehicleParentId] = useState<string | null>(null);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehicleActionId, setVehicleActionId] = useState<string | null>(null);

  const [lifecycleAuditSearch, setLifecycleAuditSearch] = useState('');
  const [groupsTableSearch, setGroupsTableSearch] = useState('');
  const [studentsTableSearch, setStudentsTableSearch] = useState('');
  const [studentsGroupFilter, setStudentsGroupFilter] = useState('');
  const [groupCapacitySearch, setGroupCapacitySearch] = useState('');
  const [teachersTableSearch, setTeachersTableSearch] = useState('');
  const [subjectsTableSearch, setSubjectsTableSearch] = useState('');
  const [assignmentsTableSearch, setAssignmentsTableSearch] = useState('');
  const [assignmentsGroupFilter, setAssignmentsGroupFilter] = useState('');
  const [parentsTableSearch, setParentsTableSearch] = useState('');
  const [linksTableSearch, setLinksTableSearch] = useState('');

  const schoolQuery = useMemo(() => {
    if (platformAdmin && selectedSchoolId) return { schoolId: selectedSchoolId };
    return undefined;
  }, [platformAdmin, selectedSchoolId]);
  const canLoad = !platformAdmin || !!selectedSchoolId;

  const schoolOptions = useMemo(
    () => schools.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` })),
    [schools]
  );
  const groupOccupancyById = useMemo(() => {
    const map = new Map<string, number>();
    for (const st of students) {
      if (!st.groupId) continue;
      map.set(st.groupId, (map.get(st.groupId) ?? 0) + 1);
    }
    return map;
  }, [students]);
  const groupCapacityRows = useMemo(
    () =>
      groups.map((g) => {
        const occupied = groupOccupancyById.get(g.id) ?? 0;
        const capacity = g.capacity ?? null;
        const available = capacity != null ? Math.max(0, capacity - occupied) : null;
        const ratio = capacity != null && capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : null;
        const isFull = capacity != null ? occupied >= capacity : false;
        return {
          ...g,
          occupied,
          available,
          ratio,
          isFull
        };
      }),
    [groups, groupOccupancyById]
  );
  const groupOptions = useMemo(
    () => groups.map((g) => ({ value: g.id, label: `${g.name} (${g.schoolYear})` })),
    [groups]
  );
  const assignableGroupOptionsForNewStudent = useMemo(
    () =>
      groupCapacityRows
        .filter((g) => !g.isFull)
        .map((g) => ({
          value: g.id,
          label: `${g.name} (${g.schoolYear})${g.available != null ? ` · ${g.available} cupos` : ''}`
        })),
    [groupCapacityRows]
  );
  const teacherOptions = useMemo(() => teachers.map((t) => ({ value: t.id, label: t.fullName })), [teachers]);
  const subjectOptions = useMemo(
    () =>
      subjects.map((s) => ({
        value: s.id,
        label: `${s.code} · ${s.name}${s.gradeScope ? ` (${s.gradeScope})` : ''}`
      })),
    [subjects]
  );
  const selectedTeacherSubjectLabels = useMemo(() => {
    const byId = new Map(subjectOptions.map((opt) => [opt.value, opt.label]));
    return tSubjectIds
      .map((id) => ({ id, label: byId.get(id) }))
      .filter((row): row is { id: string; label: string } => Boolean(row.label));
  }, [subjectOptions, tSubjectIds]);
  const filteredTeacherSubjectOptions = useMemo(() => {
    const q = tSubjectQuery.trim().toLowerCase();
    if (!q) return subjectOptions;
    return subjectOptions.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [subjectOptions, tSubjectQuery]);
  const teacherSubjectByTeacher = useMemo(() => {
    const map = new Map<string, TeacherSubjectRow[]>();
    for (const row of teacherSubjects) {
      const list = map.get(row.teacherId) ?? [];
      list.push(row);
      map.set(row.teacherId, list);
    }
    return map;
  }, [teacherSubjects]);
  const assignmentSubjectOptions = useMemo(() => {
    if (!aTeacher) return subjectOptions;
    const rows = teacherSubjectByTeacher.get(aTeacher) ?? [];
    if (rows.length === 0) return [];
    return rows.map((r) => ({
      value: r.subjectId,
      label: `${r.subjectCode} · ${r.subjectName}`
    }));
  }, [aTeacher, subjectOptions, teacherSubjectByTeacher]);
  const periodOptions = useMemo(
    () =>
      periods.map((p) => ({
        value: p.id,
        label: `${p.name} · ${p.schoolYear}${p.status === 'ACTIVE' ? ' · activo' : ''}`
      })),
    [periods]
  );
  const assignmentHasActiveSession = useMemo(
    () =>
      classSessions.some(
        (s) =>
          s.isActive &&
          s.teacherId === aTeacher &&
          s.groupId === aGroup &&
          s.subjectId === aSubject
      ),
    [aGroup, aSubject, aTeacher, classSessions]
  );
  const studentsGroupFilterOptions = useMemo(
    (): SmartSelectOption[] => [{ value: '', label: 'Todos los grupos' }, ...groupOptions],
    [groupOptions]
  );
  const assignmentsGroupFilterOptions = useMemo(
    (): SmartSelectOption[] => [{ value: '', label: 'Todos los grupos' }, ...groupOptions],
    [groupOptions]
  );
  const filteredLifecycleEvents = useMemo(() => {
    const q = normalizeTableQuery(lifecycleAuditSearch);
    if (!q) return lifecycleEvents;
    return lifecycleEvents.filter((row) => {
      const blob = [
        row.personName,
        row.reason,
        row.changedByName,
        row.entityType === 'student' ? 'alumno' : 'docente',
        lifecycleLabel(row.fromStatus),
        lifecycleLabel(row.toStatus),
        new Date(row.createdAt).toLocaleString()
      ].join(' ');
      return blob.toLowerCase().includes(q);
    });
  }, [lifecycleEvents, lifecycleAuditSearch]);
  const filteredGroupsTable = useMemo(() => {
    const q = normalizeTableQuery(groupsTableSearch);
    if (!q) return groups;
    return groups.filter((r) => {
      const blob = [
        r.name,
        r.grade ?? '',
        r.schoolYear,
        r.classroom ?? '',
        shiftLabel(r.shift),
        r.status !== false ? 'activo' : 'inactivo'
      ].join(' ');
      return blob.toLowerCase().includes(q);
    });
  }, [groups, groupsTableSearch]);
  const visibleGroupCapacityRows = useMemo(
    () =>
      groupCapacityRows
        .filter((g) => !g.isFull)
        .sort((a, b) => {
          const avA = a.available ?? Number.POSITIVE_INFINITY;
          const avB = b.available ?? Number.POSITIVE_INFINITY;
          return avB - avA;
        }),
    [groupCapacityRows]
  );
  const filteredGroupCapacityRows = useMemo(() => {
    const q = normalizeTableQuery(groupCapacitySearch);
    if (!q) return visibleGroupCapacityRows;
    return visibleGroupCapacityRows.filter((g) => {
      const blob = [g.name, g.grade ?? '', g.schoolYear, shiftLabel(g.shift), String(g.capacity ?? ''), String(g.occupied)].join(
        ' '
      );
      return blob.toLowerCase().includes(q);
    });
  }, [visibleGroupCapacityRows, groupCapacitySearch]);
  const filteredStudentsTable = useMemo(() => {
    let rows = students;
    if (studentsGroupFilter) {
      rows = rows.filter((s) => s.groupId === studentsGroupFilter);
    }
    const q = normalizeTableQuery(studentsTableSearch);
    if (!q) return rows;
    return rows.filter((s) => {
      const blob = [s.fullName, s.matricula, s.email, s.phone ?? '', lifecycleLabel(s.lifecycleStatus)].join(' ');
      return blob.toLowerCase().includes(q);
    });
  }, [students, studentsGroupFilter, studentsTableSearch]);
  const filteredTeachersTable = useMemo(() => {
    const q = normalizeTableQuery(teachersTableSearch);
    if (!q) return teachers;
    return teachers.filter((r) => {
      const subs = (teacherSubjectByTeacher.get(r.id) ?? [])
        .map((x) => `${x.subjectCode} ${x.subjectName}`)
        .join(' ');
      const blob = [r.fullName, r.employeeNumber, r.email, r.phone ?? '', subs, lifecycleLabel(r.lifecycleStatus)].join(' ');
      return blob.toLowerCase().includes(q);
    });
  }, [teacherSubjectByTeacher, teachers, teachersTableSearch]);
  const filteredSubjectsTable = useMemo(() => {
    const q = normalizeTableQuery(subjectsTableSearch);
    if (!q) return subjects;
    return subjects.filter((s) => {
      const blob = [s.code, s.name, s.educationLevel ?? '', s.gradeScope ?? '', s.area ?? '', s.description ?? ''].join(' ');
      return blob.toLowerCase().includes(q);
    });
  }, [subjects, subjectsTableSearch]);
  const filteredAssignmentsTable = useMemo(() => {
    let rows = assignments;
    if (assignmentsGroupFilter) {
      rows = rows.filter((r) => r.groupId === assignmentsGroupFilter);
    }
    const q = normalizeTableQuery(assignmentsTableSearch);
    if (!q) return rows;
    return rows.filter((r) => {
      const te = teacherForAssignment(teachers, r.teacherId);
      const gr = groups.find((g) => g.id === r.groupId);
      const sb = subjects.find((s) => s.id === r.subjectId);
      const blob = [te?.fullName, gr?.name, gr?.schoolYear, sb?.code, sb?.name].filter(Boolean).join(' ');
      return blob.toLowerCase().includes(q);
    });
  }, [assignments, assignmentsGroupFilter, assignmentsTableSearch, groups, subjects, teachers]);
  const filteredParentsTable = useMemo(() => {
    const q = normalizeTableQuery(parentsTableSearch);
    if (!q) return parents;
    return parents.filter((r) => {
      const blob = [r.fullName, r.email, r.phone ?? '', r.isPrimaryContact ? 'contacto principal' : ''].join(' ');
      return blob.toLowerCase().includes(q);
    });
  }, [parents, parentsTableSearch]);
  const filteredLinksTable = useMemo(() => {
    const q = normalizeTableQuery(linksTableSearch);
    if (!q) return links;
    return links.filter((r) => {
      const blob = [r.studentFullName, r.parentFullName, r.relationship, r.canPickup ? 'recogida' : '', r.isPrimary ? 'principal' : ''].join(
        ' '
      );
      return blob.toLowerCase().includes(q);
    });
  }, [links, linksTableSearch]);
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

  const refreshNextMatriculaHint = useCallback(async () => {
    if (!canLoad) {
      setNextMatriculaHint('');
      return;
    }
    try {
      const { data } = await api.get<{ matricula: string }>('/api/v1/school/students/next-matricula', {
        params: schoolQuery
      });
      setNextMatriculaHint(typeof data?.matricula === 'string' ? data.matricula : '');
    } catch {
      setNextMatriculaHint('');
    }
  }, [canLoad, schoolQuery]);

  const refreshAll = useCallback(async () => {
    if (!canLoad) return;
    setError(null);
    try {
      const [g, st, te, pa, asg, lk, sub, tsub, nextMat, lifecycle, periodsRes, sessionsRes] = await Promise.all([
        api.get<GroupRow[]>('/api/v1/school/groups', { params: schoolQuery }),
        api.get<StudentRow[]>('/api/v1/school/students', { params: schoolQuery }),
        api.get<TeacherRow[]>('/api/v1/school/teachers', { params: schoolQuery }),
        api.get<ParentRow[]>('/api/v1/school/parents', { params: schoolQuery }),
        api.get<AssignmentRow[]>('/api/v1/school/teacher-assignments', { params: schoolQuery }),
        api.get<LinkRow[]>('/api/v1/school/student-parent-links', { params: schoolQuery }),
        api.get<SubjectRow[]>('/api/v1/school/subjects', { params: schoolQuery }),
        api.get<TeacherSubjectRow[]>('/api/v1/school/teacher-subjects', { params: schoolQuery }),
        api.get<{ matricula: string }>('/api/v1/school/students/next-matricula', { params: schoolQuery }),
        api.get<LifecycleEventRow[]>('/api/v1/school/lifecycle-events', {
          params: { ...(schoolQuery ?? {}), limit: 120 }
        }),
        api.get<AcademicPeriodRow[]>('/api/v1/academic-periods', { params: schoolQuery }),
        api.get<ClassSessionRow[]>('/api/v1/class-sessions', { params: schoolQuery })
      ]);
      setGroups(Array.isArray(g.data) ? g.data : []);
      setStudents(Array.isArray(st.data) ? st.data : []);
      setTeachers(Array.isArray(te.data) ? te.data : []);
      setParents(Array.isArray(pa.data) ? pa.data : []);
      setAssignments(Array.isArray(asg.data) ? asg.data : []);
      setLinks(Array.isArray(lk.data) ? lk.data : []);
      setSubjects(Array.isArray(sub.data) ? sub.data : []);
      setTeacherSubjects(Array.isArray(tsub.data) ? tsub.data : []);
      setNextMatriculaHint(typeof nextMat.data?.matricula === 'string' ? nextMat.data.matricula : '');
      setLifecycleEvents(Array.isArray(lifecycle.data) ? lifecycle.data : []);
      const periodRows = Array.isArray(periodsRes.data) ? periodsRes.data : [];
      setPeriods(periodRows);
      setClassSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
      setAPeriod((prev) => prev || periodRows.find((p) => p.status === 'ACTIVE')?.id || periodRows[0]?.id || '');
    } catch (e) {
      setError(getUserFacingMessage(e, 'No se pudieron cargar los datos de la escuela.'));
    }
  }, [canLoad, schoolQuery]);

  async function onDownloadLifecycleXlsx() {
    setDownloadingLifecycleCsv(true);
    setError(null);
    try {
      const res = await api.get('/api/v1/school/lifecycle-events/export.xlsx', {
        params: { ...(schoolQuery ?? {}), limit: 3000 },
        responseType: 'blob'
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = 'lifecycle-events.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      setMessage('Export XLSX de auditoría lifecycle descargado.');
    } catch (e) {
      setError(getUserFacingMessage(e, 'No se pudo exportar la auditoría lifecycle.'));
    } finally {
      setDownloadingLifecycleCsv(false);
    }
  }

  async function onUserAvatarFile(userId: string, file: File) {
    setUploadingAvatarUserId(userId);
    setError(null);
    setMessage(null);
    try {
      await uploadUserAvatar(userId, file);
      setMessage('Foto de perfil actualizada.');
      await refreshAll();
    } catch (e) {
      setError(getUserFacingMessage(e, 'No se pudo subir la imagen.'));
    } finally {
      setUploadingAvatarUserId(null);
    }
  }

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
      setSubjects([]);
      setTeacherSubjects([]);
      setLinks([]);
      setAssignments([]);
      setNextMatriculaHint('');
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
        canLeaveAlone: sCanLeaveAlone,
        canAccessCampus: sCanAccessCampus
      };
      if (sPhone.trim()) body.phone = sPhone.trim();
      if (sMat.trim()) body.matricula = sMat.trim();
      if (sGroup) body.groupId = sGroup;
      if (platformAdmin && selectedSchoolId) body.schoolId = selectedSchoolId;
      await api.post('/api/v1/school/students', body);
      setSEmail('');
      setSPass('');
      setSName('');
      setSPhone('');
      setSMat('');
      setSGroup('');
      setSCanLeaveAlone(false);
      setSCanAccessCampus(false);
      setMessage('Alumno registrado.');
      await refreshNextMatriculaHint();
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
    if (tSubjectIds.length === 0) {
      setError('Seleccione al menos una asignatura para el docente.');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        email: tEmail.trim(),
        password: tPass,
        fullName: tName.trim(),
        employeeNumber: tNum.trim(),
        subjectIds: tSubjectIds,
        canAccessCampus: tCanAccessCampus
      };
      if (tPhone.trim()) body.phone = tPhone.trim();
      if (platformAdmin && selectedSchoolId) body.schoolId = selectedSchoolId;
      await api.post('/api/v1/school/teachers', body);
      setTEmail('');
      setTPass('');
      setTName('');
      setTNum('');
      setTPhone('');
      setTCanAccessCampus(true);
      setTSubjectIds([]);
      setTSubjectQuery('');
      setMessage('Docente registrado.');
      await refreshAll();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo registrar el docente.'));
    }
  }

  async function onCreateSubject(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        code: subCode.trim(),
        name: subName.trim()
      };
      if (subLevel.trim()) body.educationLevel = subLevel.trim();
      if (subGradeScope.trim()) body.gradeScope = subGradeScope.trim();
      if (subArea.trim()) body.area = subArea.trim();
      if (subDescription.trim()) body.description = subDescription.trim();
      if (platformAdmin && selectedSchoolId) body.schoolId = selectedSchoolId;
      await api.post('/api/v1/school/subjects', body);
      setSubCode('');
      setSubName('');
      setSubLevel('');
      setSubGradeScope('');
      setSubArea('');
      setSubDescription('');
      setMessage('Asignatura institucional creada.');
      await refreshAll();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo crear la asignatura.'));
    }
  }

  async function onAssignTeacher(e: FormEvent) {
    e.preventDefault();
    if (!aTeacher || !aGroup || !aSubject) return;
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        teacherId: aTeacher,
        groupId: aGroup,
        subjectId: aSubject
      };
      if (platformAdmin && selectedSchoolId) body.schoolId = selectedSchoolId;
      await api.post('/api/v1/school/teacher-assignments', body);
      if (aCreateSession) {
        if (!aPeriod || !aStartTime || !aEndTime) {
          throw new Error('Para que aparezca en horario indique periodo, día y hora.');
        }
        await api.post('/api/v1/class-sessions', {
          schoolId: platformAdmin && selectedSchoolId ? selectedSchoolId : undefined,
          academicPeriodId: aPeriod,
          teacherId: aTeacher,
          groupId: aGroup,
          subjectId: aSubject,
          weekday: Number(aWeekday),
          startTime: aStartTime,
          endTime: aEndTime,
          room: aRoom.trim() || undefined
        });
      }
      setATeacher('');
      setAGroup('');
      setASubject('');
      setARoom('');
      setMessage(aCreateSession ? 'Docente asignado y sesión creada en el horario.' : 'Docente asignado al grupo.');
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
      if (pPhone.trim()) body.phone = pPhone.trim();
      if (platformAdmin && selectedSchoolId) body.schoolId = selectedSchoolId;
      await api.post('/api/v1/school/parents', body);
      setPEmail('');
      setPPass('');
      setPName('');
      setPPhone('');
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
        canPickup: lPickup,
        isPrimary: lIsPrimary
      };
      if (platformAdmin && selectedSchoolId) body.schoolId = selectedSchoolId;
      await api.post('/api/v1/school/student-parent-links', body);
      setLStudent('');
      setLParent('');
      setLRel('Padre');
      setLPickup(true);
      setLIsPrimary(false);
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

  async function onConfirmDelete() {
    if (!pendingDelete) return;
    setConfirmDeleting(true);
    try {
      if (pendingDelete.kind === 'assignment') {
        await onRemoveAssignment(pendingDelete.id);
      } else if (pendingDelete.kind === 'link') {
        await onUnlink(pendingDelete.id);
      } else if (pendingDelete.kind === 'group') {
        await api.delete(`/api/v1/school/groups/${pendingDelete.id}`);
        setMessage('Grupo eliminado.');
        await refreshAll();
      } else if (pendingDelete.kind === 'student') {
        await api.delete(`/api/v1/school/students/${pendingDelete.id}`);
        setMessage('Alumno eliminado.');
        await refreshAll();
      } else if (pendingDelete.kind === 'teacher') {
        await api.delete(`/api/v1/school/teachers/${pendingDelete.id}`);
        setMessage('Docente eliminado.');
        await refreshAll();
      } else if (pendingDelete.kind === 'parent') {
        await api.delete(`/api/v1/school/parents/${pendingDelete.id}`);
        setMessage('Padre/tutor eliminado.');
        await refreshAll();
      }
      setPendingDelete(null);
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo eliminar el registro.'));
    } finally {
      setConfirmDeleting(false);
    }
  }

  function onEditStudent(r: StudentRow) {
    setEditTarget({ kind: 'student', row: r });
    setEditName(r.fullName);
    setEditPhone(r.phone ?? '');
    setEditMatricula(r.matricula);
    setEditEmployeeNumber('');
    setEditLifecycleStatus(r.lifecycleStatus ?? 'ACTIVO');
    setEditLifecycleReason('');
    setEditLifecycleEffectiveDate('');
    setEditCanLeaveAlone(r.canLeaveAlone ?? false);
    setEditCanAccessCampus(r.canAccessCampus ?? false);
    setEditIsPrimaryContact(false);
  }

  function onEditTeacher(r: TeacherRow) {
    setEditTarget({ kind: 'teacher', row: r });
    setEditName(r.fullName);
    setEditPhone(r.phone ?? '');
    setEditMatricula('');
    setEditEmployeeNumber(r.employeeNumber);
    setEditLifecycleStatus(r.lifecycleStatus ?? 'ACTIVO');
    setEditLifecycleReason('');
    setEditLifecycleEffectiveDate('');
    setEditCanLeaveAlone(false);
    setEditCanAccessCampus(r.canAccessCampus ?? false);
    setEditIsPrimaryContact(false);
  }

  function onEditParent(r: ParentRow) {
    setEditTarget({ kind: 'parent', row: r });
    setEditName(r.fullName);
    setEditPhone(r.phone ?? '');
    setEditMatricula('');
    setEditEmployeeNumber('');
    setEditLifecycleStatus('ACTIVO');
    setEditLifecycleReason('');
    setEditLifecycleEffectiveDate('');
    setEditCanLeaveAlone(false);
    setEditCanAccessCampus(r.canAccessCampus ?? false);
    setEditIsPrimaryContact(r.isPrimaryContact);
  }

  function onEditGroup(r: GroupRow) {
    setEditTarget({ kind: 'group', row: r });
    setEditGName(r.name);
    setEditGGrade(r.grade ?? '');
    setEditGShift(r.shift);
    setEditGYear(r.schoolYear);
    setEditGRoom(r.classroom ?? '');
    setEditGCap(r.capacity != null ? String(r.capacity) : '');
    setEditGStatus(r.status !== false);
  }

  function onEditLink(r: LinkRow) {
    setEditTarget({ kind: 'link', row: r });
    setEditLinkRel(r.relationship);
    setEditLinkPickup(r.canPickup);
    setEditLinkIsPrimary(r.isPrimary);
  }

  function closeEditModal() {
    if (savingEdit) return;
    setEditTarget(null);
    setEditName('');
    setEditPhone('');
    setEditMatricula('');
    setEditEmployeeNumber('');
    setEditLifecycleStatus('ACTIVO');
    setEditLifecycleReason('');
    setEditLifecycleEffectiveDate('');
    setEditCanLeaveAlone(false);
    setEditCanAccessCampus(false);
    setEditIsPrimaryContact(false);
    setEditLinkRel('');
    setEditLinkPickup(true);
    setEditLinkIsPrimary(false);
    setEditGName('');
    setEditGGrade('');
    setEditGShift('MATUTINO');
    setEditGYear('');
    setEditGRoom('');
    setEditGCap('');
    setEditGStatus(true);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setMessage(null);
    setError(null);
    setSavingEdit(true);
    try {
      if (editTarget.kind === 'group') {
        const nm = editGName.trim();
        if (!nm) { setError('El nombre del grupo es obligatorio.'); setSavingEdit(false); return; }
        const body: Record<string, unknown> = { name: nm, shift: editGShift, status: editGStatus };
        if (editGGrade.trim()) body.grade = editGGrade.trim();
        if (editGYear.trim()) body.schoolYear = editGYear.trim();
        if (editGRoom.trim()) body.classroom = editGRoom.trim();
        const cap = Number.parseInt(editGCap, 10);
        if (!Number.isNaN(cap) && cap > 0) body.capacity = cap;
        await api.patch(`/api/v1/school/groups/${editTarget.row.id}`, body);
        setMessage('Grupo actualizado.');
        await refreshAll();
        closeEditModal();
        return;
      }
      if (editTarget.kind === 'link') {
        const rel = editLinkRel.trim();
        if (!rel) { setError('El parentesco es obligatorio.'); setSavingEdit(false); return; }
        await api.patch(`/api/v1/school/student-parent-links/${editTarget.row.id}`, {
          relationship: rel,
          canPickup: editLinkPickup,
          isPrimary: editLinkIsPrimary
        });
        setMessage('Vínculo actualizado.');
        await refreshAll();
        closeEditModal();
        return;
      }
      const nextName = editName.trim();
      if (!nextName) { setError('El nombre completo es obligatorio.'); setSavingEdit(false); return; }
      if (editTarget.kind === 'student') {
        const nextMat = editMatricula.trim();
        if (!nextMat) { setError('La matrícula es obligatoria.'); setSavingEdit(false); return; }
        await api.patch(`/api/v1/school/students/${editTarget.row.id}`, {
          fullName: nextName,
          phone: editPhone.trim() || null,
          matricula: nextMat,
          canLeaveAlone: editCanLeaveAlone,
          canAccessCampus: editCanAccessCampus
        });
        const prevLifecycle = editTarget.row.lifecycleStatus ?? 'ACTIVO';
        if (editLifecycleStatus !== prevLifecycle) {
          const reason = editLifecycleReason.trim();
          if (!reason) {
            setError('Para cambiar el estado de vida debe indicar un motivo.');
            setSavingEdit(false);
            return;
          }
          await api.post(`/api/v1/school/students/${editTarget.row.id}/lifecycle-transition`, {
            toStatus: editLifecycleStatus,
            reason,
            effectiveDate: editLifecycleEffectiveDate || undefined
          });
        }
        setMessage('Alumno actualizado.');
      } else if (editTarget.kind === 'teacher') {
        const nextEmployee = editEmployeeNumber.trim();
        if (!nextEmployee) { setError('El número de empleado es obligatorio.'); setSavingEdit(false); return; }
        await api.patch(`/api/v1/school/teachers/${editTarget.row.id}`, {
          fullName: nextName,
          phone: editPhone.trim() || null,
          employeeNumber: nextEmployee,
          canAccessCampus: editCanAccessCampus
        });
        const prevLifecycle = editTarget.row.lifecycleStatus ?? 'ACTIVO';
        if (editLifecycleStatus !== prevLifecycle) {
          const reason = editLifecycleReason.trim();
          if (!reason) {
            setError('Para cambiar el estado de vida debe indicar un motivo.');
            setSavingEdit(false);
            return;
          }
          await api.post(`/api/v1/school/teachers/${editTarget.row.id}/lifecycle-transition`, {
            toStatus: editLifecycleStatus,
            reason,
            effectiveDate: editLifecycleEffectiveDate || undefined
          });
        }
        setMessage('Docente actualizado.');
      } else {
        await api.patch(`/api/v1/school/parents/${editTarget.row.id}`, {
          fullName: nextName,
          phone: editPhone.trim() || null,
          isPrimaryContact: editIsPrimaryContact,
          canAccessCampus: editCanAccessCampus
        });
        setMessage('Padre/tutor actualizado.');
      }
      await refreshAll();
      closeEditModal();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo actualizar el registro.'));
    } finally {
      setSavingEdit(false);
    }
  }

  async function loadParentVehicles(parentId: string) {
    if (vehicleParentId === parentId) { setVehicleParentId(null); setParentVehicles([]); return; }
    setLoadingVehicles(true);
    setVehicleParentId(parentId);
    try {
      const { data } = await api.get<VehicleRow[]>(`/api/v1/parents/vehicles/by-parent/${parentId}`);
      setParentVehicles(Array.isArray(data) ? data : []);
    } catch {
      setParentVehicles([]);
    } finally {
      setLoadingVehicles(false);
    }
  }

  async function onVehicleSetActive(vehicleId: string, isActive: boolean) {
    setVehicleActionId(vehicleId);
    try {
      await api.patch(`/api/v1/parents/vehicles/${vehicleId}/set-active`, { isActive });
      setMessage(isActive ? 'Vehículo activado.' : 'Vehículo desactivado.');
      if (vehicleParentId) {
        const { data } = await api.get<VehicleRow[]>(`/api/v1/parents/vehicles/by-parent/${vehicleParentId}`);
        setParentVehicles(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo actualizar el vehículo.'));
    } finally {
      setVehicleActionId(null);
    }
  }

  async function onVehicleDelete(vehicleId: string) {
    setVehicleActionId(vehicleId);
    try {
      await api.delete(`/api/v1/parents/vehicles/${vehicleId}/admin`);
      setMessage('Vehículo eliminado.');
      setParentVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo eliminar el vehículo.'));
    } finally {
      setVehicleActionId(null);
    }
  }

  if (!schoolsReady || loading) {
    return <p className="text-slate-600 dark:text-slate-300">Cargando plantel y grupos…</p>;
  }

  if (platformAdmin && !selectedSchoolId) {
    return (
      <div className="max-w-3xl animate-fade-in">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Grupos y personas</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Elija una escuela para administrar sus grupos, alumnos, docentes y familias.
        </p>
        {schools.length === 0 ? (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Aún no hay escuelas registradas. Agréguelas desde la sección <strong>Escuelas</strong> del menú.
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
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Grupos y personas</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        Cree grupos, registre alumnos y docentes, asigne docentes a cada grupo y vincule a padres o tutores con sus
        hijos.
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

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Auditoría lifecycle</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Historial consolidado de bajas, traslados, egresos y reactivaciones de alumnos y docentes.
            </p>
          </div>
          <button
            type="button"
            className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
            onClick={() => void onDownloadLifecycleXlsx()}
            disabled={downloadingLifecycleCsv}
          >
            {downloadingLifecycleCsv ? 'Descargando…' : 'Exportar XLSX'}
          </button>
        </div>
        <div className="mt-4">
          <div className="mb-3 flex justify-end">
            <label className="block w-full sm:max-w-xs">
              <span className="sr-only">Buscar en auditoría</span>
              <input
                type="search"
                value={lifecycleAuditSearch}
                onChange={(e) => setLifecycleAuditSearch(e.target.value)}
                placeholder="Buscar persona, motivo, responsable…"
                className={DATA_TABLE_SEARCH_INPUT}
              />
            </label>
          </div>
          <DataTableScroll>
            <table className="min-w-full text-left text-sm">
              <thead className={DATA_TABLE_HEAD}>
                <tr className="border-b border-slate-200 text-slate-600 dark:border-slate-600">
                  <th className="py-2 pr-4 font-medium">Fecha</th>
                  <th className="py-2 pr-4 font-medium">Tipo</th>
                  <th className="py-2 pr-4 font-medium">Persona</th>
                  <th className="py-2 pr-4 font-medium">Transición</th>
                  <th className="py-2 pr-4 font-medium">Motivo</th>
                  <th className="py-2 font-medium">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {filteredLifecycleEvents.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-4">{row.entityType === 'student' ? 'Alumno' : 'Docente'}</td>
                    <td className="py-2 pr-4">{row.personName}</td>
                    <td className="py-2 pr-4">
                      {lifecycleLabel(row.fromStatus)} {'->'} {lifecycleLabel(row.toStatus)}
                    </td>
                    <td className="py-2 pr-4">{row.reason}</td>
                    <td className="py-2">{row.changedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableScroll>
          {lifecycleEvents.length === 0 ? (
            <p className="mt-2 text-slate-500">Sin eventos lifecycle para esta escuela.</p>
          ) : filteredLifecycleEvents.length === 0 ? (
            <p className="mt-2 text-slate-500">Ningún evento coincide con la búsqueda.</p>
          ) : null}
        </div>
      </section>

      <section className="mt-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Grupos</h2>
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
              <option value="MATUTINO">Mañana</option>
              <option value="VESPERTINO">Tarde</option>
              <option value="NOCTURNO">Noche</option>
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
              className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70"
            >
              Crear grupo
            </button>
          </div>
        </form>
        <div className="mt-6">
          <div className="mb-3 flex justify-end">
            <label className="block w-full sm:max-w-xs">
              <span className="sr-only">Buscar grupos</span>
              <input
                type="search"
                value={groupsTableSearch}
                onChange={(e) => setGroupsTableSearch(e.target.value)}
                placeholder="Buscar por nombre, ciclo, aula…"
                className={DATA_TABLE_SEARCH_INPUT}
              />
            </label>
          </div>
          <DataTableScroll>
            <table className="min-w-full text-left text-sm">
              <thead className={DATA_TABLE_HEAD}>
                <tr className="border-b border-slate-200 text-slate-600 dark:border-slate-600">
                  <th className="py-2 pr-4 font-medium">Nombre</th>
                  <th className="py-2 pr-4 font-medium">Grado</th>
                  <th className="py-2 pr-4 font-medium">Turno</th>
                  <th className="py-2 pr-4 font-medium">Ciclo</th>
                  <th className="py-2 pr-4 font-medium">Aula</th>
                  <th className="py-2 pr-4 font-medium">Estado</th>
                  <th className="py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroupsTable.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{r.name}</td>
                    <td className="py-2 pr-4">{r.grade ?? '—'}</td>
                    <td className="py-2 pr-4">{shiftLabel(r.shift)}</td>
                    <td className="py-2 pr-4">{r.schoolYear}</td>
                    <td className="py-2 pr-4">{r.classroom ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <span className={r.status !== false ? 'text-emerald-700' : 'text-slate-500'}>
                        {r.status !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button type="button" className="text-xs text-brand-800 underline" onClick={() => onEditGroup(r)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-700 underline"
                          onClick={() => setPendingDelete({ kind: 'group', id: r.id, label: `${r.name} (${r.schoolYear})` })}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableScroll>
          {groups.length === 0 ? (
            <p className="mt-2 text-slate-500">No hay grupos en esta escuela.</p>
          ) : filteredGroupsTable.length === 0 ? (
            <p className="mt-2 text-slate-500">Ningún grupo coincide con la búsqueda.</p>
          ) : null}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Alumnos</h2>
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
            <span className="text-slate-700">Celular (opcional)</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={sPhone}
              onChange={(e) => setSPhone(e.target.value)}
              placeholder="Ej. +52 555 123 4567"
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Matrícula (opcional)</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={sMat}
              onChange={(e) => setSMat(e.target.value)}
              placeholder={`Se genera automáticamente (ej. ${nextMatriculaHint || 'A-0001'})`}
            />
            <p className="mt-1 text-xs text-slate-500">
              {sMat.trim()
                ? 'Si escribes una matrícula manual, se usará ese valor.'
                : `Sugerida ahora: ${nextMatriculaHint || 'calculando...'}`}
            </p>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-700">Grupo (opcional)</span>
            <div className="mt-1">
              <SmartSelect
                options={assignableGroupOptionsForNewStudent}
                value={sGroup}
                onChange={setSGroup}
                placeholder="— Sin asignar —"
                emptyLabel="No hay grupos con cupo disponible"
              />
            </div>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sCanLeaveAlone} onChange={(e) => setSCanLeaveAlone(e.target.checked)} />
            Puede salir solo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sCanAccessCampus} onChange={(e) => setSCanAccessCampus(e.target.checked)} />
            Acceso al campus habilitado
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70"
            >
              Registrar alumno
            </button>
          </div>
        </form>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          En la tabla puede cambiar el grupo de un alumno ya registrado; el cambio se guarda al elegir otra opción.
        </p>
        <div className="mt-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
            <label className="block w-full text-sm sm:min-w-[14rem] sm:max-w-xs">
              <span className="mb-1 block text-slate-700">Filtrar por grupo</span>
              <SmartSelect
                options={studentsGroupFilterOptions}
                value={studentsGroupFilter}
                onChange={setStudentsGroupFilter}
                placeholder="Todos los grupos"
              />
            </label>
            <label className="block w-full sm:max-w-xs">
              <span className="sr-only">Buscar alumnos</span>
              <input
                type="search"
                value={studentsTableSearch}
                onChange={(e) => setStudentsTableSearch(e.target.value)}
                placeholder="Buscar nombre, matrícula, correo…"
                className={DATA_TABLE_SEARCH_INPUT}
              />
            </label>
          </div>
          <DataTableScroll>
            <table className="min-w-full text-left text-sm">
              <thead className={DATA_TABLE_HEAD}>
                <tr className="border-b border-slate-200 text-slate-600 dark:border-slate-600">
                  <th className="w-28 py-2 pr-2 font-medium">Foto</th>
                  <th className="py-2 pr-4 font-medium">Nombre</th>
                  <th className="py-2 pr-4 font-medium">Matrícula</th>
                  <th className="py-2 pr-4 font-medium">Celular</th>
                  <th className="py-2 pr-4 font-medium">Estado</th>
                  <th className="py-2 pr-4 font-medium">Sale solo</th>
                  <th className="py-2 pr-4 font-medium">Acceso</th>
                  <th className="min-w-[14rem] py-2 font-medium">Grupo</th>
                  <th className="py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudentsTable.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2 align-middle">
                      <RosterAvatar
                        fullName={r.fullName}
                        avatarUrl={r.avatarUrl}
                        canUpload={canUploadAvatars}
                        busy={uploadingAvatarUserId === r.userId}
                        onPick={(file) => void onUserAvatarFile(r.userId, file)}
                      />
                    </td>
                    <td className="py-2 pr-4 align-middle">{r.fullName}</td>
                    <td className="py-2 pr-4 align-middle">{r.matricula}</td>
                    <td className="py-2 pr-4 align-middle">{r.phone?.trim() ? r.phone : '—'}</td>
                    <td className="py-2 pr-4 align-middle">{lifecycleLabel(r.lifecycleStatus)}</td>
                    <td className="py-2 pr-4 align-middle">{r.canLeaveAlone ? 'Sí' : 'No'}</td>
                    <td className="py-2 pr-4 align-middle">{r.canAccessCampus ? 'Sí' : 'No'}</td>
                    <td className="py-2 align-middle">
                      {(() => {
                        const selectableGroups = groupCapacityRows.filter(
                          (g) => !g.isFull || g.id === r.groupId
                        );
                        return (
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
                            {selectableGroups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name} ({g.schoolYear})
                                {g.available != null ? ` · ${g.available} cupos` : ''}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </td>
                    <td className="py-2 align-middle">
                      <div className="flex gap-2">
                        <button type="button" className="text-xs text-brand-800 underline" onClick={() => void onEditStudent(r)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-700 underline"
                          onClick={() => setPendingDelete({ kind: 'student', id: r.id, label: r.fullName })}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableScroll>
          {students.length === 0 ? (
            <p className="mt-2 text-slate-500">No hay alumnos registrados.</p>
          ) : filteredStudentsTable.length === 0 ? (
            <p className="mt-2 text-slate-500">Ningún alumno coincide con el filtro.</p>
          ) : null}
        </div>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Grupos con cupo disponible</h3>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
              {visibleGroupCapacityRows.length} de {groupCapacityRows.length} con espacio
            </span>
          </div>
          <div className="mb-3 flex justify-end">
            <label className="block w-full sm:max-w-xs">
              <span className="sr-only">Buscar en cupos</span>
              <input
                type="search"
                value={groupCapacitySearch}
                onChange={(e) => setGroupCapacitySearch(e.target.value)}
                placeholder="Buscar grupo…"
                className={DATA_TABLE_SEARCH_INPUT}
              />
            </label>
          </div>
          <DataTableScroll>
            <table className="min-w-full text-left text-sm">
              <thead className={DATA_TABLE_HEAD}>
                <tr className="border-b border-slate-200 text-slate-600 dark:border-slate-600">
                  <th className="py-2 pr-4 font-medium">Grupo</th>
                  <th className="py-2 pr-4 font-medium">Turno</th>
                  <th className="py-2 pr-4 font-medium">Capacidad</th>
                  <th className="py-2 pr-4 font-medium">Ocupados</th>
                  <th className="py-2 pr-4 font-medium">Disponibles</th>
                  <th className="py-2 font-medium">Uso</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroupCapacityRows.map((g) => (
                  <tr key={g.id} className="border-b border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-900">
                    <td className="py-2 pr-4">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{g.name}</p>
                        <p className="text-xs text-slate-500">
                          {g.grade ?? '—'} · {g.schoolYear}
                        </p>
                      </div>
                    </td>
                    <td className="py-2 pr-4">{shiftLabel(g.shift)}</td>
                    <td className="py-2 pr-4">{g.capacity ?? 'Sin límite'}</td>
                    <td className="py-2 pr-4">{g.occupied}</td>
                    <td className="py-2 pr-4">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        {g.available ?? 'Ilimitado'}
                      </span>
                    </td>
                    <td className="py-2">
                      {g.ratio != null ? (
                        <div className="w-36">
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full ${g.ratio >= 85 ? 'bg-amber-500' : 'bg-brand-700'}`}
                              style={{ width: `${g.ratio}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{g.ratio}%</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Sin tope</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableScroll>
          {visibleGroupCapacityRows.length === 0 ? (
            <p className="mt-2 text-slate-500">No hay grupos con cupo disponible en este momento.</p>
          ) : filteredGroupCapacityRows.length === 0 ? (
            <p className="mt-2 text-slate-500">Ningún grupo coincide con la búsqueda.</p>
          ) : null}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Docentes</h2>
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
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-700">Celular</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={tPhone}
              onChange={(e) => setTPhone(e.target.value)}
              placeholder="Ej. +52 555 123 4567"
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={tCanAccessCampus} onChange={(e) => setTCanAccessCampus(e.target.checked)} />
            Acceso al campus habilitado (entradas, credenciales, escáner)
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-700">Asignaturas del docente (una o varias)</span>
            <input
              type="text"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={tSubjectQuery}
              onChange={(e) => setTSubjectQuery(e.target.value)}
              placeholder="Buscar asignatura por código o nombre"
            />
            <div className="mt-2 max-h-44 overflow-y-auto rounded border border-slate-300 bg-white p-2">
              {filteredTeacherSubjectOptions.length === 0 ? (
                <p className="px-1 py-2 text-xs text-slate-500">No hay asignaturas que coincidan.</p>
              ) : (
                <ul className="space-y-1">
                  {filteredTeacherSubjectOptions.map((s) => {
                    const checked = tSubjectIds.includes(s.value);
                    return (
                      <li key={s.value}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const nextChecked = e.target.checked;
                              setTSubjectIds((prev) => {
                                if (nextChecked) {
                                  if (prev.includes(s.value)) return prev;
                                  return [...prev, s.value];
                                }
                                return prev.filter((id) => id !== s.value);
                              });
                            }}
                          />
                          <span className="text-slate-700">{s.label}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {selectedTeacherSubjectLabels.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedTeacherSubjectLabels.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs text-brand-900"
                  >
                    {item.label}
                    <button
                      type="button"
                      className="font-semibold leading-none"
                      onClick={() => setTSubjectIds((prev) => prev.filter((id) => id !== item.id))}
                      aria-label={`Quitar ${item.label}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Seleccione al menos una asignatura.</p>
            )}
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70"
            >
              Registrar docente
            </button>
          </div>
        </form>
        <div className="mt-6">
          <div className="mb-3 flex justify-end">
            <label className="block w-full sm:max-w-xs">
              <span className="sr-only">Buscar docentes</span>
              <input
                type="search"
                value={teachersTableSearch}
                onChange={(e) => setTeachersTableSearch(e.target.value)}
                placeholder="Buscar nombre, empleado, correo…"
                className={DATA_TABLE_SEARCH_INPUT}
              />
            </label>
          </div>
          <DataTableScroll>
            <table className="min-w-full text-left text-sm">
              <thead className={DATA_TABLE_HEAD}>
                <tr className="border-b border-slate-200 text-slate-600 dark:border-slate-600">
                  <th className="w-28 py-2 pr-2 font-medium">Foto</th>
                  <th className="py-2 pr-4 font-medium">Nombre</th>
                  <th className="py-2 pr-4 font-medium">No. empleado</th>
                  <th className="py-2 pr-4 font-medium">Asignaturas</th>
                  <th className="py-2 pr-4 font-medium">Celular</th>
                  <th className="py-2 pr-4 font-medium">Estado</th>
                  <th className="py-2 pr-4 font-medium">Campus</th>
                  <th className="py-2 pr-4 font-medium">Correo</th>
                  <th className="py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachersTable.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2 align-middle">
                      <RosterAvatar
                        fullName={r.fullName}
                        avatarUrl={r.avatarUrl}
                        canUpload={canUploadAvatars}
                        busy={uploadingAvatarUserId === r.userId}
                        onPick={(file) => void onUserAvatarFile(r.userId, file)}
                      />
                    </td>
                    <td className="py-2 pr-4">{r.fullName}</td>
                    <td className="py-2 pr-4">{r.employeeNumber}</td>
                    <td className="py-2 pr-4">
                      {(teacherSubjectByTeacher.get(r.id) ?? []).length > 0
                        ? (teacherSubjectByTeacher.get(r.id) ?? [])
                            .map((x) => `${x.subjectCode} · ${x.subjectName}`)
                            .join(', ')
                        : '—'}
                    </td>
                    <td className="py-2 pr-4">{r.phone?.trim() ? r.phone : '—'}</td>
                    <td className="py-2 pr-4">{lifecycleLabel(r.lifecycleStatus)}</td>
                    <td className="py-2 pr-4">{r.canAccessCampus ? 'Sí' : 'No'}</td>
                    <td className="py-2">{r.email}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button type="button" className="text-xs text-brand-800 underline" onClick={() => void onEditTeacher(r)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-700 underline"
                          onClick={() => setPendingDelete({ kind: 'teacher', id: r.id, label: r.fullName })}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableScroll>
          {teachers.length === 0 ? (
            <p className="mt-2 text-slate-500">No hay docentes registrados.</p>
          ) : filteredTeachersTable.length === 0 ? (
            <p className="mt-2 text-slate-500">Ningún docente coincide con la búsqueda.</p>
          ) : null}
        </div>
      </section>

      {isAdminRole && (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Asignaturas institucionales</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Defina un catalogo formal de materias con codigo, nivel, grado objetivo y area academica.
          </p>
          <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={onCreateSubject}>
            <label className="text-sm">
              <span className="text-slate-700">Codigo</span>
              <input
                required
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={subCode}
                onChange={(e) => setSubCode(e.target.value)}
                placeholder="Ej. MAT-101"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-slate-700">Nombre</span>
              <input
                required
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                placeholder="Ej. Matematicas aplicadas"
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-700">Nivel</span>
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={subLevel}
                onChange={(e) => setSubLevel(e.target.value)}
                placeholder="Primaria, Secundaria..."
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-700">Grado objetivo</span>
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={subGradeScope}
                onChange={(e) => setSubGradeScope(e.target.value)}
                placeholder="6°, 9°, Bachillerato..."
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-700">Area academica</span>
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={subArea}
                onChange={(e) => setSubArea(e.target.value)}
                placeholder="Ciencias, Tecnologia..."
              />
            </label>
            <label className="text-sm lg:col-span-3">
              <span className="text-slate-700">Descripcion (opcional)</span>
              <textarea
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                rows={2}
                value={subDescription}
                onChange={(e) => setSubDescription(e.target.value)}
              />
            </label>
            <div className="lg:col-span-3">
              <button
                type="submit"
                className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70"
              >
                Crear asignatura
              </button>
            </div>
          </form>
          <div className="mt-6">
            <div className="mb-3 flex justify-end">
              <label className="block w-full sm:max-w-xs">
                <span className="sr-only">Buscar asignaturas</span>
                <input
                  type="search"
                  value={subjectsTableSearch}
                  onChange={(e) => setSubjectsTableSearch(e.target.value)}
                  placeholder="Buscar código, nombre, área…"
                  className={DATA_TABLE_SEARCH_INPUT}
                />
              </label>
            </div>
            <DataTableScroll>
              <table className="min-w-full text-left text-sm">
                <thead className={DATA_TABLE_HEAD}>
                  <tr className="border-b border-slate-200 text-slate-600 dark:border-slate-600">
                    <th className="py-2 pr-4 font-medium">Codigo</th>
                    <th className="py-2 pr-4 font-medium">Nombre</th>
                    <th className="py-2 pr-4 font-medium">Nivel</th>
                    <th className="py-2 pr-4 font-medium">Grado</th>
                    <th className="py-2 font-medium">Area</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubjectsTable.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-900">{s.code}</td>
                      <td className="py-2 pr-4">{s.name}</td>
                      <td className="py-2 pr-4">{s.educationLevel ?? '—'}</td>
                      <td className="py-2 pr-4">{s.gradeScope ?? '—'}</td>
                      <td className="py-2">{s.area ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableScroll>
            {subjects.length === 0 ? (
              <p className="mt-2 text-slate-500">No hay asignaturas creadas.</p>
            ) : filteredSubjectsTable.length === 0 ? (
              <p className="mt-2 text-slate-500">Ninguna asignatura coincide con la búsqueda.</p>
            ) : null}
          </div>
        </section>
      )}

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Docentes en grupos</h2>
        <p className="mt-1 text-sm text-slate-600">
          En una operación real, asignar docente + grupo + asignatura no basta: debe existir al menos una sesión con día
          y hora para que aparezca en el horario del alumno y del docente.
        </p>
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
          <label className="text-sm">
            <span className="text-slate-700">Asignatura</span>
            <div className="mt-1 min-w-[14rem]">
              <SmartSelect
                options={assignmentSubjectOptions}
                value={aSubject}
                onChange={setASubject}
                placeholder={aTeacher ? '— Elegir —' : 'Primero elige docente'}
                emptyLabel={
                  aTeacher
                    ? 'Este docente no tiene asignaturas cargadas'
                    : 'Selecciona docente para ver asignaturas'
                }
              />
            </div>
          </label>
          <button
            type="submit"
            disabled={!aTeacher || !aGroup || !aSubject || (aCreateSession && (!aPeriod || !aStartTime || !aEndTime))}
            className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70"
          >
            Asignar
          </button>
        </form>
        {aTeacher && aGroup && aSubject && assignmentHasActiveSession ? (
          <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Esta relación ya tiene sesión activa en horario. Puede asignar sin crear otra sesión si solo desea permisos
            de gestión.
          </p>
        ) : null}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-start gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={aCreateSession}
              onChange={(e) => setACreateSession(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>
              Crear también la sesión de horario para alumnos y docente
              <span className="block text-xs text-slate-500">
                Desmarque solo si ya existe un horario o está registrando una asignación administrativa sin clase.
              </span>
            </span>
          </label>
          {aCreateSession ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-5">
              <label className="text-sm sm:col-span-2">
                <span className="text-slate-700">Periodo</span>
                <div className="mt-1">
                  <SmartSelect
                    options={periodOptions}
                    value={aPeriod}
                    onChange={setAPeriod}
                    placeholder="— Periodo —"
                    emptyLabel="No hay periodos académicos"
                  />
                </div>
              </label>
              <label className="text-sm">
                <span className="text-slate-700">Día</span>
                <select
                  value={aWeekday}
                  onChange={(e) => setAWeekday(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                >
                  <option value="1">Lunes</option>
                  <option value="2">Martes</option>
                  <option value="3">Miércoles</option>
                  <option value="4">Jueves</option>
                  <option value="5">Viernes</option>
                  <option value="6">Sábado</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-slate-700">Inicio</span>
                <input
                  type="time"
                  value={aStartTime}
                  onChange={(e) => setAStartTime(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-700">Fin</span>
                <input
                  type="time"
                  value={aEndTime}
                  onChange={(e) => setAEndTime(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="text-slate-700">Aula (opcional)</span>
                <input
                  value={aRoom}
                  onChange={(e) => setARoom(e.target.value)}
                  maxLength={80}
                  placeholder="Ej. A-101"
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
          ) : null}
        </div>
        <div className="mt-6">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
            <label className="block w-full text-sm sm:min-w-[14rem] sm:max-w-xs">
              <span className="mb-1 block text-slate-700">Filtrar por grupo</span>
              <SmartSelect
                options={assignmentsGroupFilterOptions}
                value={assignmentsGroupFilter}
                onChange={setAssignmentsGroupFilter}
                placeholder="Todos los grupos"
              />
            </label>
            <label className="block w-full sm:max-w-xs">
              <span className="sr-only">Buscar asignaciones</span>
              <input
                type="search"
                value={assignmentsTableSearch}
                onChange={(e) => setAssignmentsTableSearch(e.target.value)}
                placeholder="Buscar docente, grupo, materia…"
                className={DATA_TABLE_SEARCH_INPUT}
              />
            </label>
          </div>
          <DataTableScroll>
            <table className="min-w-full text-left text-sm">
              <thead className={DATA_TABLE_HEAD}>
                <tr className="border-b border-slate-200 text-slate-600 dark:border-slate-600">
                  <th className="py-2 pr-4 font-medium">Docente</th>
                  <th className="py-2 pr-4 font-medium">Grupo</th>
                  <th className="py-2 pr-4 font-medium">Asignatura</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filteredAssignmentsTable.map((r) => {
                  const te = teacherForAssignment(teachers, r.teacherId);
                  const gr = groups.find((g) => g.id === r.groupId);
                  const sb = subjects.find((s) => s.id === r.subjectId);
                  return (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4">{te?.fullName ?? r.teacherId}</td>
                      <td className="py-2 pr-4">{gr ? `${gr.name} (${gr.schoolYear})` : r.groupId}</td>
                      <td className="py-2 pr-4">{sb ? `${sb.code} · ${sb.name}` : r.subjectId ?? '—'}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          className="text-sm text-red-700 underline hover:text-red-900"
                          onClick={() =>
                            setPendingDelete({
                              kind: 'assignment',
                              id: r.id,
                              label: `${te?.fullName ?? 'Docente'} / ${gr ? `${gr.name} (${gr.schoolYear})` : r.groupId}`
                            })
                          }
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTableScroll>
          {assignments.length === 0 ? (
            <p className="mt-2 text-slate-500">No hay asignaciones.</p>
          ) : filteredAssignmentsTable.length === 0 ? (
            <p className="mt-2 text-slate-500">Ninguna asignación coincide con el filtro.</p>
          ) : null}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Padres y tutores</h2>
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
          <label className="text-sm">
            <span className="text-slate-700">Celular</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={pPhone}
              onChange={(e) => setPPhone(e.target.value)}
              placeholder="Ej. +52 555 123 4567"
            />
          </label>
          <label className="mt-4 flex items-center gap-2 text-sm sm:col-span-1">
            <input type="checkbox" checked={pPrimary} onChange={(e) => setPPrimary(e.target.checked)} />
            Contacto principal
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70"
            >
              Crear perfil de padre/tutor
            </button>
          </div>
        </form>
        <div className="mt-6">
          <div className="mb-3 flex justify-end">
            <label className="block w-full sm:max-w-xs">
              <span className="sr-only">Buscar padres</span>
              <input
                type="search"
                value={parentsTableSearch}
                onChange={(e) => setParentsTableSearch(e.target.value)}
                placeholder="Buscar nombre, correo, teléfono…"
                className={DATA_TABLE_SEARCH_INPUT}
              />
            </label>
          </div>
          <DataTableScroll>
            <table className="min-w-full text-left text-sm">
              <thead className={DATA_TABLE_HEAD}>
                <tr className="border-b border-slate-200 text-slate-600 dark:border-slate-600">
                  <th className="w-28 py-2 pr-2 font-medium">Foto</th>
                  <th className="py-2 pr-4 font-medium">Nombre</th>
                  <th className="py-2 pr-4 font-medium">Correo</th>
                  <th className="py-2 pr-4 font-medium">Celular</th>
                  <th className="py-2 pr-4 font-medium">Principal</th>
                  <th className="py-2 pr-4 font-medium">Acceso</th>
                  <th className="py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredParentsTable.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="border-b border-slate-100">
                      <td className="py-2 pr-2 align-middle">
                        <RosterAvatar
                          fullName={r.fullName}
                          avatarUrl={r.avatarUrl}
                          canUpload={canUploadAvatars}
                          busy={uploadingAvatarUserId === r.userId}
                          onPick={(file) => void onUserAvatarFile(r.userId, file)}
                        />
                      </td>
                      <td className="py-2 pr-4">{r.fullName}</td>
                      <td className="py-2 pr-4">{r.email}</td>
                      <td className="py-2 pr-4">{r.phone?.trim() ? r.phone : '—'}</td>
                      <td className="py-2 pr-4">{r.isPrimaryContact ? 'Sí' : '—'}</td>
                      <td className="py-2 pr-4">{r.canAccessCampus ? 'Sí' : 'No'}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="text-xs text-brand-800 underline" onClick={() => void onEditParent(r)}>
                            Editar
                          </button>
                          <button
                            type="button"
                            className="text-xs text-slate-600 underline"
                            onClick={() => void loadParentVehicles(r.id)}
                          >
                            {vehicleParentId === r.id ? 'Ocultar vehículos' : 'Vehículos'}
                          </button>
                          <button
                            type="button"
                            className="text-xs text-red-700 underline"
                            onClick={() => setPendingDelete({ kind: 'parent', id: r.id, label: r.fullName })}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                    {vehicleParentId === r.id && (
                      <tr key={`${r.id}-vehicles`}>
                        <td colSpan={7} className="bg-slate-50 px-4 pb-3 pt-2 dark:bg-slate-800/50">
                          {loadingVehicles ? (
                            <p className="text-xs text-slate-500">Cargando vehículos…</p>
                          ) : parentVehicles.length === 0 ? (
                            <p className="text-xs text-slate-500">Este padre/tutor no tiene vehículos registrados.</p>
                          ) : (
                            <div className="max-h-48 overflow-auto rounded border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
                              <table className="w-full text-xs">
                                <thead className={DATA_TABLE_HEAD}>
                                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-600">
                                    <th className="py-1 pr-3 font-medium text-left">Placa</th>
                                    <th className="py-1 pr-3 font-medium text-left">Marca / Modelo</th>
                                    <th className="py-1 pr-3 font-medium text-left">Color / Año</th>
                                    <th className="py-1 pr-3 font-medium text-left">Estado</th>
                                    <th className="py-1 font-medium text-left">Acciones</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {parentVehicles.map((v) => (
                                    <tr key={v.id} className="border-b border-slate-100">
                                      <td className="py-1 pr-3 font-mono font-semibold">{v.plate}</td>
                                      <td className="py-1 pr-3">{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</td>
                                      <td className="py-1 pr-3">{[v.color, v.year ? String(v.year) : null].filter(Boolean).join(', ') || '—'}</td>
                                      <td className="py-1 pr-3">
                                        <span className={v.isActive ? 'text-emerald-700' : 'text-red-600'}>
                                          {v.isActive ? 'Activo' : 'Inactivo'}
                                        </span>
                                      </td>
                                      <td className="py-1">
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            disabled={vehicleActionId === v.id}
                                            className="underline disabled:opacity-50"
                                            onClick={() => void onVehicleSetActive(v.id, !v.isActive)}
                                          >
                                            {v.isActive ? 'Desactivar' : 'Activar'}
                                          </button>
                                          <button
                                            type="button"
                                            disabled={vehicleActionId === v.id}
                                            className="text-red-700 underline disabled:opacity-50"
                                            onClick={() => void onVehicleDelete(v.id)}
                                          >
                                            Eliminar
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </DataTableScroll>
          {parents.length === 0 ? (
            <p className="mt-2 text-slate-500">No hay padres/tutores registrados.</p>
          ) : filteredParentsTable.length === 0 ? (
            <p className="mt-2 text-slate-500">Ningún contacto coincide con la búsqueda.</p>
          ) : null}
        </div>
      </section>

      <section className="mt-8 mb-12 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Vincular padre o tutor con alumno</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Elija un alumno y un padre o tutor ya registrados en esta escuela e indique el parentesco.
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={lIsPrimary} onChange={(e) => setLIsPrimary(e.target.checked)} />
            Vínculo principal
          </label>
          <button
            type="submit"
            className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70"
          >
            Vincular
          </button>
        </form>
        <div className="mt-6">
          <div className="mb-3 flex justify-end">
            <label className="block w-full sm:max-w-xs">
              <span className="sr-only">Buscar vínculos</span>
              <input
                type="search"
                value={linksTableSearch}
                onChange={(e) => setLinksTableSearch(e.target.value)}
                placeholder="Buscar alumno, tutor, parentesco…"
                className={DATA_TABLE_SEARCH_INPUT}
              />
            </label>
          </div>
          <DataTableScroll>
            <table className="min-w-full text-left text-sm">
              <thead className={DATA_TABLE_HEAD}>
                <tr className="border-b border-slate-200 text-slate-600 dark:border-slate-600">
                  <th className="py-2 pr-4 font-medium">Alumno</th>
                  <th className="py-2 pr-4 font-medium">Padre / tutor</th>
                  <th className="py-2 pr-4 font-medium">Parentesco</th>
                  <th className="py-2 pr-4 font-medium">Recogida</th>
                  <th className="py-2 pr-4 font-medium">Principal</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filteredLinksTable.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{r.studentFullName}</td>
                    <td className="py-2 pr-4">{r.parentFullName}</td>
                    <td className="py-2 pr-4">{r.relationship}</td>
                    <td className="py-2 pr-4">{r.canPickup ? 'Sí' : 'No'}</td>
                    <td className="py-2 pr-4">{r.isPrimary ? 'Sí' : '—'}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs text-brand-800 underline"
                          onClick={() => onEditLink(r)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-700 underline hover:text-red-900"
                          onClick={() =>
                            setPendingDelete({
                              kind: 'link',
                              id: r.id,
                              label: `${r.studentFullName} ↔ ${r.parentFullName}`
                            })
                          }
                        >
                          Quitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableScroll>
          {links.length === 0 ? (
            <p className="mt-2 text-slate-500">No hay vínculos registrados.</p>
          ) : filteredLinksTable.length === 0 ? (
            <p className="mt-2 text-slate-500">Ningún vínculo coincide con la búsqueda.</p>
          ) : null}
        </div>
      </section>
      <ConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete?.kind === 'assignment'
            ? 'Quitar asignación docente'
            : pendingDelete?.kind === 'link'
              ? 'Quitar vínculo familia-alumno'
              : 'Eliminar registro'
        }
        description={
          pendingDelete
            ? `Esta acción eliminará "${pendingDelete.label}". Puede afectar la operación diaria y no se puede deshacer fácilmente.`
            : ''
        }
        confirmLabel="Sí, eliminar"
        busy={confirmDeleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void onConfirmDelete()}
      />
      <DetailModal
        open={editTarget !== null}
        title={
          editTarget?.kind === 'student'
            ? 'Editar alumno'
            : editTarget?.kind === 'teacher'
              ? 'Editar docente'
              : editTarget?.kind === 'parent'
                ? 'Editar padre/tutor'
                : editTarget?.kind === 'group'
                  ? 'Editar grupo'
                  : 'Editar vínculo'
        }
        subtitle={
          editTarget?.kind === 'link'
            ? `${editTarget.row.studentFullName} ↔ ${editTarget.row.parentFullName}`
            : editTarget?.kind === 'group'
              ? editTarget.row.schoolYear
              : (editTarget?.row as { email?: string } | undefined)?.email ?? ''
        }
        onClose={closeEditModal}
        footer={
          <>
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={closeEditModal}
              disabled={savingEdit}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="roster-edit-form"
              className="rounded bg-brand-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-60"
              disabled={savingEdit}
            >
              {savingEdit ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </>
        }
      >
        <form id="roster-edit-form" className="space-y-3" onSubmit={onSaveEdit}>
          {editTarget?.kind === 'group' ? (
            <>
              <label className="block text-sm">
                <span className="text-slate-700">Nombre del grupo</span>
                <input required className="mt-1 w-full rounded border border-slate-300 px-3 py-2" value={editGName} onChange={(ev) => setEditGName(ev.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="text-slate-700">Grado (opcional)</span>
                <input className="mt-1 w-full rounded border border-slate-300 px-3 py-2" value={editGGrade} onChange={(ev) => setEditGGrade(ev.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="text-slate-700">Turno</span>
                <select className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2" value={editGShift} onChange={(ev) => setEditGShift(ev.target.value)}>
                  <option value="MATUTINO">Mañana</option>
                  <option value="VESPERTINO">Tarde</option>
                  <option value="NOCTURNO">Noche</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-700">Ciclo escolar</span>
                <input className="mt-1 w-full rounded border border-slate-300 px-3 py-2" value={editGYear} onChange={(ev) => setEditGYear(ev.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="text-slate-700">Aula (opcional)</span>
                <input className="mt-1 w-full rounded border border-slate-300 px-3 py-2" value={editGRoom} onChange={(ev) => setEditGRoom(ev.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="text-slate-700">Cupo (opcional)</span>
                <input type="number" min={1} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" value={editGCap} onChange={(ev) => setEditGCap(ev.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editGStatus} onChange={(ev) => setEditGStatus(ev.target.checked)} />
                Grupo activo
              </label>
            </>
          ) : editTarget?.kind === 'link' ? (
            <>
              <label className="block text-sm">
                <span className="text-slate-700">Parentesco</span>
                <input required className="mt-1 w-full rounded border border-slate-300 px-3 py-2" value={editLinkRel} onChange={(ev) => setEditLinkRel(ev.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editLinkPickup} onChange={(ev) => setEditLinkPickup(ev.target.checked)} />
                Puede recoger al alumno
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editLinkIsPrimary} onChange={(ev) => setEditLinkIsPrimary(ev.target.checked)} />
                Vínculo principal
              </label>
            </>
          ) : (
            <>
              <label className="block text-sm">
                <span className="text-slate-700">Nombre completo</span>
                <input
                  required
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  value={editName}
                  onChange={(ev) => setEditName(ev.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-700">Celular (opcional)</span>
                <input
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  value={editPhone}
                  onChange={(ev) => setEditPhone(ev.target.value)}
                  placeholder="Ej. +52 555 123 4567"
                />
              </label>
              {editTarget?.kind === 'student' ? (
                <>
                  <label className="block text-sm">
                    <span className="text-slate-700">Matrícula</span>
                    <input required className="mt-1 w-full rounded border border-slate-300 px-3 py-2" value={editMatricula} onChange={(ev) => setEditMatricula(ev.target.value)} />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editCanLeaveAlone} onChange={(ev) => setEditCanLeaveAlone(ev.target.checked)} />
                    Puede salir solo
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editCanAccessCampus} onChange={(ev) => setEditCanAccessCampus(ev.target.checked)} />
                    Acceso al campus habilitado
                  </label>
                </>
              ) : null}
              {editTarget?.kind === 'teacher' ? (
                <>
                  <label className="block text-sm">
                    <span className="text-slate-700">Número de empleado</span>
                    <input
                      required
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      value={editEmployeeNumber}
                      onChange={(ev) => setEditEmployeeNumber(ev.target.value)}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editCanAccessCampus} onChange={(ev) => setEditCanAccessCampus(ev.target.checked)} />
                    Acceso al campus habilitado
                  </label>
                </>
              ) : null}
              {editTarget?.kind === 'parent' ? (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editIsPrimaryContact} onChange={(ev) => setEditIsPrimaryContact(ev.target.checked)} />
                    Contacto principal
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editCanAccessCampus} onChange={(ev) => setEditCanAccessCampus(ev.target.checked)} />
                    Acceso al campus habilitado
                  </label>
                </>
              ) : null}
              {editTarget?.kind === 'student' || editTarget?.kind === 'teacher' ? (
                <>
                  <label className="block text-sm">
                    <span className="text-slate-700">Estado de vida</span>
                    <select
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                      value={editLifecycleStatus}
                      onChange={(ev) =>
                        setEditLifecycleStatus(ev.target.value as 'ACTIVO' | 'BAJA' | 'TRASLADO' | 'EGRESADO')
                      }
                    >
                      <option value="ACTIVO">Activo</option>
                      <option value="BAJA">Baja</option>
                      <option value="TRASLADO">Traslado</option>
                      <option value="EGRESADO">Egresado</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-700">Motivo de transición (si cambia estado)</span>
                    <textarea
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                      rows={2}
                      value={editLifecycleReason}
                      onChange={(ev) => setEditLifecycleReason(ev.target.value)}
                      placeholder="Ej. Baja administrativa por retiro voluntario"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-700">Fecha efectiva (opcional)</span>
                    <input
                      type="date"
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                      value={editLifecycleEffectiveDate}
                      onChange={(ev) => setEditLifecycleEffectiveDate(ev.target.value)}
                    />
                  </label>
                </>
              ) : null}
            </>
          )}
        </form>
      </DetailModal>
    </div>
  );
}

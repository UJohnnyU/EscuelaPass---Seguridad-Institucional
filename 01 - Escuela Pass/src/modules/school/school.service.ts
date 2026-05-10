import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { readFileSync } from 'fs';
import ExcelJS, { DataValidation } from 'exceljs';
import { extname } from 'path';
import { IsNull, Repository } from 'typeorm';
import { resolveUploadFile } from '../../lib/uploads-path';
import { GroupEntity } from '../../database/entities/group.entity';
import { ImportJobEntity } from '../../database/entities/import-job.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { SchoolEntity } from '../../database/entities/school.entity';
import { ShiftType } from '../../database/entities/shift-type.enum';
import { StudentParentEntity } from '../../database/entities/student-parent.entity';
import { StudentLifecycleEventEntity } from '../../database/entities/student-lifecycle-event.entity';
import { StudentEntity, StudentLifecycleStatus } from '../../database/entities/student.entity';
import { SubjectEntity } from '../../database/entities/subject.entity';
import { TeacherGroupEntity } from '../../database/entities/teacher-group.entity';
import { TeacherSubjectEntity } from '../../database/entities/teacher-subject.entity';
import { TeacherLifecycleEventEntity } from '../../database/entities/teacher-lifecycle-event.entity';
import { TeacherEntity, TeacherLifecycleStatus } from '../../database/entities/teacher.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AssignTeacherGroupDto } from './dto/assign-teacher-group.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateParentDto } from './dto/create-parent.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { LinkParentStudentDto } from './dto/link-parent-student.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { TransitionStudentLifecycleDto } from './dto/transition-student-lifecycle.dto';
import { TransitionTeacherLifecycleDto } from './dto/transition-teacher-lifecycle.dto';
import { UpdateStudentParentLinkDto } from './dto/update-student-parent-link.dto';
import { InstitutionProfile, SettingsService } from '../settings/settings.service';
import { AccessService } from '../access/access.service';

type ImportCreateResult = {
  totalRows: number;
  created: number;
  errors: Array<{ row: number; message: string }>;
  dryRun: boolean;
};

type XlsxAssignResult = {
  totalRows: number;
  updated: number;
  errors: Array<{ row: number; message: string }>;
  dryRun: boolean;
};

type ImportKind = 'groups' | 'students' | 'teachers' | 'teacher-assignments' | 'students-to-groups';
type LifecycleEntityType = 'student' | 'teacher';
type LifecycleEventListItem = {
  id: string;
  entityType: LifecycleEntityType;
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

@Injectable()
export class SchoolService {
  private readonly logger = new Logger(SchoolService.name);
  constructor(
    @InjectRepository(GroupEntity)
    private readonly groupsRepository: Repository<GroupEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjectsRepository: Repository<SubjectEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(SchoolEntity)
    private readonly schoolsRepository: Repository<SchoolEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(TeacherGroupEntity)
    private readonly teacherGroupsRepository: Repository<TeacherGroupEntity>,
    @InjectRepository(TeacherSubjectEntity)
    private readonly teacherSubjectsRepository: Repository<TeacherSubjectEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(ImportJobEntity)
    private readonly importJobsRepository: Repository<ImportJobEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>,
    @InjectRepository(StudentParentEntity)
    private readonly studentParentsRepository: Repository<StudentParentEntity>,
    @InjectRepository(StudentLifecycleEventEntity)
    private readonly studentLifecycleEventsRepository: Repository<StudentLifecycleEventEntity>,
    @InjectRepository(TeacherLifecycleEventEntity)
    private readonly teacherLifecycleEventsRepository: Repository<TeacherLifecycleEventEntity>,
    private readonly settingsService: SettingsService,
    private readonly accessService: AccessService
  ) {}

  private getLogoExtensionForExcel(absPath: string): 'png' | 'jpeg' | 'gif' {
    const ext = extname(absPath).toLowerCase();
    if (ext === '.png') return 'png';
    if (ext === '.jpg' || ext === '.jpeg') return 'jpeg';
    if (ext === '.gif') return 'gif';
    return 'png';
  }

  /**
   * Cabecera institucional (nombre + logo si existe en disco). Devuelve el índice de fila (1-based)
   * donde deben ir los encabezados de columnas de datos.
   */
  /** Nombres de columna típicos en plantillas (sin acentos, minúsculas). */
  private static readonly XLSX_HEADER_TOKENS = new Set([
    'email',
    'correo',
    'correoelectronico',
    'correo_electronico',
    'password',
    'contrasena',
    'fullname',
    'nombrecompleto',
    'nombre_completo',
    'nombreyapellido',
    'matricula',
    'groupid',
    'idgrupo',
    'grupoid',
    'canaccesscampus',
    'accesoalcampus',
    'accesoacampus',
    'acceso_al_campus',
    'canleavealone',
    'puedesalirsolo',
    'puede_salir_solo',
    'name',
    'nombre',
    'nombredelgrupo',
    'grade',
    'grado',
    'nivel',
    'shift',
    'turno',
    'schoolyear',
    'anioescolar',
    'anoescolar',
    'cicloescolar',
    'classroom',
    'aula',
    'salon',
    'capacity',
    'cupo',
    'capacidad',
    'employeenumber',
    'numeroempleado',
    'numerodeempleado',
    'nroempleado',
    'teacherid',
    'iddocente',
    'docenteid',
    'subjectid',
    'subject_id',
    'idasignatura',
    'id_asignatura',
    'idmateria',
    'asignatura',
    'materia',
    'ismainteacher',
    'esdocenteprincipal',
    'docenteprincipal',
    'canauthorizedepartures',
    'puedeautorizarsalidas',
    'autorizasalidas',
    'grupo_id',
    'nombre_grupo',
    'nombredegrupo',
    'nombredelgrupo',
    'grado',
    'turno',
    'anio_escolar'
  ]);

  /** Fila donde están los encabezados de datos (compatible con plantillas con cabecera institucional arriba). */
  private findXlsxDataHeaderRow(ws: ExcelJS.Worksheet): number {
    const last = ws.lastRow?.number ?? 1;
    const maxScan = Math.min(last, 60);
    for (let r = 1; r <= maxScan; r++) {
      const row = ws.getRow(r);
      let matches = 0;
      row.eachCell({ includeEmpty: true }, (cell) => {
        const raw = String(cell.value ?? '').trim();
        if (!raw) return;
        const k = raw
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[\s_]+/g, '');
        if (SchoolService.XLSX_HEADER_TOKENS.has(k)) matches += 1;
      });
      if (matches >= 2) return r;
    }
    return 1;
  }

  /** Fila de encabezados para asignación alumnos→grupos (columna matricula + al menos otra reconocida). */
  private findStudentsToGroupsHeaderRow(ws: ExcelJS.Worksheet): number {
    const last = ws.lastRow?.number ?? 1;
    for (let r = 1; r <= Math.min(last, 60); r++) {
      const row = ws.getRow(r);
      const colByField = new Map<string, number>();
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const raw = String(cell.value ?? '').trim();
        if (!raw) return;
        const field = this.mapExcelHeaderToField(raw);
        if (field) colByField.set(field, colNumber);
      });
      if (colByField.has('matricula') && colByField.size >= 2) return r;
    }
    return 1;
  }

  private applyImportTemplateBranding(
    ws: ExcelJS.Worksheet,
    wb: ExcelJS.Workbook,
    institution: InstitutionProfile,
    columnCount: number,
    sheetPurpose: string
  ): number {
    const c = Math.max(columnCount, 3);
    const logoAbs = resolveUploadFile(institution.logoUrl ?? null);
    let imageBuffer: Buffer | null = null;
    let imgExt: 'png' | 'jpeg' | 'gif' = 'png';
    if (logoAbs) {
      const lower = logoAbs.toLowerCase();
      if (!lower.endsWith('.webp')) {
        try {
          imageBuffer = readFileSync(logoAbs);
          imgExt = this.getLogoExtensionForExcel(logoAbs);
        } catch {
          imageBuffer = null;
        }
      }
    }

    if (imageBuffer) {
      // exceljs + @types/node: conflicto de tipos de Buffer; en runtime es válido.
      const imageId = wb.addImage({ buffer: imageBuffer, extension: imgExt } as unknown as ExcelJS.Image);
      ws.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 120, height: 72 }
      });
      ws.mergeCells(1, 3, 1, c);
      const t1 = ws.getCell(1, 3);
      t1.value = institution.name;
      t1.font = { bold: true, size: 14 };
      t1.alignment = { vertical: 'middle' };
      ws.getRow(1).height = 56;
    } else {
      ws.mergeCells(1, 1, 1, c);
      const t1 = ws.getCell(1, 1);
      t1.value = institution.name;
      t1.font = { bold: true, size: 14 };
      t1.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    ws.mergeCells(2, 1, 2, c);
    ws.getCell(2, 1).value = sheetPurpose;
    ws.getCell(2, 1).font = { bold: true, size: 12 };
    ws.getCell(2, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(3, 1, 3, c);
    const infoLine = [institution.address, institution.city, institution.phone, institution.email]
      .filter((x) => String(x ?? '').trim().length > 0)
      .join(' · ');
    ws.getCell(3, 1).value = infoLine
      ? `${infoLine}. No elimine ni renombre la fila de encabezados. La fila de ejemplo debajo puede sustituirse o borrarse antes de cargar. En columnas de permisos use Si o No.`
      : 'No elimine ni renombre la fila de encabezados. La fila de ejemplo puede borrarse o sustituirse. En permisos y accesos use Si o No (no true/false).';
    ws.getCell(3, 1).font = { size: 10, color: { argb: 'FF444444' } };
    ws.getCell(3, 1).alignment = { horizontal: 'center', wrapText: true };

    return 4;
  }

  private normalizeHeaderToken(raw: string): string {
    return raw
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ñ/g, 'n')
      .replace(/[^\w]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private canonicalImportHeader(raw: string): string {
    const token = this.normalizeHeaderToken(raw);
    const aliases: Record<string, string> = {
      nombre: 'name',
      grado: 'grade',
      turno: 'shift',
      anio_escolar: 'schoolYear',
      ano_escolar: 'schoolYear',
      ciclo_escolar: 'schoolYear',
      correo: 'email',
      correo_electronico: 'email',
      contrasena: 'password',
      clave: 'password',
      nombre_completo: 'fullName',
      nombres: 'fullName',
      apellido_y_nombre: 'fullName',
      numero_empleado: 'employeeNumber',
      nro_empleado: 'employeeNumber',
      id_grupo: 'groupId',
      grupo_id: 'groupId',
      aula: 'classroom',
      salon: 'classroom',
      cupo: 'capacity',
      capacidad: 'capacity',
      acceso_al_campus: 'canAccessCampus',
      acceso_a_campus: 'canAccessCampus',
      puede_salir_solo: 'canLeaveAlone',
      id_docente: 'teacherId',
      docente_id: 'teacherId',
      subject_id: 'subjectImport',
      subjectid: 'subjectImport',
      id_asignatura: 'subjectImport',
      materia_id: 'subjectImport',
      id_materia: 'subjectImport',
      asignatura: 'subjectImport',
      materia: 'subjectImport',
      es_docente_principal: 'isMainTeacher',
      docente_principal: 'isMainTeacher',
      docente_titular: 'isMainTeacher',
      puede_autorizar_salidas: 'canAuthorizeDepartures',
      autoriza_salidas: 'canAuthorizeDepartures',
      nombre_del_grupo: 'name',
      matricula: 'matricula'
    };
    return aliases[token] ?? raw.trim();
  }

  /** Escuela para altas: token de escuela o `schoolId` en el cuerpo (ADMIN de plataforma). */
  private effectiveSchoolIdForWrite(scopeSchoolId?: string | null, bodySchoolId?: string | null): string {
    const scope = scopeSchoolId?.trim() ?? '';
    const body = bodySchoolId?.trim() ?? '';
    if (scope) {
      if (body && body !== scope) {
        throw new ForbiddenException('No puedes actuar sobre otra escuela');
      }
      return scope;
    }
    if (body) return body;
    throw new ForbiddenException(
      'Indique la escuela (campo schoolId en el cuerpo o selección de escuela para administrador de plataforma).'
    );
  }

  private async requireStudentSchoolId(studentId: string): Promise<string> {
    const row = await this.studentsRepository
      .createQueryBuilder('s')
      .innerJoin(UserEntity, 'u', 'u.id = s.userId')
      .select('COALESCE(u.school_id, s.school_id)', 'schoolId')
      .where('s.id = :id', { id: studentId })
      .getRawOne<{ schoolId: string | null }>();
    if (!row?.schoolId) throw new NotFoundException('Estudiante no encontrado');
    return row.schoolId;
  }

  private async requireTeacherSchoolId(teacherId: string): Promise<string> {
    const row = await this.teachersRepository
      .createQueryBuilder('t')
      .innerJoin(UserEntity, 'u', 'u.id = t.userId')
      .select('u.school_id', 'schoolId')
      .where('t.id = :id', { id: teacherId })
      .getRawOne<{ schoolId: string | null }>();
    if (!row?.schoolId) throw new NotFoundException('Docente no encontrado');
    return row.schoolId;
  }

  private async requireParentSchoolId(parentId: string): Promise<string> {
    const row = await this.parentsRepository
      .createQueryBuilder('p')
      .innerJoin(UserEntity, 'u', 'u.id = p.userId')
      .select('u.school_id', 'schoolId')
      .where('p.id = :id', { id: parentId })
      .getRawOne<{ schoolId: string | null }>();
    if (!row?.schoolId) throw new NotFoundException('Padre/tutor no encontrado');
    return row.schoolId;
  }

  private async schoolIdForStudentPatch(studentId: string, scopeSchoolId?: string | null): Promise<string> {
    if (scopeSchoolId?.trim()) return scopeSchoolId.trim();
    return (await this.requireStudentSchoolId(studentId).catch(() => '')) || '';
  }

  private async schoolIdForTeacherPatch(teacherId: string, scopeSchoolId?: string | null): Promise<string> {
    if (scopeSchoolId?.trim()) return scopeSchoolId.trim();
    return this.requireTeacherSchoolId(teacherId);
  }

  private async schoolIdForParentPatch(parentId: string, scopeSchoolId?: string | null): Promise<string> {
    if (scopeSchoolId?.trim()) return scopeSchoolId.trim();
    return this.requireParentSchoolId(parentId);
  }

  private async resolveSchoolIdForAssignTeacher(
    dto: AssignTeacherGroupDto,
    scopeSchoolId?: string | null
  ): Promise<string> {
    const scope = scopeSchoolId?.trim();
    const ex = dto.schoolId?.trim();
    if (scope) {
      if (ex && ex !== scope) throw new ForbiddenException('No puedes actuar sobre otra escuela');
      return scope;
    }
    if (ex) return ex;
    return this.requireTeacherSchoolId(dto.teacherId);
  }

  private async resolveSchoolIdForParentLink(
    dto: LinkParentStudentDto,
    scopeSchoolId?: string | null
  ): Promise<string> {
    const scope = scopeSchoolId?.trim();
    const ex = dto.schoolId?.trim();
    if (scope) {
      if (ex && ex !== scope) throw new ForbiddenException('No puedes actuar sobre otra escuela');
      return scope;
    }
    if (ex) return ex;
    const s1 = await this.requireStudentSchoolId(dto.studentId);
    const s2 = await this.requireParentSchoolId(dto.parentId);
    if (s1 !== s2) throw new BadRequestException('El estudiante y el padre deben ser de la misma escuela');
    return s1;
  }

  // --- Grupos ---
  listGroups(scopeSchoolId?: string | null, opts?: { q?: string; limit?: number }) {
    const qb = this.groupsRepository
      .createQueryBuilder('g')
      .orderBy('g.schoolYear', 'DESC')
      .addOrderBy('g.name', 'ASC');
    if (scopeSchoolId) qb.andWhere('g.schoolId = :schoolId', { schoolId: scopeSchoolId });
    const q = opts?.q?.trim();
    if (q) {
      const like = `%${q.toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(g.name) LIKE :like OR LOWER(COALESCE(g.grade, '')) LIKE :like OR LOWER(g.schoolYear) LIKE :like)`,
        { like }
      );
    }
    if (opts?.limit) qb.take(opts.limit);
    return qb.getMany();
  }

  async getGroup(id: string, scopeSchoolId?: string | null) {
    const g = await this.groupsRepository.findOne({
      where: scopeSchoolId ? { id, schoolId: scopeSchoolId } : { id }
    });
    if (!g) throw new NotFoundException('Grupo no encontrado');
    return g;
  }

  async createGroup(dto: CreateGroupDto, scopeSchoolId?: string | null) {
    const schoolId = this.effectiveSchoolIdForWrite(scopeSchoolId, dto.schoolId);
    const row = this.groupsRepository.create({
      name: dto.name,
      grade: dto.grade ?? null,
      shift: dto.shift ?? ShiftType.MATUTINO,
      schoolYear: dto.schoolYear,
      classroom: dto.classroom ?? null,
      capacity: dto.capacity ?? null,
      status: true,
      schoolId
    });
    return this.groupsRepository.save(row);
  }

  async updateGroup(id: string, dto: UpdateGroupDto, scopeSchoolId?: string | null) {
    const g = await this.getGroup(id, scopeSchoolId);
    if (dto.name !== undefined) g.name = dto.name;
    if (dto.grade !== undefined) g.grade = dto.grade;
    if (dto.shift !== undefined) g.shift = dto.shift;
    if (dto.schoolYear !== undefined) g.schoolYear = dto.schoolYear;
    if (dto.classroom !== undefined) g.classroom = dto.classroom;
    if (dto.capacity !== undefined) g.capacity = dto.capacity;
    if (dto.status !== undefined) g.status = dto.status;
    return this.groupsRepository.save(g);
  }

  async removeGroup(id: string, scopeSchoolId?: string | null) {
    const g = await this.getGroup(id, scopeSchoolId);
    await this.groupsRepository.delete({ id: g.id });
    return { message: 'Grupo eliminado', id };
  }

  // --- Materias ---
  listSubjects(scopeSchoolId?: string | null) {
    if (scopeSchoolId) {
      return this.subjectsRepository.find({ where: { schoolId: scopeSchoolId }, order: { code: 'ASC', name: 'ASC' } });
    }
    return this.subjectsRepository.find({ order: { code: 'ASC', name: 'ASC' } });
  }

  async getSubject(id: string, scopeSchoolId?: string | null) {
    const s = await this.subjectsRepository.findOne({
      where: scopeSchoolId ? { id, schoolId: scopeSchoolId } : { id }
    });
    if (!s) throw new NotFoundException('Materia no encontrada');
    return s;
  }

  async createSubject(dto: CreateSubjectDto, scopeSchoolId?: string | null) {
    const schoolId = this.effectiveSchoolIdForWrite(scopeSchoolId, dto.schoolId);
    const existingByName = await this.subjectsRepository
      .createQueryBuilder('s')
      .where('lower(s.name) = lower(:name)', { name: dto.name })
      .andWhere('s.school_id = :schoolId', { schoolId })
      .getOne();
    if (existingByName) throw new ConflictException('Ya existe una materia con ese nombre');
    const existingByCode = await this.subjectsRepository
      .createQueryBuilder('s')
      .where('lower(s.code) = lower(:code)', { code: dto.code })
      .andWhere('s.school_id = :schoolId', { schoolId })
      .getOne();
    if (existingByCode) throw new ConflictException('Ya existe una materia con ese codigo');
    const row = this.subjectsRepository.create({
      name: dto.name,
      code: dto.code,
      educationLevel: dto.educationLevel ?? null,
      gradeScope: dto.gradeScope ?? null,
      area: dto.area ?? null,
      description: dto.description ?? null,
      schoolId
    });
    return this.subjectsRepository.save(row);
  }

  async updateSubject(id: string, dto: UpdateSubjectDto, scopeSchoolId?: string | null) {
    const s = await this.getSubject(id, scopeSchoolId);
    if (dto.name !== undefined && dto.name !== s.name) {
      const clash = await this.subjectsRepository
        .createQueryBuilder('x')
        .where('lower(x.name) = lower(:name)', { name: dto.name })
        .andWhere('x.school_id = :schoolId', { schoolId: s.schoolId })
        .getOne();
      if (clash) throw new ConflictException('Ya existe una materia con ese nombre');
      s.name = dto.name;
    }
    if (dto.code !== undefined && dto.code !== s.code) {
      const clash = await this.subjectsRepository
        .createQueryBuilder('x')
        .where('lower(x.code) = lower(:code)', { code: dto.code })
        .andWhere('x.school_id = :schoolId', { schoolId: s.schoolId })
        .getOne();
      if (clash) throw new ConflictException('Ya existe una materia con ese codigo');
      s.code = dto.code;
    }
    if (dto.educationLevel !== undefined) s.educationLevel = dto.educationLevel;
    if (dto.gradeScope !== undefined) s.gradeScope = dto.gradeScope;
    if (dto.area !== undefined) s.area = dto.area;
    if (dto.description !== undefined) s.description = dto.description;
    return this.subjectsRepository.save(s);
  }

  async removeSubject(id: string, scopeSchoolId?: string | null) {
    const s = await this.getSubject(id, scopeSchoolId);
    await this.subjectsRepository.delete({ id: s.id });
    return { message: 'Materia eliminada', id };
  }

  // --- Estudiantes (usuario + perfil) ---
  async listStudents(scopeSchoolId?: string | null, opts?: { q?: string; limit?: number }) {
    const qb = this.studentsRepository
      .createQueryBuilder('s')
      .innerJoin(UserEntity, 'u', 'u.id = s.userId')
      .select([
        's.id AS id',
        'u.id AS "userId"',
        's.matricula AS matricula',
        's.groupId AS "groupId"',
        's.canLeaveAlone AS "canLeaveAlone"',
        's.lifecycleStatus AS "lifecycleStatus"',
        'u.email AS email',
        'u.fullName AS "fullName"',
        'u.phone AS phone',
        'u.avatarPath AS "avatarUrl"',
        'u.canAccessCampus AS "canAccessCampus"',
        'u.status AS "userStatus"'
      ])
      .orderBy('u.full_name', 'ASC');
    if (scopeSchoolId) qb.andWhere('u.school_id = :schoolId', { schoolId: scopeSchoolId });
    const q = opts?.q?.trim();
    if (q) {
      const like = `%${q.toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(u.full_name) LIKE :like OR LOWER(u.email) LIKE :like OR LOWER(s.matricula) LIKE :like)`,
        { like }
      );
    }
    if (opts?.limit) qb.limit(opts.limit);
    return qb.getRawMany();
  }

  async getStudent(id: string, scopeSchoolId?: string | null) {
    const qb = this.studentsRepository
      .createQueryBuilder('s')
      .innerJoin(UserEntity, 'u', 'u.id = s.userId')
      .select([
        's.id AS id',
        's.matricula AS matricula',
        's.groupId AS "groupId"',
        's.canLeaveAlone AS "canLeaveAlone"',
        's.lifecycleStatus AS "lifecycleStatus"',
        'u.id AS "userId"',
        'u.email AS email',
        'u.fullName AS "fullName"',
        'u.phone AS phone',
        'u.avatarPath AS "avatarUrl"',
        'u.canAccessCampus AS "canAccessCampus"',
        'u.status AS "userStatus"'
      ])
      .where('s.id = :id', { id });
    if (scopeSchoolId) qb.andWhere('u.school_id = :schoolId', { schoolId: scopeSchoolId });
    const row = await qb.getRawOne();
    if (!row) throw new NotFoundException('Estudiante no encontrado');
    return row;
  }

  async createStudent(dto: CreateStudentDto, scopeSchoolId?: string | null) {
    const schoolId = this.effectiveSchoolIdForWrite(scopeSchoolId, dto.schoolId);
    const emailTaken = await this.usersRepository.findOne({ where: { email: dto.email } });
    if (emailTaken) throw new ConflictException('El correo ya está registrado');
    const requestedMatricula = dto.matricula?.trim();
    let finalMatricula = requestedMatricula || '';
    if (requestedMatricula) {
      const matTaken = await this.studentsRepository.findOne({ where: { matricula: requestedMatricula, schoolId } });
    if (matTaken) throw new ConflictException('La matrícula ya existe');
    } else {
      finalMatricula = await this.generateNextStudentMatricula(schoolId);
    }

    if (dto.groupId) {
      const g = await this.groupsRepository.findOne({ where: { id: dto.groupId, schoolId } });
      if (!g) throw new NotFoundException('Grupo no encontrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({
      email: dto.email,
      passwordHash,
      role: UserRole.ALUMNO,
      fullName: dto.fullName,
      phone: dto.phone?.trim() || null,
      canAccessCampus: dto.canAccessCampus ?? false,
      status: true,
      schoolId
    });
    const savedUser = await this.usersRepository.save(user);

    const student = this.studentsRepository.create({
      userId: savedUser.id,
      matricula: finalMatricula,
      schoolId,
      groupId: dto.groupId ?? null,
      canLeaveAlone: dto.canLeaveAlone ?? false,
      lifecycleStatus: StudentLifecycleStatus.ACTIVO
    });
    const savedStudent = await this.studentsRepository.save(student);
    try {
      await this.accessService.getOrCreateNfcForUser(savedUser.id);
    } catch (e) {
      this.logger.warn(`No se pudo crear credencial NFC para el alumno (usuario ${savedUser.id}): ${String(e)}`);
    }
    return this.getStudent(savedStudent.id, schoolId);
  }

  async previewNextStudentMatricula(scopeSchoolId?: string | null, requestedSchoolId?: string | null) {
    const schoolId = this.effectiveSchoolIdForWrite(scopeSchoolId, requestedSchoolId);
    const matricula = await this.generateNextStudentMatricula(schoolId);
    return { matricula };
  }

  private async generateNextStudentMatricula(schoolId: string): Promise<string> {
    const prefix = await this.resolveStudentMatriculaPrefix(schoolId);
    const rows = await this.studentsRepository
      .createQueryBuilder('s')
      .select(['s.matricula AS matricula'])
      .andWhere('s.school_id = :schoolId', { schoolId })
      .andWhere('s.matricula LIKE :prefixLike', { prefixLike: `${prefix}-%` })
      .getRawMany<{ matricula: string }>();
    let max = 0;
    for (const row of rows) {
      const m = row.matricula.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (!m) continue;
      const n = Number.parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    let next = max + 1;
    for (let i = 0; i < 50; i++) {
      const candidate = `${prefix}-${String(next).padStart(4, '0')}`;
      const exists = await this.studentsRepository.exist({ where: { matricula: candidate, schoolId } });
      if (!exists) return candidate;
      next += 1;
    }
    throw new ConflictException('No se pudo generar una matrícula automática, intente nuevamente');
  }

  private async resolveStudentMatriculaPrefix(schoolId: string): Promise<string> {
    const school = await this.schoolsRepository.findOne({
      where: { id: schoolId },
      select: ['id', 'code', 'studentMatriculaPrefix']
    });
    const fromCustom = String(school?.studentMatriculaPrefix ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 20);
    if (fromCustom.length >= 2) return fromCustom;
    const fromCode = String(school?.code ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    if (fromCode.length >= 2) return fromCode;
    return 'ALUMNO';
  }

  private todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private assertStudentLifecycleTransitionAllowed(
    from: StudentLifecycleStatus,
    to: StudentLifecycleStatus
  ): void {
    const allowed: Record<StudentLifecycleStatus, StudentLifecycleStatus[]> = {
      [StudentLifecycleStatus.ACTIVO]: [
        StudentLifecycleStatus.BAJA,
        StudentLifecycleStatus.TRASLADO,
        StudentLifecycleStatus.EGRESADO
      ],
      [StudentLifecycleStatus.BAJA]: [StudentLifecycleStatus.ACTIVO, StudentLifecycleStatus.TRASLADO],
      [StudentLifecycleStatus.TRASLADO]: [StudentLifecycleStatus.ACTIVO, StudentLifecycleStatus.BAJA],
      [StudentLifecycleStatus.EGRESADO]: []
    };
    if (!allowed[from].includes(to)) {
      throw new BadRequestException(`Transición no permitida de ${from} a ${to}`);
    }
  }

  private assertTeacherLifecycleTransitionAllowed(
    from: TeacherLifecycleStatus,
    to: TeacherLifecycleStatus
  ): void {
    const allowed: Record<TeacherLifecycleStatus, TeacherLifecycleStatus[]> = {
      [TeacherLifecycleStatus.ACTIVO]: [
        TeacherLifecycleStatus.BAJA,
        TeacherLifecycleStatus.TRASLADO,
        TeacherLifecycleStatus.EGRESADO
      ],
      [TeacherLifecycleStatus.BAJA]: [TeacherLifecycleStatus.ACTIVO, TeacherLifecycleStatus.TRASLADO],
      [TeacherLifecycleStatus.TRASLADO]: [TeacherLifecycleStatus.ACTIVO, TeacherLifecycleStatus.BAJA],
      [TeacherLifecycleStatus.EGRESADO]: []
    };
    if (!allowed[from].includes(to)) {
      throw new BadRequestException(`Transición no permitida de ${from} a ${to}`);
    }
  }

  private async appendStudentLifecycleEvent(input: {
    studentId: string;
    schoolId: string;
    fromStatus: StudentLifecycleStatus;
    toStatus: StudentLifecycleStatus;
    reason: string;
    effectiveDate?: string;
    changedByUserId: string;
  }): Promise<void> {
    if (!input.schoolId?.trim()) return;
    if (input.fromStatus === input.toStatus) return;
    const reason = input.reason.trim();
    if (!reason) return;
    await this.studentLifecycleEventsRepository.save(
      this.studentLifecycleEventsRepository.create({
        studentId: input.studentId,
        schoolId: input.schoolId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        reason,
        effectiveDate: (input.effectiveDate?.slice(0, 10) ?? this.todayIsoDate()),
        changedByUserId: input.changedByUserId
      })
    );
  }

  private async applyStudentLifecycleEffects(
    student: StudentEntity,
    nextStatus: StudentLifecycleStatus
  ): Promise<void> {
    if (nextStatus === StudentLifecycleStatus.ACTIVO) {
      await this.usersRepository.update({ id: student.userId }, { status: true });
      return;
    }
    await this.studentsRepository.update(
      { id: student.id },
      {
        groupId: null,
        canLeaveAlone: false
      }
    );
    await this.usersRepository.update({ id: student.userId }, { status: false, canAccessCampus: false });
  }

  private async appendTeacherLifecycleEvent(input: {
    teacherId: string;
    schoolId: string;
    fromStatus: TeacherLifecycleStatus;
    toStatus: TeacherLifecycleStatus;
    reason: string;
    effectiveDate?: string;
    changedByUserId: string;
  }): Promise<void> {
    if (input.fromStatus === input.toStatus) return;
    const reason = input.reason.trim();
    if (!reason) return;
    await this.teacherLifecycleEventsRepository.save(
      this.teacherLifecycleEventsRepository.create({
        teacherId: input.teacherId,
        schoolId: input.schoolId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        reason,
        effectiveDate: input.effectiveDate?.slice(0, 10) ?? this.todayIsoDate(),
        changedByUserId: input.changedByUserId
      })
    );
  }

  private async applyTeacherLifecycleEffects(
    teacher: TeacherEntity,
    nextStatus: TeacherLifecycleStatus
  ): Promise<void> {
    if (nextStatus === TeacherLifecycleStatus.ACTIVO) {
      await this.usersRepository.update({ id: teacher.userId }, { status: true });
      return;
    }
    await this.usersRepository.update({ id: teacher.userId }, { status: false, canAccessCampus: false });
  }

  async updateStudent(id: string, dto: UpdateStudentDto, scopeSchoolId?: string | null) {
    const schoolId = await this.schoolIdForStudentPatch(id, scopeSchoolId);
    await this.getStudent(id, schoolId);
    const current = await this.studentsRepository.findOne({ where: { id } });
    if (!current) throw new NotFoundException('Estudiante no encontrado');
    if (dto.groupId !== undefined && dto.groupId !== null) {
      const g = await this.groupsRepository.findOne({ where: { id: dto.groupId, schoolId } });
      if (!g) throw new NotFoundException('Grupo no encontrado');
    }
    if (
      dto.groupId !== undefined &&
      dto.groupId !== null &&
      current.lifecycleStatus !== StudentLifecycleStatus.ACTIVO
    ) {
      throw new BadRequestException('Solo estudiantes ACTIVO pueden asignarse a un grupo');
    }
    const patch: Partial<StudentEntity> = {};
    if (dto.groupId !== undefined) patch.groupId = dto.groupId;
    if (dto.matricula !== undefined) {
      const clash = await this.studentsRepository.findOne({ where: { matricula: dto.matricula, schoolId } });
      if (clash && clash.id !== id) throw new ConflictException('La matrícula ya existe');
      patch.matricula = dto.matricula;
    }
    if (dto.canLeaveAlone !== undefined) patch.canLeaveAlone = dto.canLeaveAlone;
    if (dto.lifecycleStatus !== undefined) {
      patch.lifecycleStatus = dto.lifecycleStatus;
    }
    if (Object.keys(patch).length) await this.studentsRepository.update({ id }, patch);
    const student = await this.studentsRepository.findOne({ where: { id } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    const userPatch: Partial<UserEntity> = {};
    if (dto.fullName !== undefined) userPatch.fullName = dto.fullName;
    if (dto.phone !== undefined) userPatch.phone = dto.phone?.trim() || null;
    if (dto.canAccessCampus !== undefined) userPatch.canAccessCampus = dto.canAccessCampus;
    if (Object.keys(userPatch).length) await this.usersRepository.update({ id: student.userId }, userPatch);
    if (dto.lifecycleStatus !== undefined && dto.lifecycleStatus !== current.lifecycleStatus) {
      await this.applyStudentLifecycleEffects(student, dto.lifecycleStatus);
    }
    return this.getStudent(id, schoolId);
  }

  async transitionStudentLifecycle(
    studentId: string,
    dto: TransitionStudentLifecycleDto,
    changedByUserId: string,
    scopeSchoolId?: string | null
  ) {
    const scopedSchoolId = scopeSchoolId?.trim() ?? null;
    if (!dto.reason.trim()) {
      throw new BadRequestException('El motivo de la transición es obligatorio');
    }
    const student = await this.studentsRepository.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    if (scopedSchoolId && student.schoolId !== scopedSchoolId) {
      throw new NotFoundException('Estudiante no encontrado');
    }
    const schoolId = scopedSchoolId ?? student.schoolId ?? '';
    if (student.lifecycleStatus === dto.toStatus) {
      throw new BadRequestException('El estudiante ya tiene ese estado de vida');
    }
    this.assertStudentLifecycleTransitionAllowed(student.lifecycleStatus, dto.toStatus);
    await this.studentsRepository.update({ id: student.id }, { lifecycleStatus: dto.toStatus });
    const updated = await this.studentsRepository.findOne({ where: { id: student.id } });
    if (!updated) throw new NotFoundException('Estudiante no encontrado');
    await this.applyStudentLifecycleEffects(updated, dto.toStatus);
    await this.appendStudentLifecycleEvent({
      studentId: student.id,
      schoolId: student.schoolId ?? schoolId,
      fromStatus: student.lifecycleStatus,
      toStatus: dto.toStatus,
      reason: dto.reason,
      effectiveDate: dto.effectiveDate,
      changedByUserId
    });
    return this.getStudent(studentId, scopedSchoolId ?? undefined);
  }

  async listStudentLifecycleHistory(studentId: string, scopeSchoolId?: string | null) {
    const scopedSchoolId = scopeSchoolId?.trim() ?? null;
    const student = await this.studentsRepository.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    if (scopedSchoolId && student.schoolId !== scopedSchoolId) {
      throw new NotFoundException('Estudiante no encontrado');
    }
    const schoolId = scopedSchoolId ?? student.schoolId ?? '';
    const eventSchoolId = (student.schoolId ?? schoolId)?.trim();
    if (!eventSchoolId) return [];
    return this.studentLifecycleEventsRepository.find({
      where: { studentId, schoolId: eventSchoolId },
      order: { createdAt: 'DESC' }
    });
  }

  async removeStudent(id: string, scopeSchoolId?: string | null) {
    const row = await this.getStudent(id, scopeSchoolId);
    await this.studentParentsRepository.delete({ studentId: id });
    await this.studentsRepository.delete({ id });
    await this.usersRepository.delete({ id: row.userId });
    return { message: 'Alumno eliminado', id };
  }

  // --- Docentes ---
  async listTeachers(scopeSchoolId?: string | null, opts?: { q?: string; limit?: number }) {
    const qb = this.teachersRepository
      .createQueryBuilder('t')
      .innerJoin(UserEntity, 'u', 'u.id = t.userId')
      .select([
        't.id AS id',
        'u.id AS "userId"',
        't.employeeNumber AS "employeeNumber"',
        't.lifecycleStatus AS "lifecycleStatus"',
        'u.email AS email',
        'u.fullName AS "fullName"',
        'u.phone AS phone',
        'u.avatarPath AS "avatarUrl"',
        'u.canAccessCampus AS "canAccessCampus"',
        'u.status AS "userStatus"'
      ])
      .where('u.role = :teacherRole', { teacherRole: UserRole.DOCENTE })
      .orderBy('u.full_name', 'ASC');
    if (scopeSchoolId) qb.andWhere('u.school_id = :schoolId', { schoolId: scopeSchoolId });
    const q = opts?.q?.trim();
    if (q) {
      const like = `%${q.toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(u.full_name) LIKE :like OR LOWER(u.email) LIKE :like OR LOWER(t.employeeNumber) LIKE :like)`,
        { like }
      );
    }
    if (opts?.limit) qb.limit(opts.limit);
    return qb.getRawMany();
  }

  async getTeacher(id: string, scopeSchoolId?: string | null) {
    const qb = this.teachersRepository
      .createQueryBuilder('t')
      .innerJoin(UserEntity, 'u', 'u.id = t.userId')
      .select([
        't.id AS id',
        't.employeeNumber AS "employeeNumber"',
        't.lifecycleStatus AS "lifecycleStatus"',
        'u.id AS "userId"',
        'u.email AS email',
        'u.fullName AS "fullName"',
        'u.phone AS phone',
        'u.avatarPath AS "avatarUrl"',
        'u.canAccessCampus AS "canAccessCampus"',
        'u.status AS "userStatus"'
      ])
      .where('t.id = :id', { id })
      .andWhere('u.role = :teacherRole', { teacherRole: UserRole.DOCENTE });
    if (scopeSchoolId) qb.andWhere('u.school_id = :schoolId', { schoolId: scopeSchoolId });
    const row = await qb.getRawOne();
    if (!row) throw new NotFoundException('Docente no encontrado');
    return row;
  }

  async createTeacher(dto: CreateTeacherDto, scopeSchoolId?: string | null) {
    const schoolId = this.effectiveSchoolIdForWrite(scopeSchoolId, dto.schoolId);
    const emailTaken = await this.usersRepository.findOne({ where: { email: dto.email } });
    if (emailTaken) throw new ConflictException('El correo ya está registrado');
    const numTaken = await this.teachersRepository.findOne({ where: { employeeNumber: dto.employeeNumber } });
    if (numTaken) throw new ConflictException('El número de empleado ya existe');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({
      email: dto.email,
      passwordHash,
      role: UserRole.DOCENTE,
      fullName: dto.fullName,
      phone: dto.phone?.trim() || null,
      canAccessCampus: dto.canAccessCampus ?? false,
      status: true,
      schoolId
    });
    const savedUser = await this.usersRepository.save(user);

    const teacher = this.teachersRepository.create({
      userId: savedUser.id,
      employeeNumber: dto.employeeNumber,
      lifecycleStatus: TeacherLifecycleStatus.ACTIVO
    });
    const saved = await this.teachersRepository.save(teacher);
    const requestedSubjectIds = Array.from(new Set(dto.subjectIds ?? []));
    if (requestedSubjectIds.length) {
      const subjects = await this.subjectsRepository
        .createQueryBuilder('s')
        .where('s.school_id = :schoolId', { schoolId })
        .andWhere('s.id IN (:...ids)', { ids: requestedSubjectIds })
        .getMany();
      if (subjects.length !== requestedSubjectIds.length) {
        throw new BadRequestException('Una o varias materias no existen en la institucion');
      }
      await this.teacherSubjectsRepository.insert(
        requestedSubjectIds.map((subjectId) => ({
          teacherId: saved.id,
          subjectId
        }))
      );
    }
    return this.getTeacher(saved.id, schoolId);
  }

  async updateTeacher(id: string, dto: UpdateTeacherDto, scopeSchoolId?: string | null) {
    const schoolId = await this.schoolIdForTeacherPatch(id, scopeSchoolId);
    await this.getTeacher(id, schoolId);
    const t = await this.teachersRepository.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Docente no encontrado');

    if (dto.employeeNumber !== undefined && dto.employeeNumber !== t.employeeNumber) {
      const clash = await this.teachersRepository.findOne({ where: { employeeNumber: dto.employeeNumber } });
      if (clash) throw new ConflictException('El número de empleado ya existe');
      t.employeeNumber = dto.employeeNumber;
      await this.teachersRepository.save(t);
    }
    if (dto.lifecycleStatus !== undefined && dto.lifecycleStatus !== t.lifecycleStatus) {
      t.lifecycleStatus = dto.lifecycleStatus;
      await this.teachersRepository.save(t);
      await this.applyTeacherLifecycleEffects(t, dto.lifecycleStatus);
    }

    const userPatch: Partial<UserEntity> = {};
    if (dto.fullName !== undefined) userPatch.fullName = dto.fullName;
    if (dto.phone !== undefined) userPatch.phone = dto.phone?.trim() || null;
    if (dto.canAccessCampus !== undefined) userPatch.canAccessCampus = dto.canAccessCampus;
    if (Object.keys(userPatch).length) await this.usersRepository.update({ id: t.userId }, userPatch);

    return this.getTeacher(id, schoolId);
  }

  async transitionTeacherLifecycle(
    teacherId: string,
    dto: TransitionTeacherLifecycleDto,
    changedByUserId: string,
    scopeSchoolId?: string | null
  ) {
    const schoolId = await this.schoolIdForTeacherPatch(teacherId, scopeSchoolId);
    if (!dto.reason.trim()) {
      throw new BadRequestException('El motivo de la transición es obligatorio');
    }
    const teacher = await this.teachersRepository.findOne({ where: { id: teacherId } });
    if (!teacher) throw new NotFoundException('Docente no encontrado');
    const user = await this.usersRepository.findOne({ where: { id: teacher.userId } });
    if (!user || user.schoolId !== schoolId) throw new NotFoundException('Docente no encontrado');
    if (teacher.lifecycleStatus === dto.toStatus) {
      throw new BadRequestException('El docente ya tiene ese estado de vida');
    }
    this.assertTeacherLifecycleTransitionAllowed(teacher.lifecycleStatus, dto.toStatus);
    const prevStatus = teacher.lifecycleStatus;
    teacher.lifecycleStatus = dto.toStatus;
    const saved = await this.teachersRepository.save(teacher);
    await this.applyTeacherLifecycleEffects(saved, dto.toStatus);
    await this.appendTeacherLifecycleEvent({
      teacherId: saved.id,
      schoolId,
      fromStatus: prevStatus,
      toStatus: dto.toStatus,
      reason: dto.reason,
      effectiveDate: dto.effectiveDate,
      changedByUserId
    });
    return this.getTeacher(teacherId, schoolId);
  }

  async listTeacherLifecycleHistory(teacherId: string, scopeSchoolId?: string | null) {
    const schoolId = await this.schoolIdForTeacherPatch(teacherId, scopeSchoolId);
    await this.getTeacher(teacherId, schoolId);
    return this.teacherLifecycleEventsRepository.find({
      where: { teacherId, schoolId },
      order: { createdAt: 'DESC' }
    });
  }

  async listLifecycleEvents(
    scopeSchoolId?: string | null,
    filters?: {
      entityType?: 'student' | 'teacher' | 'all';
      from?: string;
      to?: string;
      limit?: number;
    }
  ): Promise<LifecycleEventListItem[]> {
    const entityType = filters?.entityType ?? 'all';
    const from = filters?.from?.trim();
    const to = filters?.to?.trim();
    const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 1000);
    const allRows: LifecycleEventListItem[] = [];

    if (entityType === 'all' || entityType === 'student') {
      const qb = this.studentLifecycleEventsRepository
        .createQueryBuilder('ev')
        .innerJoin(StudentEntity, 'st', 'st.id = ev.student_id')
        .innerJoin(UserEntity, 'person', 'person.id = st.user_id')
        .leftJoin(UserEntity, 'changedBy', 'changedBy.id = ev.changed_by_user_id')
        .select([
          'ev.id AS id',
          `'student' AS "entityType"`,
          'ev.student_id AS "personId"',
          'person.full_name AS "personName"',
          'ev.school_id AS "schoolId"',
          'ev.from_status AS "fromStatus"',
          'ev.to_status AS "toStatus"',
          'ev.reason AS reason',
          'ev.effective_date AS "effectiveDate"',
          'ev.changed_by_user_id AS "changedByUserId"',
          `COALESCE(changedBy.full_name, ev.changed_by_user_id::text) AS "changedByName"`,
          'ev.created_at AS "createdAt"'
        ])
        .orderBy('ev.created_at', 'DESC')
        .limit(limit);
      if (scopeSchoolId) qb.andWhere('ev.school_id = :schoolId', { schoolId: scopeSchoolId });
      if (from) qb.andWhere('ev.created_at >= :fromDate', { fromDate: from });
      if (to) qb.andWhere('ev.created_at <= :toDate', { toDate: to });
      const rows = await qb.getRawMany<LifecycleEventListItem>();
      allRows.push(...rows);
    }

    if (entityType === 'all' || entityType === 'teacher') {
      const qb = this.teacherLifecycleEventsRepository
        .createQueryBuilder('ev')
        .innerJoin(TeacherEntity, 'te', 'te.id = ev.teacher_id')
        .innerJoin(UserEntity, 'person', 'person.id = te.user_id')
        .leftJoin(UserEntity, 'changedBy', 'changedBy.id = ev.changed_by_user_id')
        .select([
          'ev.id AS id',
          `'teacher' AS "entityType"`,
          'ev.teacher_id AS "personId"',
          'person.full_name AS "personName"',
          'ev.school_id AS "schoolId"',
          'ev.from_status AS "fromStatus"',
          'ev.to_status AS "toStatus"',
          'ev.reason AS reason',
          'ev.effective_date AS "effectiveDate"',
          'ev.changed_by_user_id AS "changedByUserId"',
          `COALESCE(changedBy.full_name, ev.changed_by_user_id::text) AS "changedByName"`,
          'ev.created_at AS "createdAt"'
        ])
        .orderBy('ev.created_at', 'DESC')
        .limit(limit);
      if (scopeSchoolId) qb.andWhere('ev.school_id = :schoolId', { schoolId: scopeSchoolId });
      if (from) qb.andWhere('ev.created_at >= :fromDate', { fromDate: from });
      if (to) qb.andWhere('ev.created_at <= :toDate', { toDate: to });
      const rows = await qb.getRawMany<LifecycleEventListItem>();
      allRows.push(...rows);
    }

    return allRows
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, limit);
  }

  async exportLifecycleEventsXlsx(
    scopeSchoolId?: string | null,
    filters?: {
      entityType?: 'student' | 'teacher' | 'all';
      from?: string;
      to?: string;
      limit?: number;
    }
  ): Promise<Buffer> {
    const rows = await this.listLifecycleEvents(scopeSchoolId, {
      ...filters,
      limit: Math.min(Math.max(filters?.limit ?? 2000, 1), 5000)
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Auditoria lifecycle');
    ws.columns = [
      { header: 'tipo_entidad', key: 'entityType', width: 18 },
      { header: 'persona_id', key: 'personId', width: 38 },
      { header: 'persona_nombre', key: 'personName', width: 30 },
      { header: 'estado_origen', key: 'fromStatus', width: 18 },
      { header: 'estado_destino', key: 'toStatus', width: 18 },
      { header: 'motivo', key: 'reason', width: 42 },
      { header: 'fecha_efectiva', key: 'effectiveDate', width: 18 },
      { header: 'cambiado_por_id', key: 'changedByUserId', width: 38 },
      { header: 'cambiado_por_nombre', key: 'changedByName', width: 30 },
      { header: 'fecha_evento', key: 'createdAt', width: 24 }
    ];
    ws.getRow(1).font = { bold: true };
    for (const row of rows) ws.addRow(row);
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: 'A1', to: 'J1' };
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  }

  async removeTeacher(id: string, scopeSchoolId?: string | null) {
    const row = await this.getTeacher(id, scopeSchoolId);
    await this.teacherGroupsRepository.delete({ teacherId: id });
    await this.teacherSubjectsRepository.delete({ teacherId: id });
    await this.teachersRepository.delete({ id });
    await this.usersRepository.delete({ id: row.userId });
    return { message: 'Docente eliminado', id };
  }

  async listTeacherSubjects(teacherId?: string, scopeSchoolId?: string | null) {
    const qb = this.teacherSubjectsRepository
      .createQueryBuilder('ts')
      .innerJoin(TeacherEntity, 't', 't.id = ts.teacher_id')
      .innerJoin(UserEntity, 'u', 'u.id = t.user_id')
      .innerJoin(SubjectEntity, 's', 's.id = ts.subject_id')
      .select([
        'ts.id AS id',
        'ts.teacherId AS "teacherId"',
        'ts.subjectId AS "subjectId"',
        's.name AS "subjectName"',
        's.code AS "subjectCode"'
      ])
      .where('u.role = :teacherRole', { teacherRole: UserRole.DOCENTE })
      .orderBy('u.full_name', 'ASC')
      .addOrderBy('s.code', 'ASC')
      .addOrderBy('s.name', 'ASC');
    if (teacherId) qb.andWhere('ts.teacher_id = :teacherId', { teacherId });
    if (scopeSchoolId) {
      qb.andWhere('u.school_id = :schoolId AND s.school_id = :schoolId', { schoolId: scopeSchoolId });
    }
    return qb.getRawMany();
  }

  // --- Asignaciones docente–grupo–materia ---
  async listTeacherAssignments(teacherId?: string, groupId?: string, scopeSchoolId?: string | null) {
    const qb = this.teacherGroupsRepository
      .createQueryBuilder('tg')
      .innerJoin('groups', 'g', 'g.id = tg.group_id')
      .orderBy('tg.createdAt', 'DESC');
    if (teacherId) qb.andWhere('tg.teacher_id = :teacherId', { teacherId });
    if (groupId) qb.andWhere('tg.group_id = :groupId', { groupId });
    if (scopeSchoolId) qb.andWhere('g.school_id = :schoolId', { schoolId: scopeSchoolId });
    return qb.getMany();
  }

  async assignTeacherGroup(dto: AssignTeacherGroupDto, scopeSchoolId?: string | null) {
    const schoolId = await this.resolveSchoolIdForAssignTeacher(dto, scopeSchoolId);
    const teacher = await this.teachersRepository.findOne({ where: { id: dto.teacherId } });
    if (!teacher) throw new NotFoundException('Docente no encontrado');
    const group = await this.groupsRepository.findOne({ where: { id: dto.groupId, schoolId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');

    const subjectIdOpt = dto.subjectId?.trim() ? dto.subjectId.trim() : null;
    if (subjectIdOpt) {
      const sub = await this.subjectsRepository.findOne({ where: { id: subjectIdOpt, schoolId } });
      if (!sub) throw new NotFoundException('Materia no encontrada');
    }

    const existing = await this.teacherGroupsRepository.findOne({
      where: {
        teacherId: dto.teacherId,
        groupId: dto.groupId,
        subjectId: subjectIdOpt ? subjectIdOpt : IsNull()
      }
    });
    if (existing) {
      existing.isMainTeacher = dto.isMainTeacher ?? existing.isMainTeacher;
      existing.canAuthorizeDepartures = dto.canAuthorizeDepartures ?? existing.canAuthorizeDepartures;
      return this.teacherGroupsRepository.save(existing);
    }

    const row = this.teacherGroupsRepository.create({
      teacherId: dto.teacherId,
      groupId: dto.groupId,
      subjectId: subjectIdOpt,
      isMainTeacher: dto.isMainTeacher ?? false,
      canAuthorizeDepartures: dto.canAuthorizeDepartures ?? false
    });
    return this.teacherGroupsRepository.save(row);
  }

  async removeTeacherAssignment(id: string, scopeSchoolId?: string | null) {
    const row = await this.teacherGroupsRepository
      .createQueryBuilder('tg')
      .innerJoin('groups', 'g', 'g.id = tg.group_id')
      .where('tg.id = :id', { id })
      .andWhere(scopeSchoolId ? 'g.school_id = :schoolId' : '1=1', { schoolId: scopeSchoolId })
      .getOne();
    if (!row) throw new NotFoundException('Asignación no encontrada');
    await this.teacherGroupsRepository.delete({ id });
    return { message: 'Asignación eliminada', id };
  }

  // --- Padres / tutores y vínculos con estudiantes ---
  listParents(scopeSchoolId?: string | null, opts?: { q?: string; limit?: number }) {
    const qb = this.parentsRepository
      .createQueryBuilder('p')
      .innerJoin(UserEntity, 'u', 'u.id = p.userId')
      .select([
        'p.id AS id',
        'p.isPrimaryContact AS "isPrimaryContact"',
        'u.email AS email',
        'u.fullName AS "fullName"',
        'u.phone AS phone',
        'u.id AS "userId"',
        'u.avatarPath AS "avatarUrl"',
        'u.canAccessCampus AS "canAccessCampus"',
        'u.status AS "userStatus"'
      ])
      .orderBy('u.full_name', 'ASC');
    if (scopeSchoolId) qb.andWhere('u.school_id = :schoolId', { schoolId: scopeSchoolId });
    const q = opts?.q?.trim();
    if (q) {
      const like = `%${q.toLowerCase()}%`;
      qb.andWhere(`(LOWER(u.full_name) LIKE :like OR LOWER(u.email) LIKE :like)`, { like });
    }
    if (opts?.limit) qb.limit(opts.limit);
    return qb.getRawMany();
  }

  async getParent(id: string, scopeSchoolId?: string | null) {
    const qb = this.parentsRepository
      .createQueryBuilder('p')
      .innerJoin(UserEntity, 'u', 'u.id = p.userId')
      .select([
        'p.id AS id',
        'p.isPrimaryContact AS "isPrimaryContact"',
        'u.email AS email',
        'u.fullName AS "fullName"',
        'u.phone AS phone',
        'u.id AS "userId"',
        'u.avatarPath AS "avatarUrl"',
        'u.canAccessCampus AS "canAccessCampus"',
        'u.status AS "userStatus"'
      ])
      .where('p.id = :id', { id });
    if (scopeSchoolId) qb.andWhere('u.school_id = :schoolId', { schoolId: scopeSchoolId });
    const row = await qb.getRawOne();
    if (!row) throw new NotFoundException('Padre/tutor no encontrado');
    return row;
  }

  async createParent(dto: CreateParentDto, scopeSchoolId?: string | null) {
    const schoolId = this.effectiveSchoolIdForWrite(scopeSchoolId, dto.schoolId);
    const emailTaken = await this.usersRepository.findOne({ where: { email: dto.email } });
    if (emailTaken) throw new ConflictException('El correo ya está registrado');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({
      email: dto.email,
      passwordHash,
      role: UserRole.PADRE,
      fullName: dto.fullName,
      phone: dto.phone?.trim() || null,
      canAccessCampus: dto.canAccessCampus ?? false,
      status: true,
      schoolId
    });
    const savedUser = await this.usersRepository.save(user);
    const parent = this.parentsRepository.create({
      userId: savedUser.id,
      isPrimaryContact: dto.isPrimaryContact ?? false
    });
    const saved = await this.parentsRepository.save(parent);
    return this.getParent(saved.id, schoolId);
  }

  async updateParent(id: string, dto: UpdateParentDto, scopeSchoolId?: string | null) {
    const schoolId = await this.schoolIdForParentPatch(id, scopeSchoolId);
    const row = await this.getParent(id, schoolId);
    const parent = await this.parentsRepository.findOne({ where: { id } });
    if (!parent) throw new NotFoundException('Padre/tutor no encontrado');
    if (dto.isPrimaryContact !== undefined) {
      parent.isPrimaryContact = dto.isPrimaryContact;
      await this.parentsRepository.save(parent);
    }
    const userPatch: Partial<UserEntity> = {};
    if (dto.fullName !== undefined) userPatch.fullName = dto.fullName;
    if (dto.phone !== undefined) userPatch.phone = dto.phone?.trim() || null;
    if (dto.canAccessCampus !== undefined) userPatch.canAccessCampus = dto.canAccessCampus;
    if (Object.keys(userPatch).length) await this.usersRepository.update({ id: row.userId }, userPatch);
    return this.getParent(id, schoolId);
  }

  async removeParent(id: string, scopeSchoolId?: string | null) {
    const row = await this.getParent(id, scopeSchoolId);
    await this.studentParentsRepository.delete({ parentId: id });
    await this.parentsRepository.delete({ id });
    await this.usersRepository.delete({ id: row.userId });
    return { message: 'Padre/tutor eliminado', id };
  }

  async listStudentParentLinks(
    parentId: string | undefined,
    studentId: string | undefined,
    scopeSchoolId?: string | null
  ) {
    const qb = this.studentParentsRepository
      .createQueryBuilder('sp')
      .innerJoin(StudentEntity, 's', 's.id = sp.studentId')
      .innerJoin(UserEntity, 'su', 'su.id = s.userId')
      .innerJoin(ParentEntity, 'p', 'p.id = sp.parentId')
      .innerJoin(UserEntity, 'pu', 'pu.id = p.userId')
      .select([
        'sp.id AS id',
        'sp.student_id AS "studentId"',
        'sp.parent_id AS "parentId"',
        'sp.relationship AS relationship',
        'sp.is_primary AS "isPrimary"',
        'sp.can_pickup AS "canPickup"',
        'su.full_name AS "studentFullName"',
        'su.email AS "studentEmail"',
        'pu.full_name AS "parentFullName"',
        'pu.email AS "parentEmail"'
      ])
      .orderBy('sp.created_at', 'DESC');
    if (parentId?.trim()) qb.andWhere('sp.parent_id = :parentId', { parentId: parentId.trim() });
    if (studentId?.trim()) qb.andWhere('sp.student_id = :studentId', { studentId: studentId.trim() });
    if (scopeSchoolId) qb.andWhere('su.school_id = :schoolId', { schoolId: scopeSchoolId });
    return qb.getRawMany();
  }

  async linkParentStudent(dto: LinkParentStudentDto, scopeSchoolId?: string | null) {
    const schoolId = await this.resolveSchoolIdForParentLink(dto, scopeSchoolId);
    const stuSch = await this.requireStudentSchoolId(dto.studentId);
    const parSch = await this.requireParentSchoolId(dto.parentId);
    if (stuSch !== schoolId || parSch !== schoolId) {
      throw new BadRequestException('El estudiante y el padre deben pertenecer a la escuela seleccionada');
    }

    const existing = await this.studentParentsRepository.findOne({
      where: { studentId: dto.studentId, parentId: dto.parentId }
    });
    if (existing) throw new ConflictException('Este padre ya está vinculado al estudiante');

    const row = this.studentParentsRepository.create({
      studentId: dto.studentId,
      parentId: dto.parentId,
      relationship: dto.relationship.trim(),
      isPrimary: dto.isPrimary ?? false,
      canPickup: dto.canPickup ?? true
    });
    return this.studentParentsRepository.save(row);
  }

  async updateStudentParentLink(linkId: string, dto: UpdateStudentParentLinkDto, scopeSchoolId?: string | null) {
    const row = await this.studentParentsRepository.findOne({ where: { id: linkId } });
    if (!row) throw new NotFoundException('Vínculo no encontrado');
    const stuSch = await this.requireStudentSchoolId(row.studentId);
    if (scopeSchoolId && stuSch !== scopeSchoolId) {
      throw new ForbiddenException('No tienes permiso para modificar este vínculo');
    }
    if (dto.relationship !== undefined) row.relationship = dto.relationship.trim();
    if (dto.canPickup !== undefined) row.canPickup = dto.canPickup;
    if (dto.isPrimary !== undefined) row.isPrimary = dto.isPrimary;
    return this.studentParentsRepository.save(row);
  }

  async unlinkStudentParent(linkId: string, scopeSchoolId?: string | null) {
    const row = await this.studentParentsRepository.findOne({ where: { id: linkId } });
    if (!row) throw new NotFoundException('Vínculo no encontrado');
    const stuSch = await this.requireStudentSchoolId(row.studentId);
    if (scopeSchoolId && stuSch !== scopeSchoolId) {
      throw new ForbiddenException('No tienes permiso para modificar este vínculo');
    }
    await this.studentParentsRepository.delete({ id: linkId });
    return { message: 'Vínculo eliminado', id: linkId };
  }

  // --- Cargas masivas Excel (.xlsx), primera hoja con encabezados ---

  async importAny(
    kind: string,
    buffer: Buffer,
    dryRun = false,
    scopeSchoolId?: string | null
  ) {
    const normalized = String(kind ?? '').trim().toLowerCase() as ImportKind;
    switch (normalized) {
      case 'groups':
        return this.importGroupsFile(buffer, dryRun, scopeSchoolId);
      case 'students':
        return this.importStudentsFile(buffer, dryRun, scopeSchoolId);
      case 'teachers':
        return this.importTeachersFile(buffer, dryRun, scopeSchoolId);
      case 'teacher-assignments':
        return this.importTeacherAssignmentsFile(buffer, dryRun, scopeSchoolId);
      case 'students-to-groups':
        return this.importStudentsToGroupsFile(buffer, dryRun, scopeSchoolId);
      default:
        throw new BadRequestException(
          'Tipo de importación inválido. Usa: groups, students, teachers, teacher-assignments, students-to-groups'
        );
    }
  }

  async importGroupsFile(
    buffer: Buffer,
    dryRun = false,
    scopeSchoolId?: string | null
  ): Promise<ImportCreateResult> {
    const { rows, headerRowIndex } = await this.parseXlsxFirstSheetToRows(buffer);
    const result: ImportCreateResult = { totalRows: rows.length, created: 0, errors: [], dryRun };
    for (let i = 0; i < rows.length; i++) {
      const line = headerRowIndex + 1 + i;
      const row = rows[i];
      try {
        const dto: CreateGroupDto = {
          name: this.required(row, 'name'),
          schoolYear: this.required(row, 'schoolYear'),
          grade: this.optional(row, 'grade'),
          shift: this.parseShift(this.optional(row, 'shift')),
          classroom: this.optional(row, 'classroom'),
          capacity: this.parseIntOptional(this.optional(row, 'capacity'))
        };
        if (!dryRun) await this.createGroup(dto, scopeSchoolId);
        result.created += 1;
      } catch (error) {
        result.errors.push({ row: line, message: this.errorMessage(error) });
      }
    }
    await this.pushImportLog('groups', result, scopeSchoolId ?? null);
    return result;
  }

  async importStudentsFile(
    buffer: Buffer,
    dryRun = false,
    scopeSchoolId?: string | null
  ): Promise<ImportCreateResult> {
    const { rows, headerRowIndex } = await this.parseXlsxFirstSheetToRows(buffer);
    const result: ImportCreateResult = { totalRows: rows.length, created: 0, errors: [], dryRun };
    for (let i = 0; i < rows.length; i++) {
      const line = headerRowIndex + 1 + i;
      const row = rows[i];
      try {
        const dto: CreateStudentDto = {
          email: this.required(row, 'email'),
          password: this.required(row, 'password'),
          fullName: this.required(row, 'fullName'),
          matricula: this.optional(row, 'matricula'),
          groupId: this.optional(row, 'groupId'),
          canAccessCampus: this.parseBoolOptional(this.optional(row, 'canAccessCampus')),
          canLeaveAlone: this.parseBoolOptional(this.optional(row, 'canLeaveAlone'))
        };
        if (!dryRun) await this.createStudent(dto, scopeSchoolId);
        result.created += 1;
      } catch (error) {
        result.errors.push({ row: line, message: this.errorMessage(error) });
      }
    }
    await this.pushImportLog('students', result, scopeSchoolId ?? null);
    return result;
  }

  async importTeachersFile(
    buffer: Buffer,
    dryRun = false,
    scopeSchoolId?: string | null
  ): Promise<ImportCreateResult> {
    const { rows, headerRowIndex } = await this.parseXlsxFirstSheetToRows(buffer);
    const result: ImportCreateResult = { totalRows: rows.length, created: 0, errors: [], dryRun };
    for (let i = 0; i < rows.length; i++) {
      const line = headerRowIndex + 1 + i;
      const row = rows[i];
      try {
        const dto: CreateTeacherDto = {
          email: this.required(row, 'email'),
          password: this.required(row, 'password'),
          fullName: this.required(row, 'fullName'),
          employeeNumber: this.required(row, 'employeeNumber'),
          canAccessCampus: this.parseBoolOptional(this.optional(row, 'canAccessCampus'))
        };
        if (!dryRun) await this.createTeacher(dto, scopeSchoolId);
        result.created += 1;
      } catch (error) {
        result.errors.push({ row: line, message: this.errorMessage(error) });
      }
    }
    await this.pushImportLog('teachers', result, scopeSchoolId ?? null);
    return result;
  }

  async importTeacherAssignmentsFile(
    buffer: Buffer,
    dryRun = false,
    scopeSchoolId?: string | null
  ): Promise<ImportCreateResult> {
    const { rows, headerRowIndex } = await this.parseXlsxFirstSheetToRows(buffer);
    const result: ImportCreateResult = { totalRows: rows.length, created: 0, errors: [], dryRun };
    const subjectCache = new Map<string, SubjectEntity[]>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const line = headerRowIndex + 1 + i;
      try {
        const groupId = this.required(row, 'groupId');
        const group = await this.groupsRepository.findOne({
          where: scopeSchoolId ? { id: groupId, schoolId: scopeSchoolId } : { id: groupId }
        });
        if (!group) throw new Error('Grupo no encontrado');

        const subjectImport =
          this.optional(row, 'subjectImport') ?? this.optional(row, 'subjectId');
        const subjectIdResolved = await this.resolveSubjectImportValue(
          group.schoolId,
          subjectImport,
          subjectCache
        );

        const dto: AssignTeacherGroupDto = {
          teacherId: this.required(row, 'teacherId'),
          groupId,
          isMainTeacher: this.parseBoolOptional(this.optional(row, 'isMainTeacher')),
          canAuthorizeDepartures: this.parseBoolOptional(this.optional(row, 'canAuthorizeDepartures'))
        };
        if (subjectIdResolved) dto.subjectId = subjectIdResolved;
        if (!dryRun) await this.assignTeacherGroup(dto, scopeSchoolId);
        result.created += 1;
      } catch (error) {
        result.errors.push({ row: line, message: this.errorMessage(error) });
      }
    }
    await this.pushImportLog('teacher-assignments', result, scopeSchoolId ?? null);
    return result;
  }

  async importStudentsToGroupsFile(
    buffer: Buffer,
    dryRun = false,
    scopeSchoolId?: string | null
  ): Promise<XlsxAssignResult> {
    return this.importStudentsToGroupsFromXlsx(buffer, dryRun, scopeSchoolId);
  }

  async importGroupsXlsx(
    buffer: Buffer,
    dryRun = false,
    scopeSchoolId?: string | null
  ): Promise<ImportCreateResult> {
    return this.importGroupsFile(buffer, dryRun, scopeSchoolId);
  }

  async importStudentsXlsx(
    buffer: Buffer,
    dryRun = false,
    scopeSchoolId?: string | null
  ): Promise<ImportCreateResult> {
    return this.importStudentsFile(buffer, dryRun, scopeSchoolId);
  }

  async importTeachersXlsx(
    buffer: Buffer,
    dryRun = false,
    scopeSchoolId?: string | null
  ): Promise<ImportCreateResult> {
    return this.importTeachersFile(buffer, dryRun, scopeSchoolId);
  }

  /**
   * Excel exclusivo para asignar alumnos existentes a grupos (grado/turno/año o nombre de grupo).
   * Columnas esperadas (fila 1): matricula, y uno de: grupo_id | (nombre_grupo + anio_escolar) | (grado + turno + anio_escolar).
   */
  async importStudentsToGroupsFromXlsx(
    buffer: Buffer,
    dryRun = false,
    scopeSchoolId?: string | null
  ): Promise<XlsxAssignResult> {
    const workbook = new ExcelJS.Workbook();
    try {
      // Compat tipos Node 22 / exceljs
      await workbook.xlsx.load(buffer as never);
    } catch {
      throw new BadRequestException('No se pudo leer el archivo Excel');
    }
    const ws = workbook.worksheets[0];
    if (!ws) throw new BadRequestException('El archivo no tiene hojas');

    const headerRowIndex = this.findStudentsToGroupsHeaderRow(ws);
    const headerRow = ws.getRow(headerRowIndex);
    const colByField = new Map<string, number>();
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const raw = String(cell.value ?? '').trim();
      if (!raw) return;
      const field = this.mapExcelHeaderToField(raw);
      if (field) colByField.set(field, colNumber);
    });

    if (!colByField.has('matricula')) {
      throw new BadRequestException(
        'El archivo debe incluir una fila de encabezados con la columna «Matrícula» del alumno.'
      );
    }

    const result: XlsxAssignResult = {
      totalRows: 0,
      updated: 0,
      errors: [],
      dryRun
    };

    const lastRow = ws.lastRow?.number ?? 1;
    for (let r = headerRowIndex + 1; r <= lastRow; r++) {
      const row = ws.getRow(r);
      const fields: Record<string, string> = {};
      for (const [field, col] of colByField) {
        fields[field] = this.excelCellText(row, col);
      }
      const matricula = fields.matricula?.trim();
      if (!matricula) continue;

      result.totalRows += 1;
      try {
        const group = await this.resolveGroupForExcelRow(fields, r, scopeSchoolId);
        const student = await this.studentsRepository.findOne({
          where: scopeSchoolId ? { matricula, schoolId: scopeSchoolId } : { matricula }
        });
        if (!student) {
          throw new Error(`No existe alumno con matrícula ${matricula}`);
        }
        if (!dryRun) {
          await this.studentsRepository.update({ id: student.id }, { groupId: group.id });
        }
        result.updated += 1;
      } catch (error) {
        result.errors.push({ row: r, message: this.errorMessage(error) });
      }
    }

    await this.pushImportLog('students-to-groups-xlsx', result, scopeSchoolId ?? null);
    return result;
  }

  async buildStudentsToGroupsTemplateXlsx(schoolId: string | null): Promise<Buffer> {
    const institution = await this.settingsService.getInstitutionProfileForSchoolId(schoolId);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Asignación');
    const headers = ['Matrícula', 'Id grupo', 'Nombre grupo', 'Grado', 'Turno', 'Año escolar'];
    const headerRow = this.applyImportTemplateBranding(
      ws,
      wb,
      institution,
      headers.length,
      'Plantilla de asignación de alumnos ya dados de alta a grupos'
    );
    const hr = ws.getRow(headerRow);
    headers.forEach((h, i) => {
      hr.getCell(i + 1).value = h;
    });
    this.styleTemplateHeaderRow(ws, headerRow, [14, 38, 22, 12, 14, 14]);
    ws.addRow(['MAT-0001', '', '1° A', '1', 'Mañana', '2026-2027']);
    this.styleTemplateExampleRow(ws, headerRow + 1, headers.length);
    ws.views = [{ state: 'frozen', ySplit: headerRow }];
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  }

  async importTeacherAssignmentsXlsx(
    buffer: Buffer,
    dryRun = false,
    scopeSchoolId?: string | null
  ): Promise<ImportCreateResult> {
    return this.importTeacherAssignmentsFile(buffer, dryRun, scopeSchoolId);
  }

  async getImportHistory(limit = 20, scopeSchoolId?: string | null) {
    const safeLimit = Math.max(1, Math.min(200, limit));
    const rows = await this.importJobsRepository.find(
      scopeSchoolId
        ? { where: { schoolId: scopeSchoolId }, order: { createdAt: 'DESC' }, take: safeLimit }
        : { order: { createdAt: 'DESC' }, take: safeLimit }
    );
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      createdAt: row.createdAt.toISOString(),
      totalRows: row.totalRows,
      created: row.createdCount,
      errorCount: row.errorCount,
      dryRun: row.dryRun
    }));
  }

  async buildTemplateGroupsXlsx(schoolId: string | null): Promise<Buffer> {
    const institution = await this.settingsService.getInstitutionProfileForSchoolId(schoolId);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Grupos');
    const headers = ['Nombre del grupo', 'Grado', 'Turno', 'Año escolar', 'Aula', 'Cupo'];
    const headerRow = this.applyImportTemplateBranding(
      ws,
      wb,
      institution,
      headers.length,
      'Plantilla de importación de grupos'
    );
    const hr = ws.getRow(headerRow);
    headers.forEach((h, i) => {
      hr.getCell(i + 1).value = h;
    });
    this.styleTemplateHeaderRow(ws, headerRow, [26, 12, 14, 16, 14, 10]);
    ws.addRow(['1° A', '1', 'Mañana', '2026-2027', 'A-101', '30']);
    this.styleTemplateExampleRow(ws, headerRow + 1, headers.length);
    ws.views = [{ state: 'frozen', ySplit: headerRow }];
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  }

  async buildTemplateStudentsXlsx(schoolId: string | null): Promise<Buffer> {
    const institution = await this.settingsService.getInstitutionProfileForSchoolId(schoolId);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Alumnos');
    const headers = [
      'Correo electrónico',
      'Contraseña',
      'Nombre completo',
      'Id grupo',
      'Acceso al campus',
      'Puede salir solo'
    ];
    const headerRow = this.applyImportTemplateBranding(
      ws,
      wb,
      institution,
      headers.length,
      'Plantilla de importación de alumnos'
    );
    const hr = ws.getRow(headerRow);
    headers.forEach((h, i) => {
      hr.getCell(i + 1).value = h;
    });
    this.styleTemplateHeaderRow(ws, headerRow, [32, 22, 30, 38, 18, 18]);
    ws.addRow([
      'alumno.ejemplo@mi-institucion.edu',
      'ContraseñaSegura8',
      'María López García',
      '',
      'No',
      'No'
    ]);
    this.styleTemplateExampleRow(ws, headerRow + 1, headers.length);
    ws.views = [{ state: 'frozen', ySplit: headerRow }];
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  }

  async buildTemplateTeachersXlsx(schoolId: string | null): Promise<Buffer> {
    const institution = await this.settingsService.getInstitutionProfileForSchoolId(schoolId);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Docentes');
    const headers = ['Correo electrónico', 'Contraseña', 'Nombre completo', 'Número de empleado', 'Acceso al campus'];
    const headerRow = this.applyImportTemplateBranding(
      ws,
      wb,
      institution,
      headers.length,
      'Plantilla de importación de docentes'
    );
    const hr = ws.getRow(headerRow);
    headers.forEach((h, i) => {
      hr.getCell(i + 1).value = h;
    });
    this.styleTemplateHeaderRow(ws, headerRow, [32, 22, 30, 22, 18]);
    ws.addRow(['docente.ejemplo@mi-institucion.edu', 'ContraseñaSegura8', 'Juan Pérez Ruiz', 'EMP-0100', 'Si']);
    this.styleTemplateExampleRow(ws, headerRow + 1, headers.length);
    ws.views = [{ state: 'frozen', ySplit: headerRow }];
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  }

  async buildTemplateTeacherAssignmentsXlsx(schoolId: string | null): Promise<Buffer> {
    const institution = await this.settingsService.getInstitutionProfileForSchoolId(schoolId);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Asignaciones');
    const subjects = schoolId
      ? await this.subjectsRepository.find({
          where: { schoolId },
          order: { code: 'ASC', name: 'ASC' }
        })
      : [];

    if (subjects.length) {
      const listWs = wb.addWorksheet('Lista_asignaturas', { state: 'hidden' });
      subjects.forEach((subj, i) => {
        listWs.getCell(i + 1, 1).value = `${subj.code} · ${subj.name}`;
      });
    }

    const headers = ['Id docente', 'Id grupo', 'Asignatura', 'Docente titular', 'Autoriza salidas'];
    const headerRow = this.applyImportTemplateBranding(
      ws,
      wb,
      institution,
      headers.length,
      'Plantilla de asignaciones docente–grupo–materia'
    );
    const hr = ws.getRow(headerRow);
    headers.forEach((h, i) => {
      hr.getCell(i + 1).value = h;
    });
    this.styleTemplateHeaderRow(ws, headerRow, [40, 40, 38, 18, 18]);

    const exampleSubject =
      subjects.length > 0 ? `${subjects[0].code} · ${subjects[0].name}` : '';
    ws.addRow([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      exampleSubject,
      'No',
      'Si'
    ]);
    this.styleTemplateExampleRow(ws, headerRow + 1, headers.length);
    if (subjects.length) {
      const wsDv = ws as ExcelJS.Worksheet & {
        dataValidations: { add: (address: string, validation: DataValidation) => void };
      };
      wsDv.dataValidations.add(`C${headerRow + 1}:C2000`, {
        type: 'list',
        allowBlank: true,
        formulae: [`Lista_asignaturas!$A$1:$A$${subjects.length}`],
        showErrorMessage: true,
        errorTitle: 'Asignatura',
        error:
          'Elija un valor de la lista institucional o deje la celda vacía si la asignación no lleva materia concreta.'
      });
    }
    ws.views = [{ state: 'frozen', ySplit: headerRow }];
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  }

  private mapExcelHeaderToField(raw: string): string | null {
    const k = this.normalizeHeaderToken(raw);
    const map: Record<string, string> = {
      matricula: 'matricula',
      grupo_id: 'grupo_id',
      group_id: 'grupo_id',
      id_grupo: 'grupo_id',
      nombre_grupo: 'nombre_grupo',
      nombre_de_grupo: 'nombre_grupo',
      grupo: 'nombre_grupo',
      grado: 'grado',
      nivel: 'grado',
      turno: 'turno',
      anio_escolar: 'anio_escolar',
      ano_escolar: 'anio_escolar',
      ciclo_escolar: 'anio_escolar',
      school_year: 'anio_escolar',
      schoolyear: 'anio_escolar'
    };
    return map[k] ?? null;
  }

  private excelCellText(row: ExcelJS.Row, colNumber: number): string {
    const c = row.getCell(colNumber);
    const t = typeof c.text === 'string' ? c.text : String(c.value ?? '');
    return t.trim();
  }

  private styleTemplateHeaderRow(ws: ExcelJS.Worksheet, headerRowIndex: number, columnWidths?: number[]) {
    const row = ws.getRow(headerRowIndex);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    row.height = 24;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      };
    });
    if (columnWidths?.length) {
      columnWidths.forEach((w, i) => {
        ws.getColumn(i + 1).width = w;
      });
    }
    ws.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: Math.max(1, row.cellCount) }
    };
  }

  /** Fila de demostración bajo encabezados (italic, fondo suave). */
  private styleTemplateExampleRow(ws: ExcelJS.Worksheet, rowIndex: number, columnCount: number) {
    const row = ws.getRow(rowIndex);
    row.height = 22;
    for (let c = 1; c <= columnCount; c++) {
      const cell = row.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' }
      };
      cell.font = { italic: true, color: { argb: 'FF475569' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    }
  }

  private async resolveGroupForExcelRow(
    fields: Record<string, string>,
    line: number,
    scopeSchoolId?: string | null
  ): Promise<GroupEntity> {
    const gid = fields.grupo_id?.trim();
    const gidAlt = fields.groupId?.trim();
    const groupId = gid || gidAlt;
    if (groupId) {
      const g = await this.groupsRepository.findOne({
        where: scopeSchoolId ? { id: groupId, schoolId: scopeSchoolId } : { id: groupId }
      });
      if (!g) throw new Error(`id_grupo inválido (${groupId})`);
      return g;
    }
    const anio = fields.anio_escolar?.trim();
    const nombre = fields.nombre_grupo?.trim();
    if (nombre && anio) {
      const g = await this.groupsRepository.findOne({
        where: scopeSchoolId
          ? { name: nombre, schoolYear: anio, schoolId: scopeSchoolId }
          : { name: nombre, schoolYear: anio }
      });
      if (!g) throw new Error(`No hay grupo con nombre "${nombre}" y año "${anio}"`);
      return g;
    }
    const grado = fields.grado?.trim();
    const turno = fields.turno?.trim();
    if (grado && turno && anio) {
      const shift = this.parseShift(turno);
      const g = await this.groupsRepository.findOne({
        where: scopeSchoolId
          ? { grade: grado, shift, schoolYear: anio, schoolId: scopeSchoolId }
          : { grade: grado, shift, schoolYear: anio }
      });
      if (!g) throw new Error('No hay grupo con grado/turno/año indicados');
      return g;
    }
    throw new Error(
      `Fila ${line}: indique grupo_id o (nombre_grupo + anio_escolar) o (grado + turno + anio_escolar)`
    );
  }

  private readonly subjectImportUuidRe =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

  private foldSubjectLabel(s: string): string {
    return s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Resuelve texto de importación (UUID, "código·nombre", código o nombre) al id de materia en la escuela del grupo.
   * Cadena vacía → sin materia (`null`).
   */
  private async resolveSubjectImportValue(
    schoolId: string,
    raw: string | undefined,
    cache: Map<string, SubjectEntity[]>
  ): Promise<string | null> {
    const t = raw?.trim();
    if (!t) return null;

    let list = cache.get(schoolId);
    if (!list) {
      list = await this.subjectsRepository.find({
        where: { schoolId },
        order: { code: 'ASC', name: 'ASC' }
      });
      cache.set(schoolId, list);
    }

    if (this.subjectImportUuidRe.test(t)) {
      const hit = list.find((s) => s.id === t);
      if (hit) return hit.id;
      const one = await this.subjectsRepository.findOne({ where: { id: t, schoolId } });
      if (one) return one.id;
      throw new Error('UUID de asignatura no válido para esta institución');
    }

    const md = '·';
    const mdIdx = t.indexOf(md);
    if (mdIdx !== -1) {
      const codePart = t.slice(0, mdIdx).trim();
      const namePart = t.slice(mdIdx + md.length).trim();
      const foldedName = this.foldSubjectLabel(namePart);
      const pairHits = list.filter(
        (s) =>
          s.code.trim().toLowerCase() === codePart.toLowerCase() &&
          this.foldSubjectLabel(s.name) === foldedName
      );
      if (pairHits.length === 1) return pairHits[0]!.id;
      if (pairHits.length > 1) {
        throw new Error('Varias asignaturas coinciden con código y nombre; use el UUID.');
      }
    }

    const byCode = list.filter((s) => s.code.trim().toLowerCase() === t.toLowerCase());
    if (byCode.length === 1) return byCode[0]!.id;
    if (byCode.length > 1) {
      throw new Error(`El código "${t}" está duplicado en el catálogo; use formato código·nombre o UUID.`);
    }

    const foldNeedle = this.foldSubjectLabel(t);
    const byName = list.filter((s) => this.foldSubjectLabel(s.name) === foldNeedle);
    if (byName.length === 1) return byName[0]!.id;
    if (byName.length > 1) {
      throw new Error(
        `Varias asignaturas se llaman "${t}". Use el código con nombre (código·nombre) o el UUID.`
      );
    }

    throw new Error(
      `No se encontró la asignatura "${t}". Déjelo vacío si no aplica, o use la lista de la plantilla o el UUID.`
    );
  }

  private async parseXlsxFirstSheetToRows(
    buffer: Buffer
  ): Promise<{ rows: Array<Record<string, string>>; headerRowIndex: number }> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as never);
    } catch {
      throw new BadRequestException('No se pudo leer el archivo Excel');
    }
    const ws = workbook.worksheets[0];
    if (!ws) throw new BadRequestException('El archivo no tiene hojas');

    const headerRowIndex = this.findXlsxDataHeaderRow(ws);
    const headerRow = ws.getRow(headerRowIndex);
    const colByName = new Map<string, number>();
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const raw = String(cell.value ?? '').trim();
      if (raw) colByName.set(this.canonicalImportHeader(raw), colNumber);
    });
    if (colByName.size === 0) {
      throw new BadRequestException('Debe existir una fila con encabezados de columnas (nombre de cada columna)');
    }

    const rows: Array<Record<string, string>> = [];
    const lastRow = ws.lastRow?.number ?? 1;
    for (let r = headerRowIndex + 1; r <= lastRow; r++) {
      const line = ws.getRow(r);
      const obj: Record<string, string> = {};
      for (const [header, col] of colByName) {
        obj[header] = this.excelCellText(line, col);
      }
      if (Object.values(obj).some((v) => v.trim().length > 0)) {
        rows.push(obj);
      }
    }
    return { rows, headerRowIndex };
  }


  private required(row: Record<string, string>, key: string) {
    const value = row[key]?.trim();
    if (!value) throw new Error(`Campo obligatorio faltante: ${key}`);
    return value;
  }

  private optional(row: Record<string, string>, key: string) {
    const value = row[key]?.trim();
    return value ? value : undefined;
  }

  private parseShift(value: string | undefined): ShiftType | undefined {
    if (!value) return undefined;
    const normalized = value
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (normalized === ShiftType.MATUTINO || normalized === 'MANANA') return ShiftType.MATUTINO;
    if (normalized === ShiftType.VESPERTINO || normalized === 'TARDE') return ShiftType.VESPERTINO;
    if (normalized === ShiftType.NOCTURNO || normalized === 'NOCHE') return ShiftType.NOCTURNO;
    throw new Error('turno inválido (usa Mañana|Tarde|Noche o MATUTINO|VESPERTINO|NOCTURNO)');
  }

  private parseIntOptional(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const n = Number.parseInt(value, 10);
    if (Number.isNaN(n)) throw new Error('capacity debe ser número entero');
    return n;
  }

  private parseBoolOptional(value: string | undefined): boolean | undefined {
    if (value == null) return undefined;
    const t = String(value).trim();
    if (!t) return undefined;
    const n = t
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    if (['true', '1', 'si', 'sí', 'yes', 'verdadero', 'activo', 'activa', 'on'].includes(n)) return true;
    if (['false', '0', 'no', 'falso', 'inactivo', 'inactiva', 'off'].includes(n)) return false;
    throw new Error(`Use Si o No en esta columna (valor recibido: "${value}")`);
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return 'Error desconocido al procesar fila';
  }

  private async pushImportLog(
    kind:
      | 'groups'
      | 'students'
      | 'teachers'
      | 'teacher-assignments'
      | 'students-to-groups-xlsx',
    result: ImportCreateResult | XlsxAssignResult,
    schoolId: string | null
  ) {
    const createdCount = 'created' in result ? result.created : result.updated;
    const row = this.importJobsRepository.create({
      kind,
      totalRows: result.totalRows,
      createdCount,
      errorCount: result.errors.length,
      dryRun: result.dryRun,
      schoolId,
      errorsJson: result.errors.length ? result.errors : null
    });
    await this.importJobsRepository.save(row);
  }
}

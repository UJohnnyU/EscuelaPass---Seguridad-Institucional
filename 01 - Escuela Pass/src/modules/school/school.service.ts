import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import ExcelJS from 'exceljs';
import { IsNull, Repository } from 'typeorm';
import { GroupEntity } from '../../database/entities/group.entity';
import { ImportJobEntity } from '../../database/entities/import-job.entity';
import { ShiftType } from '../../database/entities/shift-type.enum';
import { StudentEntity } from '../../database/entities/student.entity';
import { SubjectEntity } from '../../database/entities/subject.entity';
import { TeacherGroupEntity } from '../../database/entities/teacher-group.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AssignTeacherGroupDto } from './dto/assign-teacher-group.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

type CsvImportResult = {
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

@Injectable()
export class SchoolService {
  constructor(
    @InjectRepository(GroupEntity)
    private readonly groupsRepository: Repository<GroupEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjectsRepository: Repository<SubjectEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(TeacherGroupEntity)
    private readonly teacherGroupsRepository: Repository<TeacherGroupEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(ImportJobEntity)
    private readonly importJobsRepository: Repository<ImportJobEntity>
  ) {}

  // --- Grupos ---
  listGroups() {
    return this.groupsRepository.find({ order: { schoolYear: 'DESC', name: 'ASC' } });
  }

  async getGroup(id: string) {
    const g = await this.groupsRepository.findOne({ where: { id } });
    if (!g) throw new NotFoundException('Grupo no encontrado');
    return g;
  }

  async createGroup(dto: CreateGroupDto) {
    const row = this.groupsRepository.create({
      name: dto.name,
      grade: dto.grade ?? null,
      shift: dto.shift ?? ShiftType.MATUTINO,
      schoolYear: dto.schoolYear,
      classroom: dto.classroom ?? null,
      capacity: dto.capacity ?? null,
      status: true
    });
    return this.groupsRepository.save(row);
  }

  async updateGroup(id: string, dto: UpdateGroupDto) {
    const g = await this.getGroup(id);
    if (dto.name !== undefined) g.name = dto.name;
    if (dto.grade !== undefined) g.grade = dto.grade;
    if (dto.shift !== undefined) g.shift = dto.shift;
    if (dto.schoolYear !== undefined) g.schoolYear = dto.schoolYear;
    if (dto.classroom !== undefined) g.classroom = dto.classroom;
    if (dto.capacity !== undefined) g.capacity = dto.capacity;
    if (dto.status !== undefined) g.status = dto.status;
    return this.groupsRepository.save(g);
  }

  async removeGroup(id: string) {
    await this.getGroup(id);
    await this.groupsRepository.delete({ id });
    return { message: 'Grupo eliminado', id };
  }

  // --- Materias ---
  listSubjects() {
    return this.subjectsRepository.find({ order: { name: 'ASC' } });
  }

  async getSubject(id: string) {
    const s = await this.subjectsRepository.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Materia no encontrada');
    return s;
  }

  async createSubject(dto: CreateSubjectDto) {
    const existing = await this.subjectsRepository.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Ya existe una materia con ese nombre');
    const row = this.subjectsRepository.create({
      name: dto.name,
      description: dto.description ?? null
    });
    return this.subjectsRepository.save(row);
  }

  async updateSubject(id: string, dto: UpdateSubjectDto) {
    const s = await this.getSubject(id);
    if (dto.name !== undefined && dto.name !== s.name) {
      const clash = await this.subjectsRepository.findOne({ where: { name: dto.name } });
      if (clash) throw new ConflictException('Ya existe una materia con ese nombre');
      s.name = dto.name;
    }
    if (dto.description !== undefined) s.description = dto.description;
    return this.subjectsRepository.save(s);
  }

  async removeSubject(id: string) {
    await this.getSubject(id);
    await this.subjectsRepository.delete({ id });
    return { message: 'Materia eliminada', id };
  }

  // --- Estudiantes (usuario + perfil) ---
  async listStudents() {
    return this.studentsRepository
      .createQueryBuilder('s')
      .innerJoin(UserEntity, 'u', 'u.id = s.userId')
      .select([
        's.id AS id',
        's.matricula AS matricula',
        's.groupId AS "groupId"',
        's.canLeaveAlone AS "canLeaveAlone"',
        'u.email AS email',
        'u.fullName AS "fullName"',
        'u.canAccessCampus AS "canAccessCampus"',
        'u.status AS "userStatus"'
      ])
      .orderBy('u.full_name', 'ASC')
      .getRawMany();
  }

  async getStudent(id: string) {
    const row = await this.studentsRepository
      .createQueryBuilder('s')
      .innerJoin(UserEntity, 'u', 'u.id = s.userId')
      .select([
        's.id AS id',
        's.matricula AS matricula',
        's.groupId AS "groupId"',
        's.canLeaveAlone AS "canLeaveAlone"',
        'u.id AS "userId"',
        'u.email AS email',
        'u.fullName AS "fullName"',
        'u.canAccessCampus AS "canAccessCampus"',
        'u.status AS "userStatus"'
      ])
      .where('s.id = :id', { id })
      .getRawOne();
    if (!row) throw new NotFoundException('Estudiante no encontrado');
    return row;
  }

  async createStudent(dto: CreateStudentDto) {
    const emailTaken = await this.usersRepository.findOne({ where: { email: dto.email } });
    if (emailTaken) throw new ConflictException('El correo ya está registrado');
    const matTaken = await this.studentsRepository.findOne({ where: { matricula: dto.matricula } });
    if (matTaken) throw new ConflictException('La matrícula ya existe');

    if (dto.groupId) {
      const g = await this.groupsRepository.findOne({ where: { id: dto.groupId } });
      if (!g) throw new NotFoundException('Grupo no encontrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({
      email: dto.email,
      passwordHash,
      role: UserRole.ALUMNO,
      fullName: dto.fullName,
      canAccessCampus: dto.canAccessCampus ?? false,
      status: true
    });
    const savedUser = await this.usersRepository.save(user);

    const student = this.studentsRepository.create({
      userId: savedUser.id,
      matricula: dto.matricula,
      groupId: dto.groupId ?? null,
      canLeaveAlone: dto.canLeaveAlone ?? false
    });
    const savedStudent = await this.studentsRepository.save(student);
    return this.getStudent(savedStudent.id);
  }

  async updateStudent(id: string, dto: UpdateStudentDto) {
    await this.getStudent(id);
    if (dto.groupId !== undefined && dto.groupId !== null) {
      const g = await this.groupsRepository.findOne({ where: { id: dto.groupId } });
      if (!g) throw new NotFoundException('Grupo no encontrado');
    }
    const patch: Partial<StudentEntity> = {};
    if (dto.groupId !== undefined) patch.groupId = dto.groupId;
    if (dto.matricula !== undefined) {
      const clash = await this.studentsRepository.findOne({ where: { matricula: dto.matricula } });
      if (clash && clash.id !== id) throw new ConflictException('La matrícula ya existe');
      patch.matricula = dto.matricula;
    }
    if (dto.canLeaveAlone !== undefined) patch.canLeaveAlone = dto.canLeaveAlone;
    if (Object.keys(patch).length) await this.studentsRepository.update({ id }, patch);
    return this.getStudent(id);
  }

  // --- Docentes ---
  async listTeachers() {
    return this.teachersRepository
      .createQueryBuilder('t')
      .innerJoin(UserEntity, 'u', 'u.id = t.userId')
      .select([
        't.id AS id',
        't.employeeNumber AS "employeeNumber"',
        'u.email AS email',
        'u.fullName AS "fullName"',
        'u.canAccessCampus AS "canAccessCampus"',
        'u.status AS "userStatus"'
      ])
      .orderBy('u.full_name', 'ASC')
      .getRawMany();
  }

  async getTeacher(id: string) {
    const row = await this.teachersRepository
      .createQueryBuilder('t')
      .innerJoin(UserEntity, 'u', 'u.id = t.userId')
      .select([
        't.id AS id',
        't.employeeNumber AS "employeeNumber"',
        'u.id AS "userId"',
        'u.email AS email',
        'u.fullName AS "fullName"',
        'u.canAccessCampus AS "canAccessCampus"',
        'u.status AS "userStatus"'
      ])
      .where('t.id = :id', { id })
      .getRawOne();
    if (!row) throw new NotFoundException('Docente no encontrado');
    return row;
  }

  async createTeacher(dto: CreateTeacherDto) {
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
      canAccessCampus: dto.canAccessCampus ?? false,
      status: true
    });
    const savedUser = await this.usersRepository.save(user);

    const teacher = this.teachersRepository.create({
      userId: savedUser.id,
      employeeNumber: dto.employeeNumber
    });
    const saved = await this.teachersRepository.save(teacher);
    return this.getTeacher(saved.id);
  }

  async updateTeacher(id: string, dto: UpdateTeacherDto) {
    const t = await this.teachersRepository.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Docente no encontrado');

    if (dto.employeeNumber !== undefined && dto.employeeNumber !== t.employeeNumber) {
      const clash = await this.teachersRepository.findOne({ where: { employeeNumber: dto.employeeNumber } });
      if (clash) throw new ConflictException('El número de empleado ya existe');
      t.employeeNumber = dto.employeeNumber;
      await this.teachersRepository.save(t);
    }

    const userPatch: Partial<UserEntity> = {};
    if (dto.fullName !== undefined) userPatch.fullName = dto.fullName;
    if (dto.canAccessCampus !== undefined) userPatch.canAccessCampus = dto.canAccessCampus;
    if (Object.keys(userPatch).length) await this.usersRepository.update({ id: t.userId }, userPatch);

    return this.getTeacher(id);
  }

  // --- Asignaciones docente–grupo–materia ---
  async listTeacherAssignments(teacherId?: string, groupId?: string) {
    const qb = this.teacherGroupsRepository
      .createQueryBuilder('tg')
      .orderBy('tg.createdAt', 'DESC');
    if (teacherId) qb.andWhere('tg.teacher_id = :teacherId', { teacherId });
    if (groupId) qb.andWhere('tg.group_id = :groupId', { groupId });
    return qb.getMany();
  }

  async assignTeacherGroup(dto: AssignTeacherGroupDto) {
    const teacher = await this.teachersRepository.findOne({ where: { id: dto.teacherId } });
    if (!teacher) throw new NotFoundException('Docente no encontrado');
    const group = await this.groupsRepository.findOne({ where: { id: dto.groupId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    if (dto.subjectId) {
      const sub = await this.subjectsRepository.findOne({ where: { id: dto.subjectId } });
      if (!sub) throw new NotFoundException('Materia no encontrada');
    }

    const existing = await this.teacherGroupsRepository.findOne({
      where: {
        teacherId: dto.teacherId,
        groupId: dto.groupId,
        subjectId: dto.subjectId ? dto.subjectId : IsNull()
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
      subjectId: dto.subjectId ?? null,
      isMainTeacher: dto.isMainTeacher ?? false,
      canAuthorizeDepartures: dto.canAuthorizeDepartures ?? false
    });
    return this.teacherGroupsRepository.save(row);
  }

  async removeTeacherAssignment(id: string) {
    const row = await this.teacherGroupsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Asignación no encontrada');
    await this.teacherGroupsRepository.delete({ id });
    return { message: 'Asignación eliminada', id };
  }

  // --- Cargas masivas Excel (.xlsx), primera hoja, fila 1 = encabezados (mismos nombres que antes en CSV) ---

  async importGroupsXlsx(buffer: Buffer, dryRun = false): Promise<CsvImportResult> {
    const rows = await this.parseXlsxFirstSheetToRows(buffer);
    const result: CsvImportResult = { totalRows: rows.length, created: 0, errors: [], dryRun };
    for (let i = 0; i < rows.length; i++) {
      const line = i + 2;
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
        if (!dryRun) await this.createGroup(dto);
        result.created += 1;
      } catch (error) {
        result.errors.push({ row: line, message: this.errorMessage(error) });
      }
    }
    await this.pushImportLog('groups', result);
    return result;
  }

  async importStudentsXlsx(buffer: Buffer, dryRun = false): Promise<CsvImportResult> {
    const rows = await this.parseXlsxFirstSheetToRows(buffer);
    const result: CsvImportResult = { totalRows: rows.length, created: 0, errors: [], dryRun };
    for (let i = 0; i < rows.length; i++) {
      const line = i + 2;
      const row = rows[i];
      try {
        const dto: CreateStudentDto = {
          email: this.required(row, 'email'),
          password: this.required(row, 'password'),
          fullName: this.required(row, 'fullName'),
          matricula: this.required(row, 'matricula'),
          groupId: this.optional(row, 'groupId'),
          canAccessCampus: this.parseBoolOptional(this.optional(row, 'canAccessCampus')),
          canLeaveAlone: this.parseBoolOptional(this.optional(row, 'canLeaveAlone'))
        };
        if (!dryRun) await this.createStudent(dto);
        result.created += 1;
      } catch (error) {
        result.errors.push({ row: line, message: this.errorMessage(error) });
      }
    }
    await this.pushImportLog('students', result);
    return result;
  }

  async importTeachersXlsx(buffer: Buffer, dryRun = false): Promise<CsvImportResult> {
    const rows = await this.parseXlsxFirstSheetToRows(buffer);
    const result: CsvImportResult = { totalRows: rows.length, created: 0, errors: [], dryRun };
    for (let i = 0; i < rows.length; i++) {
      const line = i + 2;
      const row = rows[i];
      try {
        const dto: CreateTeacherDto = {
          email: this.required(row, 'email'),
          password: this.required(row, 'password'),
          fullName: this.required(row, 'fullName'),
          employeeNumber: this.required(row, 'employeeNumber'),
          canAccessCampus: this.parseBoolOptional(this.optional(row, 'canAccessCampus'))
        };
        if (!dryRun) await this.createTeacher(dto);
        result.created += 1;
      } catch (error) {
        result.errors.push({ row: line, message: this.errorMessage(error) });
      }
    }
    await this.pushImportLog('teachers', result);
    return result;
  }

  /**
   * Excel exclusivo para asignar alumnos existentes a grupos (grado/turno/año o nombre de grupo).
   * Columnas esperadas (fila 1): matricula, y uno de: grupo_id | (nombre_grupo + anio_escolar) | (grado + turno + anio_escolar).
   */
  async importStudentsToGroupsFromXlsx(buffer: Buffer, dryRun = false): Promise<XlsxAssignResult> {
    const workbook = new ExcelJS.Workbook();
    try {
      // Compat tipos Node 22 / exceljs
      await workbook.xlsx.load(buffer as never);
    } catch {
      throw new BadRequestException('No se pudo leer el archivo Excel');
    }
    const ws = workbook.worksheets[0];
    if (!ws) throw new BadRequestException('El archivo no tiene hojas');

    const headerRow = ws.getRow(1);
    const colByField = new Map<string, number>();
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const raw = String(cell.value ?? '').trim();
      if (!raw) return;
      const field = this.mapExcelHeaderToField(raw);
      if (field) colByField.set(field, colNumber);
    });

    if (!colByField.has('matricula')) {
      throw new BadRequestException('La primera fila debe incluir la columna "matricula"');
    }

    const result: XlsxAssignResult = {
      totalRows: 0,
      updated: 0,
      errors: [],
      dryRun
    };

    const lastRow = ws.lastRow?.number ?? 1;
    for (let r = 2; r <= lastRow; r++) {
      const row = ws.getRow(r);
      const fields: Record<string, string> = {};
      for (const [field, col] of colByField) {
        fields[field] = this.excelCellText(row, col);
      }
      const matricula = fields.matricula?.trim();
      if (!matricula) continue;

      result.totalRows += 1;
      try {
        const group = await this.resolveGroupForExcelRow(fields, r);
        const student = await this.studentsRepository.findOne({ where: { matricula } });
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

    await this.pushImportLog('students-to-groups-xlsx', result);
    return result;
  }

  async buildStudentsToGroupsTemplateXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Asignacion');
    ws.addRow([
      'matricula',
      'grupo_id',
      'nombre_grupo',
      'grado',
      'turno',
      'anio_escolar'
    ]);
    ws.addRow(['MAT-0001', '', '1A', '1', 'MATUTINO', '2026-2027']);
    ws.getRow(1).font = { bold: true };
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  }

  async importTeacherAssignmentsXlsx(buffer: Buffer, dryRun = false): Promise<CsvImportResult> {
    const rows = await this.parseXlsxFirstSheetToRows(buffer);
    const result: CsvImportResult = { totalRows: rows.length, created: 0, errors: [], dryRun };
    for (let i = 0; i < rows.length; i++) {
      const line = i + 2;
      const row = rows[i];
      try {
        const dto: AssignTeacherGroupDto = {
          teacherId: this.required(row, 'teacherId'),
          groupId: this.required(row, 'groupId'),
          subjectId: this.optional(row, 'subjectId'),
          isMainTeacher: this.parseBoolOptional(this.optional(row, 'isMainTeacher')),
          canAuthorizeDepartures: this.parseBoolOptional(this.optional(row, 'canAuthorizeDepartures'))
        };
        if (!dryRun) await this.assignTeacherGroup(dto);
        result.created += 1;
      } catch (error) {
        result.errors.push({ row: line, message: this.errorMessage(error) });
      }
    }
    await this.pushImportLog('teacher-assignments', result);
    return result;
  }

  async getImportHistory(limit = 20) {
    const safeLimit = Math.max(1, Math.min(200, limit));
    const rows = await this.importJobsRepository.find({
      order: { createdAt: 'DESC' },
      take: safeLimit
    });
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

  async buildTemplateGroupsXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Grupos');
    ws.addRow(['name', 'grade', 'shift', 'schoolYear', 'classroom', 'capacity']);
    ws.addRow(['1A', '1', 'MATUTINO', '2026-2027', 'A-101', '30']);
    ws.getRow(1).font = { bold: true };
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  }

  async buildTemplateStudentsXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Alumnos');
    ws.addRow([
      'email',
      'password',
      'fullName',
      'matricula',
      'groupId',
      'canAccessCampus',
      'canLeaveAlone'
    ]);
    ws.addRow([
      'alumno.nuevo@escuelapass.local',
      'Alumno123*',
      'Alumno Nuevo',
      'MAT-1001',
      '',
      'false',
      'false'
    ]);
    ws.getRow(1).font = { bold: true };
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  }

  async buildTemplateTeachersXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Docentes');
    ws.addRow(['email', 'password', 'fullName', 'employeeNumber', 'canAccessCampus']);
    ws.addRow(['docente.nuevo@escuelapass.local', 'Docente123*', 'Docente Nuevo', 'EMP-1001', 'true']);
    ws.getRow(1).font = { bold: true };
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  }

  async buildTemplateTeacherAssignmentsXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Asignaciones');
    ws.addRow([
      'teacherId',
      'groupId',
      'subjectId',
      'isMainTeacher',
      'canAuthorizeDepartures'
    ]);
    ws.addRow([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '',
      'true',
      'false'
    ]);
    ws.getRow(1).font = { bold: true };
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  }

  private mapExcelHeaderToField(raw: string): string | null {
    const k = raw
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');
    const map: Record<string, string> = {
      matricula: 'matricula',
      grupo_id: 'grupo_id',
      group_id: 'grupo_id',
      nombre_grupo: 'nombre_grupo',
      grupo: 'nombre_grupo',
      grado: 'grado',
      turno: 'turno',
      anio_escolar: 'anio_escolar',
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

  private async resolveGroupForExcelRow(
    fields: Record<string, string>,
    line: number
  ): Promise<GroupEntity> {
    const gid = fields.grupo_id?.trim();
    if (gid) {
      const g = await this.groupsRepository.findOne({ where: { id: gid } });
      if (!g) throw new Error(`grupo_id inválido (${gid})`);
      return g;
    }
    const anio = fields.anio_escolar?.trim();
    const nombre = fields.nombre_grupo?.trim();
    if (nombre && anio) {
      const g = await this.groupsRepository.findOne({ where: { name: nombre, schoolYear: anio } });
      if (!g) throw new Error(`No hay grupo con nombre "${nombre}" y año "${anio}"`);
      return g;
    }
    const grado = fields.grado?.trim();
    const turno = fields.turno?.trim();
    if (grado && turno && anio) {
      const shift = this.parseShift(turno);
      const g = await this.groupsRepository.findOne({
        where: { grade: grado, shift, schoolYear: anio }
      });
      if (!g) throw new Error('No hay grupo con grado/turno/año indicados');
      return g;
    }
    throw new Error(
      `Fila ${line}: indique grupo_id o (nombre_grupo + anio_escolar) o (grado + turno + anio_escolar)`
    );
  }

  private async parseXlsxFirstSheetToRows(buffer: Buffer): Promise<Array<Record<string, string>>> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as never);
    } catch {
      throw new BadRequestException('No se pudo leer el archivo Excel');
    }
    const ws = workbook.worksheets[0];
    if (!ws) throw new BadRequestException('El archivo no tiene hojas');

    const headerRow = ws.getRow(1);
    const colByName = new Map<string, number>();
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const raw = String(cell.value ?? '').trim();
      if (raw) colByName.set(raw, colNumber);
    });
    if (colByName.size === 0) {
      throw new BadRequestException('La primera fila debe contener encabezados de columnas');
    }

    const rows: Array<Record<string, string>> = [];
    const lastRow = ws.lastRow?.number ?? 1;
    for (let r = 2; r <= lastRow; r++) {
      const line = ws.getRow(r);
      const obj: Record<string, string> = {};
      for (const [header, col] of colByName) {
        obj[header] = this.excelCellText(line, col);
      }
      if (Object.values(obj).some((v) => v.trim().length > 0)) {
        rows.push(obj);
      }
    }
    return rows;
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
    if (value === ShiftType.MATUTINO || value === ShiftType.VESPERTINO || value === ShiftType.NOCTURNO) {
      return value;
    }
    throw new Error('shift inválido (usa MATUTINO|VESPERTINO|NOCTURNO)');
  }

  private parseIntOptional(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const n = Number.parseInt(value, 10);
    if (Number.isNaN(n)) throw new Error('capacity debe ser número entero');
    return n;
  }

  private parseBoolOptional(value: string | undefined): boolean | undefined {
    if (!value) return undefined;
    const normalized = value.toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'si' || normalized === 'sí') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    throw new Error(`Valor booleano inválido: ${value}`);
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
    result: CsvImportResult | XlsxAssignResult
  ) {
    const createdCount = 'created' in result ? result.created : result.updated;
    const row = this.importJobsRepository.create({
      kind,
      totalRows: result.totalRows,
      createdCount,
      errorCount: result.errors.length,
      dryRun: result.dryRun,
      errorsJson: result.errors.length ? result.errors : null
    });
    await this.importJobsRepository.save(row);
  }
}

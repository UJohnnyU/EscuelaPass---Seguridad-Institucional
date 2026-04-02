import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsNull, Repository } from 'typeorm';
import { GroupEntity } from '../../database/entities/group.entity';
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
    private readonly usersRepository: Repository<UserEntity>
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
}

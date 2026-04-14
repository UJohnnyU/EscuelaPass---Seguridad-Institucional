import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { GradeEntity } from '../../database/entities/grade.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserRole } from '../../database/entities/user.entity';
import { BatchRegisterGradesDto } from './dto/batch-register-grades.dto';
import { RegisterGradeDto } from './dto/register-grade.dto';

export type TeacherAssignmentRow = {
  groupId: string;
  groupName: string | null;
  grade: string | null;
  schoolYear: string | null;
  subjectId: string;
  subjectName: string;
};

export type ActivityBoardRow = {
  studentId: string;
  matricula: string;
  fullName: string;
  grade: {
    id: string;
    score: string;
    maxScore: string;
    notes: string | null;
    gradedAt: string;
  } | null;
};

@Injectable()
export class GradesService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(GradeEntity)
    private readonly gradesRepository: Repository<GradeEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>
  ) {}

  private normText(s: string): string {
    return s.trim().replace(/\s+/g, ' ');
  }

  async listTeacherAssignments(userId: string): Promise<TeacherAssignmentRow[]> {
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');

    const rows = await this.studentsRepository.manager.query<TeacherAssignmentRow[]>(
      `SELECT
         g.id AS "groupId",
         g.name AS "groupName",
         g.grade AS "grade",
         g.school_year AS "schoolYear",
         s.id AS "subjectId",
         s.name AS "subjectName"
       FROM teacher_groups tg
       INNER JOIN groups g ON g.id = tg.group_id
       INNER JOIN subjects s ON s.id = tg.subject_id
       WHERE tg.teacher_id = $1 AND tg.subject_id IS NOT NULL
       ORDER BY g.name ASC NULLS LAST, s.name ASC`,
      [teacher.id]
    );
    return rows;
  }

  async getActivityBoard(
    userId: string,
    groupId: string,
    period: string | undefined,
    subject: string | undefined,
    assessmentName: string | undefined
  ) {
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');

    const periodNorm = period ? this.normText(period) : '';
    const subjectNorm = subject ? this.normText(subject) : '';
    const assessmentNorm = assessmentName ? this.normText(assessmentName) : '';

    if (!periodNorm || !subjectNorm || !assessmentNorm) {
      throw new BadRequestException('period, subject y assessmentName son obligatorios');
    }

    const canonicalSubject = await this.resolveCanonicalSubjectForTeacher(teacher.id, groupId, subjectNorm);

    const maxRows = await this.studentsRepository.manager.query<{ max_score: string | null }[]>(
      `SELECT g.max_score::text AS max_score
       FROM grades g
       WHERE g.group_id = $1
         AND LOWER(TRIM(g.period)) = LOWER(TRIM($2::text))
         AND LOWER(TRIM(g.subject)) = LOWER(TRIM($3::text))
         AND LOWER(TRIM(g.assessment_name)) = LOWER(TRIM($4::text))
       LIMIT 1`,
      [groupId, periodNorm, canonicalSubject, assessmentNorm]
    );
    const maxScoreFromDb = maxRows[0]?.max_score ?? null;

    const roster = await this.studentsRepository.manager.query<
      { id: string; matricula: string; full_name: string }[]
    >(
      `SELECT s.id, s.matricula, u.full_name
       FROM students s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.group_id = $1
       ORDER BY u.full_name ASC NULLS LAST, s.matricula ASC`,
      [groupId]
    );

    const gradeRows = await this.studentsRepository.manager.query<
      {
        student_id: string;
        id: string;
        score: string;
        max_score: string;
        notes: string | null;
        graded_at: Date;
      }[]
    >(
      `SELECT g.student_id, g.id, g.score::text, g.max_score::text, g.notes, g.graded_at
       FROM grades g
       WHERE g.group_id = $1
         AND LOWER(TRIM(g.period)) = LOWER(TRIM($2::text))
         AND LOWER(TRIM(g.subject)) = LOWER(TRIM($3::text))
         AND LOWER(TRIM(g.assessment_name)) = LOWER(TRIM($4::text))`,
      [groupId, periodNorm, canonicalSubject, assessmentNorm]
    );

    const byStudent = new Map<string, (typeof gradeRows)[0]>();
    for (const gr of gradeRows) {
      byStudent.set(gr.student_id, gr);
    }

    const boardRows: ActivityBoardRow[] = roster.map((r) => {
      const g = byStudent.get(r.id);
      return {
        studentId: r.id,
        matricula: r.matricula,
        fullName: r.full_name,
        grade: g
          ? {
              id: g.id,
              score: g.score,
              maxScore: g.max_score,
              notes: g.notes,
              gradedAt: g.graded_at instanceof Date ? g.graded_at.toISOString() : String(g.graded_at)
            }
          : null
      };
    });

    return {
      groupId,
      subject: canonicalSubject,
      period: periodNorm,
      assessmentName: assessmentNorm,
      maxScore: maxScoreFromDb !== null ? Number(maxScoreFromDb) : null,
      rows: boardRows
    };
  }

  async registerBatch(dto: BatchRegisterGradesDto, userId: string, role: UserRole) {
    if (role !== UserRole.ADMIN && role !== UserRole.ADMINISTRATIVO && role !== UserRole.DOCENTE) {
      throw new ForbiddenException('Solo docente o administración puede registrar calificaciones en lote');
    }

    const periodNorm = this.normText(dto.period);
    const assessmentNorm = this.normText(dto.assessmentName);
    const maxScore = dto.maxScore;

    const canonicalSubject = await this.resolveSubjectForGrading(role, userId, dto.groupId, dto.subject);

    if (role === UserRole.DOCENTE) {
      await this.assertTeacherTeachesSubjectInGroupByUserId(userId, dto.groupId, canonicalSubject);
    }

    await this.dataSource.transaction(async (mgr) => {
      const gradeRepo = mgr.getRepository(GradeEntity);
      const studentRepo = mgr.getRepository(StudentEntity);

      for (const entry of dto.entries) {
        if (entry.score > maxScore) {
          throw new BadRequestException(`La calificación no puede superar el máximo (${maxScore})`);
        }

        const student = await studentRepo.findOne({ where: { id: entry.studentId } });
        if (!student) throw new NotFoundException(`Estudiante no encontrado: ${entry.studentId}`);
        if (student.groupId !== dto.groupId) {
          throw new BadRequestException('El estudiante no pertenece al grupo indicado');
        }

        const existing = await gradeRepo
          .createQueryBuilder('g')
          .where('g.student_id = :sid', { sid: entry.studentId })
          .andWhere('LOWER(TRIM(g.period)) = LOWER(:period)', { period: periodNorm })
          .andWhere('LOWER(TRIM(g.subject)) = LOWER(:subj)', { subj: canonicalSubject })
          .andWhere('LOWER(TRIM(g.assessment_name)) = LOWER(:an)', { an: assessmentNorm })
          .getOne();

        if (existing) {
          existing.score = String(entry.score);
          existing.maxScore = String(maxScore);
          existing.notes = entry.notes?.trim() ? this.normText(entry.notes) : null;
          existing.gradedBy = userId;
          existing.gradedAt = new Date();
          existing.groupId = dto.groupId;
          await gradeRepo.save(existing);
        } else {
          const row = gradeRepo.create({
            studentId: entry.studentId,
            groupId: dto.groupId,
            subject: canonicalSubject,
            period: periodNorm,
            assessmentName: assessmentNorm,
            score: String(entry.score),
            maxScore: String(maxScore),
            notes: entry.notes?.trim() ? this.normText(entry.notes) : null,
            gradedBy: userId,
            gradedAt: new Date()
          });
          await gradeRepo.save(row);
        }
      }
    });

    return { ok: true, count: dto.entries.length };
  }

  async register(dto: RegisterGradeDto, userId: string, role: UserRole) {
    const student = await this.studentsRepository.findOne({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    const periodNorm = this.normText(dto.period);
    const assessmentNorm = this.normText(dto.assessmentName);
    const maxScore = dto.maxScore ?? 100;

    const groupId = student.groupId;
    if (!groupId) throw new BadRequestException('El estudiante no tiene grupo asignado');

    const canonicalSubject = await this.resolveSubjectForGrading(role, userId, groupId, dto.subject);

    await this.assertCanGradeStudent(userId, role, student, canonicalSubject);

    if (dto.score > maxScore) {
      throw new BadRequestException('score no puede ser mayor que maxScore');
    }

    const existing = await this.gradesRepository
      .createQueryBuilder('g')
      .where('g.student_id = :sid', { sid: dto.studentId })
      .andWhere('LOWER(TRIM(g.period)) = LOWER(:period)', { period: periodNorm })
      .andWhere('LOWER(TRIM(g.subject)) = LOWER(:subj)', { subj: canonicalSubject })
      .andWhere('LOWER(TRIM(g.assessment_name)) = LOWER(:an)', { an: assessmentNorm })
      .getOne();

    if (existing) {
      existing.score = String(dto.score);
      existing.maxScore = String(maxScore);
      existing.notes = dto.notes?.trim() ? this.normText(dto.notes) : null;
      existing.gradedBy = userId;
      existing.gradedAt = dto.gradedAt ? new Date(dto.gradedAt) : new Date();
      existing.groupId = groupId;
      existing.subject = canonicalSubject;
      existing.period = periodNorm;
      existing.assessmentName = assessmentNorm;
      return this.gradesRepository.save(existing);
    }

    const row = this.gradesRepository.create({
      studentId: dto.studentId,
      groupId,
      subject: canonicalSubject,
      period: periodNorm,
      assessmentName: assessmentNorm,
      score: String(dto.score),
      maxScore: String(maxScore),
      notes: dto.notes?.trim() ? this.normText(dto.notes) : null,
      gradedBy: userId,
      gradedAt: dto.gradedAt ? new Date(dto.gradedAt) : new Date()
    });
    return this.gradesRepository.save(row);
  }

  private async resolveSubjectForGrading(
    role: UserRole,
    userId: string,
    groupId: string,
    subjectInput: string
  ): Promise<string> {
    const norm = this.normText(subjectInput);
    if (!norm) throw new BadRequestException('La materia es obligatoria');

    if (role === UserRole.ADMIN) {
      const rows = await this.studentsRepository.manager.query<{ name: string }[]>(
        `SELECT name FROM subjects WHERE LOWER(TRIM(name)) = LOWER(TRIM($1::text)) LIMIT 1`,
        [norm]
      );
      return rows[0]?.name ?? norm;
    }
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessGroup(userId, groupId);
      const rows = await this.studentsRepository.manager.query<{ name: string }[]>(
        `SELECT name
         FROM subjects
         WHERE school_id = (SELECT school_id FROM groups WHERE id = $1)
           AND LOWER(TRIM(name)) = LOWER(TRIM($2::text))
         LIMIT 1`,
        [groupId, norm]
      );
      return rows[0]?.name ?? norm;
    }

    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    return this.resolveCanonicalSubjectForTeacher(teacher.id, groupId, norm);
  }

  private async resolveCanonicalSubjectForTeacher(
    teacherId: string,
    groupId: string,
    subjectNorm: string
  ): Promise<string> {
    const rows = await this.studentsRepository.manager.query<{ name: string }[]>(
      `SELECT s.name
       FROM teacher_groups tg
       INNER JOIN subjects s ON s.id = tg.subject_id
       WHERE tg.teacher_id = $1
         AND tg.group_id = $2
         AND tg.subject_id IS NOT NULL
         AND LOWER(TRIM(s.name)) = LOWER(TRIM($3::text))
       LIMIT 1`,
      [teacherId, groupId, subjectNorm]
    );
    if (!rows.length) {
      throw new ForbiddenException('No imparte esta materia en el grupo indicado');
    }
    return rows[0].name;
  }

  private async assertTeacherTeachesSubjectInGroupByUserId(
    userId: string,
    groupId: string,
    canonicalSubject: string
  ): Promise<void> {
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    await this.resolveCanonicalSubjectForTeacher(teacher.id, groupId, canonicalSubject);
  }

  async listByStudent(
    studentId: string,
    userId: string,
    role: UserRole,
    period?: string,
    subject?: string
  ) {
    const student = await this.studentsRepository.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    await this.assertCanViewStudentGrades(userId, role, student);

    const qb = this.gradesRepository
      .createQueryBuilder('g')
      .where('g.student_id = :studentId', { studentId })
      .orderBy('g.graded_at', 'DESC');

    if (period) qb.andWhere('g.period = :period', { period: this.normText(period) });
    if (subject) qb.andWhere('LOWER(TRIM(g.subject)) = LOWER(TRIM(:subject))', { subject: this.normText(subject) });

    if (role === UserRole.DOCENTE && student.groupId) {
      const names = await this.listSubjectNamesForTeacherInGroup(userId, student.groupId);
      if (names.length === 0) {
        qb.andWhere('1 = 0');
      } else {
        qb.andWhere('LOWER(TRIM(g.subject)) IN (:...subs)', { subs: names.map((n) => n.toLowerCase()) });
      }
    }

    return qb.getMany();
  }

  async listByGroup(groupId: string, userId: string, role: UserRole, period?: string, subject?: string) {
    await this.assertCanViewGroupGrades(userId, role, groupId);

    const qb = this.gradesRepository
      .createQueryBuilder('g')
      .where('g.group_id = :groupId', { groupId })
      .orderBy('g.graded_at', 'DESC');

    if (period) qb.andWhere('g.period = :period', { period: this.normText(period) });
    if (subject) qb.andWhere('LOWER(TRIM(g.subject)) = LOWER(TRIM(:subject))', { subject: this.normText(subject) });

    if (role === UserRole.DOCENTE) {
      const names = await this.listSubjectNamesForTeacherInGroup(userId, groupId);
      if (names.length === 0) {
        qb.andWhere('1 = 0');
      } else {
        qb.andWhere('LOWER(TRIM(g.subject)) IN (:...subs)', { subs: names.map((n) => n.toLowerCase()) });
      }
    }

    return qb.getMany();
  }

  private async listSubjectNamesForTeacherInGroup(userId: string, groupId: string): Promise<string[]> {
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) return [];

    const rows = await this.studentsRepository.manager.query<{ name: string }[]>(
      `SELECT DISTINCT s.name
       FROM teacher_groups tg
       INNER JOIN subjects s ON s.id = tg.subject_id
       WHERE tg.teacher_id = $1 AND tg.group_id = $2 AND tg.subject_id IS NOT NULL`,
      [teacher.id, groupId]
    );
    return rows.map((r) => r.name);
  }

  async listMyChildrenGrades(parentUserId: string, period?: string, subject?: string) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    const qb = this.gradesRepository
      .createQueryBuilder('g')
      .innerJoin('student_parents', 'sp', 'sp.student_id = g.student_id AND sp.parent_id = :pid', {
        pid: parent.id
      })
      .orderBy('g.graded_at', 'DESC');

    if (period) qb.andWhere('g.period = :period', { period: this.normText(period) });
    if (subject) qb.andWhere('LOWER(TRIM(g.subject)) = LOWER(TRIM(:subject))', { subject: this.normText(subject) });

    return qb.getMany();
  }

  async listMyStudentGrades(studentUserId: string, period?: string, subject?: string) {
    const student = await this.studentsRepository.findOne({ where: { userId: studentUserId } });
    if (!student) throw new ForbiddenException('Perfil alumno no encontrado');
    return this.listByStudent(student.id, studentUserId, UserRole.ALUMNO, period, subject);
  }

  private async assertCanGradeStudent(
    userId: string,
    role: UserRole,
    student: StudentEntity,
    _canonicalSubject: string
  ) {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessGroup(userId, student.groupId);
      return;
    }

    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('Solo docente o administracion puede registrar calificaciones');
    }

    if (!student.groupId) {
      throw new BadRequestException('El estudiante no tiene grupo asignado');
    }

    await this.assertTeacherAssignedToGroup(userId, student.groupId);
  }

  private async assertCanViewStudentGrades(userId: string, role: UserRole, student: StudentEntity) {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessGroup(userId, student.groupId);
      return;
    }

    if (role === UserRole.DOCENTE) {
      if (!student.groupId) throw new ForbiddenException('Estudiante sin grupo asignado');
      await this.assertTeacherAssignedToGroup(userId, student.groupId);
      return;
    }

    if (role === UserRole.PADRE) {
      const parent = await this.parentsRepository.findOne({ where: { userId } });
      if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

      const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
        `SELECT EXISTS (
          SELECT 1 FROM student_parents WHERE student_id = $1 AND parent_id = $2
        ) AS ok`,
        [student.id, parent.id]
      );
      if (!rows[0]?.ok) {
        throw new ForbiddenException('No tienes relacion con este estudiante');
      }
      return;
    }

    if (role === UserRole.ALUMNO) {
      if (student.userId !== userId) {
        throw new ForbiddenException('Solo puedes consultar tus propias calificaciones');
      }
      return;
    }

    throw new ForbiddenException('No autorizado');
  }

  private async assertCanViewGroupGrades(userId: string, role: UserRole, groupId: string) {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessGroup(userId, groupId);
      return;
    }

    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado a listar calificaciones por grupo');
    }

    await this.assertTeacherAssignedToGroup(userId, groupId);
  }

  private async assertTeacherAssignedToGroup(userId: string, groupId: string) {
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');

    const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM teacher_groups WHERE teacher_id = $1 AND group_id = $2
      ) AS ok`,
      [teacher.id, groupId]
    );

    if (!rows[0]?.ok) {
      throw new ForbiddenException('No tienes asignacion en este grupo');
    }
  }

  private async assertAdministrativeCanAccessGroup(userId: string, groupId: string | null): Promise<void> {
    if (!groupId) throw new ForbiddenException('No hay grupo para validar alcance institucional');
    const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
         SELECT 1
         FROM users admin_user
         JOIN groups g ON g.id = $2
         WHERE admin_user.id = $1
           AND admin_user.role = 'ADMINISTRATIVO'
           AND admin_user.school_id IS NOT NULL
           AND admin_user.school_id = g.school_id
      ) AS ok`,
      [userId, groupId]
    );
    if (!rows[0]?.ok) {
      throw new ForbiddenException('No tienes permisos sobre este grupo');
    }
  }
}

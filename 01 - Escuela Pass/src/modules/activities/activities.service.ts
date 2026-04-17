import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ActivityEntity, ActivityStatus } from '../../database/entities/activity.entity';
import { ActivityGradeEntity } from '../../database/entities/activity-grade.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserRole } from '../../database/entities/user.entity';
import { CreateActivityDto } from './dto/create-activity.dto';
import { SaveActivityGradesDto } from './dto/save-activity-grade.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

type ActivityListFilters = {
  groupId?: string | null;
  subjectId?: string | null;
  status?: ActivityStatus | null;
  schoolId?: string | null;
};

export type ActivityListRow = {
  id: string;
  teacherId: string;
  groupId: string;
  groupName: string | null;
  grade: string | null;
  schoolYear: string | null;
  subjectId: string;
  subjectName: string;
  title: string;
  period: string;
  maxScore: string;
  dueDate: string | null;
  status: ActivityStatus;
  closedAt: string | null;
  gradedCount: number;
  rosterCount: number;
  createdAt: string;
  updatedAt: string;
  schoolId: string | null;
  schoolName: string | null;
};

export type ActivityBoardRow = {
  studentId: string;
  matricula: string;
  fullName: string;
  grade: {
    id: string;
    score: string;
    notes: string | null;
    gradedAt: string;
  } | null;
};

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(ActivityEntity)
    private readonly activitiesRepository: Repository<ActivityEntity>,
    @InjectRepository(ActivityGradeEntity)
    private readonly activityGradesRepository: Repository<ActivityGradeEntity>,
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

  private normalizeScoreTo2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private assertTwoDecimalScale(n: number, fieldName: string): void {
    const rounded = this.normalizeScoreTo2(n);
    if (Math.abs(n - rounded) > 1e-9) {
      throw new BadRequestException(`${fieldName} debe tener máximo 2 decimales`);
    }
  }

  private async resolveSchoolMaxScoreForGroup(groupId: string): Promise<number> {
    const rows = await this.studentsRepository.manager.query<{ max_score: string }[]>(
      `SELECT COALESCE(s.max_grade_scale::text, '100.00') AS max_score
       FROM groups g
       INNER JOIN schools s ON s.id = g.school_id
       WHERE g.id = $1
       LIMIT 1`,
      [groupId]
    );
    const raw = rows[0]?.max_score;
    if (!raw) throw new NotFoundException('No se encontró la escuela del grupo');
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return 100;
    return this.normalizeScoreTo2(n);
  }

  private async getTeacherIdByUser(userId: string): Promise<string> {
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    return teacher.id;
  }

  private async assertTeacherTeachesSubjectInGroup(
    teacherId: string,
    groupId: string,
    subjectId: string
  ): Promise<{ subjectName: string }> {
    const rows = await this.studentsRepository.manager.query<{ name: string }[]>(
      `SELECT s.name
       FROM teacher_groups tg
       INNER JOIN subjects s ON s.id = tg.subject_id
       WHERE tg.teacher_id = $1 AND tg.group_id = $2 AND tg.subject_id = $3
       LIMIT 1`,
      [teacherId, groupId, subjectId]
    );
    if (!rows.length) {
      throw new ForbiddenException('No imparte esa materia en el grupo indicado');
    }
    return { subjectName: rows[0].name };
  }

  private async resolveSubjectInSchoolOfGroup(
    groupId: string,
    subjectId: string
  ): Promise<{ subjectName: string }> {
    const rows = await this.studentsRepository.manager.query<{ name: string }[]>(
      `SELECT s.name
       FROM subjects s
       INNER JOIN groups g ON g.school_id = s.school_id
       WHERE g.id = $1 AND s.id = $2
       LIMIT 1`,
      [groupId, subjectId]
    );
    if (!rows.length) {
      throw new NotFoundException('Materia no pertenece a la escuela del grupo');
    }
    return { subjectName: rows[0].name };
  }

  private async assertAdministrativeCanAccessGroup(
    userId: string,
    groupId: string
  ): Promise<void> {
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

  private async assertCanAccessGroup(
    userId: string,
    role: UserRole,
    groupId: string
  ): Promise<void> {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessGroup(userId, groupId);
      return;
    }
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado');
    }
    const teacherId = await this.getTeacherIdByUser(userId);
    const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM teacher_groups WHERE teacher_id = $1 AND group_id = $2
      ) AS ok`,
      [teacherId, groupId]
    );
    if (!rows[0]?.ok) {
      throw new ForbiddenException('No tienes asignación en este grupo');
    }
  }

  private async loadActivityOrFail(id: string): Promise<ActivityEntity> {
    const row = await this.activitiesRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Actividad no encontrada');
    return row;
  }

  private async assertCanManageActivity(
    activity: ActivityEntity,
    userId: string,
    role: UserRole
  ): Promise<void> {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessGroup(userId, activity.groupId);
      return;
    }
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado');
    }
    const teacherId = await this.getTeacherIdByUser(userId);
    if (teacherId !== activity.teacherId) {
      throw new ForbiddenException('Solo el docente creador puede gestionar esta actividad');
    }
    await this.assertTeacherTeachesSubjectInGroup(teacherId, activity.groupId, activity.subjectId);
  }

  private async assertCanViewActivity(
    activity: ActivityEntity,
    userId: string,
    role: UserRole
  ): Promise<void> {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessGroup(userId, activity.groupId);
      return;
    }
    if (role === UserRole.DOCENTE) {
      const teacherId = await this.getTeacherIdByUser(userId);
      const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
        `SELECT EXISTS (
          SELECT 1 FROM teacher_groups
          WHERE teacher_id = $1 AND group_id = $2
        ) AS ok`,
        [teacherId, activity.groupId]
      );
      if (!rows[0]?.ok) {
        throw new ForbiddenException('No tienes asignación en este grupo');
      }
      return;
    }
    throw new ForbiddenException('No autorizado');
  }

  async create(dto: CreateActivityDto, userId: string, role: UserRole): Promise<ActivityEntity> {
    if (role !== UserRole.ADMIN && role !== UserRole.ADMINISTRATIVO && role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado a crear actividades');
    }

    const title = this.normText(dto.title);
    if (!title) throw new BadRequestException('El título es obligatorio');
    const period = this.normText(dto.period);
    if (!period) throw new BadRequestException('El período es obligatorio');
    const description = dto.description?.trim() ? this.normText(dto.description) : null;

    const schoolMax = await this.resolveSchoolMaxScoreForGroup(dto.groupId);
    let maxScore = schoolMax;
    if (dto.maxScore !== undefined && dto.maxScore !== null) {
      this.assertTwoDecimalScale(dto.maxScore, 'maxScore');
      if (dto.maxScore < 1) throw new BadRequestException('maxScore debe ser mayor o igual a 1');
      if (dto.maxScore > schoolMax) {
        throw new BadRequestException(
          `maxScore no puede superar la escala de la institución (${schoolMax})`
        );
      }
      maxScore = this.normalizeScoreTo2(dto.maxScore);
    }

    let teacherId: string;
    let subjectName: string;
    if (role === UserRole.DOCENTE) {
      teacherId = await this.getTeacherIdByUser(userId);
      ({ subjectName } = await this.assertTeacherTeachesSubjectInGroup(
        teacherId,
        dto.groupId,
        dto.subjectId
      ));
    } else {
      if (role === UserRole.ADMINISTRATIVO) {
        await this.assertAdministrativeCanAccessGroup(userId, dto.groupId);
      }
      ({ subjectName } = await this.resolveSubjectInSchoolOfGroup(dto.groupId, dto.subjectId));
      const rows = await this.studentsRepository.manager.query<{ teacher_id: string }[]>(
        `SELECT teacher_id FROM teacher_groups
         WHERE group_id = $1 AND subject_id = $2
         LIMIT 1`,
        [dto.groupId, dto.subjectId]
      );
      if (!rows.length) {
        throw new BadRequestException(
          'No hay docente asignado a esta materia en el grupo. Asigne un docente antes de crear la actividad.'
        );
      }
      teacherId = rows[0].teacher_id;
    }

    const entity = this.activitiesRepository.create({
      teacherId,
      groupId: dto.groupId,
      subjectId: dto.subjectId,
      subjectName,
      title,
      description,
      period,
      maxScore: maxScore.toFixed(2),
      dueDate: dto.dueDate ?? null,
      status: ActivityStatus.OPEN
    });

    return this.activitiesRepository.save(entity);
  }

  async update(
    id: string,
    dto: UpdateActivityDto,
    userId: string,
    role: UserRole
  ): Promise<ActivityEntity> {
    const activity = await this.loadActivityOrFail(id);
    await this.assertCanManageActivity(activity, userId, role);
    if (activity.status !== ActivityStatus.OPEN) {
      throw new BadRequestException('No se puede editar una actividad cerrada. Reábrela primero.');
    }

    if (dto.title !== undefined) {
      const t = this.normText(dto.title);
      if (!t) throw new BadRequestException('El título es obligatorio');
      activity.title = t;
    }
    if (dto.description !== undefined) {
      activity.description = dto.description?.trim() ? this.normText(dto.description) : null;
    }
    if (dto.period !== undefined) {
      const p = this.normText(dto.period);
      if (!p) throw new BadRequestException('El período es obligatorio');
      activity.period = p;
    }
    if (dto.maxScore !== undefined) {
      this.assertTwoDecimalScale(dto.maxScore, 'maxScore');
      if (dto.maxScore < 1) throw new BadRequestException('maxScore debe ser mayor o igual a 1');
      const schoolMax = await this.resolveSchoolMaxScoreForGroup(activity.groupId);
      if (dto.maxScore > schoolMax) {
        throw new BadRequestException(
          `maxScore no puede superar la escala de la institución (${schoolMax})`
        );
      }
      const newMax = this.normalizeScoreTo2(dto.maxScore);
      const worst = await this.activityGradesRepository
        .createQueryBuilder('g')
        .select('MAX(g.score)', 'maxScore')
        .where('g.activity_id = :id', { id })
        .getRawOne<{ maxScore: string | null }>();
      const currentTop = Number(worst?.maxScore ?? 0);
      if (Number.isFinite(currentTop) && currentTop > newMax) {
        throw new BadRequestException(
          `No se puede reducir maxScore: existen notas superiores al nuevo máximo (${currentTop}).`
        );
      }
      activity.maxScore = newMax.toFixed(2);
    }
    if (dto.dueDate !== undefined) {
      activity.dueDate = dto.dueDate || null;
    }

    return this.activitiesRepository.save(activity);
  }

  async remove(id: string, userId: string, role: UserRole): Promise<{ ok: true }> {
    const activity = await this.loadActivityOrFail(id);
    await this.assertCanManageActivity(activity, userId, role);
    const count = await this.activityGradesRepository.count({ where: { activityId: id } });
    if (count > 0 && role !== UserRole.ADMIN) {
      throw new BadRequestException(
        'La actividad ya tiene calificaciones registradas. Ciérrala en su lugar.'
      );
    }
    await this.activitiesRepository.delete({ id });
    return { ok: true };
  }

  async close(id: string, userId: string, role: UserRole): Promise<ActivityEntity> {
    const activity = await this.loadActivityOrFail(id);
    await this.assertCanManageActivity(activity, userId, role);
    if (activity.status === ActivityStatus.CLOSED) return activity;
    activity.status = ActivityStatus.CLOSED;
    activity.closedAt = new Date();
    activity.closedBy = userId;
    return this.activitiesRepository.save(activity);
  }

  async reopen(id: string, userId: string, role: UserRole): Promise<ActivityEntity> {
    const activity = await this.loadActivityOrFail(id);
    await this.assertCanManageActivity(activity, userId, role);
    if (activity.status === ActivityStatus.OPEN) return activity;
    activity.status = ActivityStatus.OPEN;
    activity.reopenedAt = new Date();
    activity.reopenedBy = userId;
    return this.activitiesRepository.save(activity);
  }

  async list(
    userId: string,
    role: UserRole,
    filters: ActivityListFilters
  ): Promise<ActivityListRow[]> {
    const params: unknown[] = [];
    const wheres: string[] = ['1=1'];

    if (role === UserRole.DOCENTE) {
      const teacherId = await this.getTeacherIdByUser(userId);
      params.push(teacherId);
      wheres.push(`a.teacher_id = $${params.length}`);
    } else if (role === UserRole.ADMINISTRATIVO) {
      params.push(userId);
      wheres.push(`EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = $${params.length}
          AND u.role = 'ADMINISTRATIVO'
          AND u.school_id IS NOT NULL
          AND u.school_id = g.school_id
      )`);
    } else if (role !== UserRole.ADMIN) {
      throw new ForbiddenException('No autorizado');
    }

    if (filters.groupId) {
      params.push(filters.groupId);
      wheres.push(`a.group_id = $${params.length}`);
    }
    if (filters.subjectId) {
      params.push(filters.subjectId);
      wheres.push(`a.subject_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      wheres.push(`a.status = $${params.length}`);
    }
    if (filters.schoolId && role === UserRole.ADMIN) {
      params.push(filters.schoolId);
      wheres.push(`g.school_id = $${params.length}`);
    }

    const rows = await this.studentsRepository.manager.query<
      {
        id: string;
        teacher_id: string;
        group_id: string;
        group_name: string | null;
        grade: string | null;
        school_year: string | null;
        subject_id: string;
        subject_name: string;
        title: string;
        period: string;
        max_score: string;
        due_date: string | null;
        status: ActivityStatus;
        closed_at: Date | null;
        graded_count: string;
        roster_count: string;
        created_at: Date;
        updated_at: Date;
        school_id: string | null;
        school_name: string | null;
      }[]
    >(
      `SELECT
         a.id,
         a.teacher_id,
         a.group_id,
         g.name AS group_name,
         g.grade,
         g.school_year,
         a.subject_id,
         a.subject_name,
         a.title,
         a.period,
         a.max_score::text AS max_score,
         a.due_date::text AS due_date,
         a.status,
         a.closed_at,
         a.created_at,
         a.updated_at,
         g.school_id,
         sch.name AS school_name,
         (SELECT COUNT(*) FROM activity_grades ag WHERE ag.activity_id = a.id)::text AS graded_count,
         (SELECT COUNT(*) FROM students st WHERE st.group_id = a.group_id)::text AS roster_count
       FROM activities a
       INNER JOIN groups g ON g.id = a.group_id
       LEFT JOIN schools sch ON sch.id = g.school_id
       WHERE ${wheres.join(' AND ')}
       ORDER BY a.created_at DESC`,
      params
    );

    return rows.map((r) => ({
      id: r.id,
      teacherId: r.teacher_id,
      groupId: r.group_id,
      groupName: r.group_name,
      grade: r.grade,
      schoolYear: r.school_year,
      subjectId: r.subject_id,
      subjectName: r.subject_name,
      title: r.title,
      period: r.period,
      maxScore: r.max_score,
      dueDate: r.due_date,
      status: r.status,
      closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null,
      gradedCount: Number(r.graded_count) || 0,
      rosterCount: Number(r.roster_count) || 0,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
      schoolId: r.school_id,
      schoolName: r.school_name
    }));
  }

  async getBoard(id: string, userId: string, role: UserRole) {
    const activity = await this.loadActivityOrFail(id);
    await this.assertCanViewActivity(activity, userId, role);

    const roster = await this.studentsRepository.manager.query<
      { id: string; matricula: string; full_name: string }[]
    >(
      `SELECT s.id, s.matricula, u.full_name
       FROM students s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.group_id = $1
       ORDER BY u.full_name ASC NULLS LAST, s.matricula ASC`,
      [activity.groupId]
    );

    const gradeRows = await this.activityGradesRepository
      .createQueryBuilder('g')
      .where('g.activity_id = :id', { id })
      .getMany();

    const byStudent = new Map<string, ActivityGradeEntity>();
    for (const gr of gradeRows) byStudent.set(gr.studentId, gr);

    const rows: ActivityBoardRow[] = roster.map((r) => {
      const g = byStudent.get(r.id);
      return {
        studentId: r.id,
        matricula: r.matricula,
        fullName: r.full_name,
        grade: g
          ? {
              id: g.id,
              score: g.score,
              notes: g.notes,
              gradedAt: g.gradedAt instanceof Date ? g.gradedAt.toISOString() : String(g.gradedAt)
            }
          : null
      };
    });

    return {
      activity: {
        id: activity.id,
        teacherId: activity.teacherId,
        groupId: activity.groupId,
        subjectId: activity.subjectId,
        subjectName: activity.subjectName,
        title: activity.title,
        description: activity.description,
        period: activity.period,
        maxScore: activity.maxScore,
        dueDate: activity.dueDate,
        status: activity.status,
        closedAt: activity.closedAt ? new Date(activity.closedAt).toISOString() : null,
        reopenedAt: activity.reopenedAt ? new Date(activity.reopenedAt).toISOString() : null
      },
      rows
    };
  }

  async saveGrades(
    id: string,
    dto: SaveActivityGradesDto,
    userId: string,
    role: UserRole
  ): Promise<{ ok: true; count: number }> {
    const activity = await this.loadActivityOrFail(id);
    await this.assertCanManageActivity(activity, userId, role);
    if (activity.status !== ActivityStatus.OPEN) {
      throw new BadRequestException(
        'La actividad está cerrada. Reábrela para modificar las calificaciones.'
      );
    }

    const maxScore = Number(activity.maxScore);
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      throw new BadRequestException('La actividad no tiene un puntaje máximo válido');
    }

    await this.dataSource.transaction(async (mgr) => {
      const gradeRepo = mgr.getRepository(ActivityGradeEntity);
      const studentRepo = mgr.getRepository(StudentEntity);

      for (const entry of dto.entries) {
        this.assertTwoDecimalScale(entry.score, 'score');
        if (entry.score < 0) {
          throw new BadRequestException('La calificación no puede ser negativa');
        }
        if (entry.score > maxScore) {
          throw new BadRequestException(`La calificación no puede superar el máximo (${maxScore})`);
        }

        const student = await studentRepo.findOne({ where: { id: entry.studentId } });
        if (!student) throw new NotFoundException(`Estudiante no encontrado: ${entry.studentId}`);
        if (student.groupId !== activity.groupId) {
          throw new BadRequestException('El estudiante no pertenece al grupo de la actividad');
        }

        const scoreFixed = this.normalizeScoreTo2(entry.score).toFixed(2);
        const existing = await gradeRepo.findOne({
          where: { activityId: id, studentId: entry.studentId }
        });

        if (existing) {
          existing.score = scoreFixed;
          existing.notes = entry.notes?.trim() ? this.normText(entry.notes) : null;
          existing.gradedBy = userId;
          existing.gradedAt = new Date();
          await gradeRepo.save(existing);
        } else {
          const row = gradeRepo.create({
            activityId: id,
            studentId: entry.studentId,
            score: scoreFixed,
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

  async listForParent(parentUserId: string): Promise<ActivityListRow[]> {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    const rows = await this.studentsRepository.manager.query<
      {
        id: string;
        teacher_id: string;
        group_id: string;
        group_name: string | null;
        grade: string | null;
        school_year: string | null;
        subject_id: string;
        subject_name: string;
        title: string;
        period: string;
        max_score: string;
        due_date: string | null;
        status: ActivityStatus;
        closed_at: Date | null;
        created_at: Date;
        updated_at: Date;
        school_id: string | null;
        school_name: string | null;
      }[]
    >(
      `SELECT DISTINCT
         a.id,
         a.teacher_id,
         a.group_id,
         g.name AS group_name,
         g.grade,
         g.school_year,
         a.subject_id,
         a.subject_name,
         a.title,
         a.period,
         a.max_score::text AS max_score,
         a.due_date::text AS due_date,
         a.status,
         a.closed_at,
         a.created_at,
         a.updated_at,
         g.school_id,
         sch.name AS school_name
       FROM activities a
       INNER JOIN groups g ON g.id = a.group_id
       LEFT JOIN schools sch ON sch.id = g.school_id
       INNER JOIN students st ON st.group_id = a.group_id
       INNER JOIN student_parents sp ON sp.student_id = st.id AND sp.parent_id = $1
       WHERE a.status = 'CLOSED'
       ORDER BY a.created_at DESC`,
      [parent.id]
    );

    return rows.map((r) => ({
      id: r.id,
      teacherId: r.teacher_id,
      groupId: r.group_id,
      groupName: r.group_name,
      grade: r.grade,
      schoolYear: r.school_year,
      subjectId: r.subject_id,
      subjectName: r.subject_name,
      title: r.title,
      period: r.period,
      maxScore: r.max_score,
      dueDate: r.due_date,
      status: r.status,
      closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null,
      gradedCount: 0,
      rosterCount: 0,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
      schoolId: r.school_id,
      schoolName: r.school_name
    }));
  }

  async getMyStudentActivityGrade(
    activityId: string,
    requesterUserId: string,
    role: UserRole
  ): Promise<{ activity: ActivityEntity; grade: ActivityGradeEntity | null }> {
    const activity = await this.loadActivityOrFail(activityId);
    if (activity.status !== ActivityStatus.CLOSED && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Esta actividad aún no fue cerrada por el docente');
    }

    let studentId: string | null = null;
    if (role === UserRole.ALUMNO) {
      const st = await this.studentsRepository.findOne({ where: { userId: requesterUserId } });
      if (!st) throw new ForbiddenException('Perfil alumno no encontrado');
      studentId = st.id;
    } else if (role === UserRole.PADRE) {
      throw new BadRequestException('Padre debe indicar studentId para ver la calificación');
    } else {
      throw new ForbiddenException('Rol no soportado en esta vista');
    }

    const grade = await this.activityGradesRepository.findOne({
      where: { activityId, studentId }
    });
    return { activity, grade };
  }
}

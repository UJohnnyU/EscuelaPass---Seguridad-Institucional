import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  AcademicPeriodEntity,
  AcademicPeriodStatus
} from '../../database/entities/academic-period.entity';
import { ActivityEntity, ActivityStatus } from '../../database/entities/activity.entity';
import { ActivityGradeEntity } from '../../database/entities/activity-grade.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity, StudentLifecycleStatus } from '../../database/entities/student.entity';
import { TeacherEntity, TeacherLifecycleStatus } from '../../database/entities/teacher.entity';
import { UserRole } from '../../database/entities/user.entity';
import { AcademicNotificationsService } from '../academic-notifications/academic-notifications.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { SaveActivityGradesDto } from './dto/save-activity-grade.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

type ActivityListFilters = {
  groupId?: string | null;
  subjectId?: string | null;
  status?: ActivityStatus | null;
  schoolId?: string | null;
  periodId?: string | null;
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
  periodId: string | null;
  periodName: string | null;
  maxScore: string;
  dueDate: string | null;
  status: ActivityStatus;
  closedAt: string | null;
  reopenedAt: string | null;
  publishedAt: string | null;
  underReview: boolean;
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

export type TeacherAssignmentRow = {
  groupId: string;
  groupName: string | null;
  grade: string | null;
  schoolYear: string | null;
  subjectId: string;
  subjectName: string;
  schoolId?: string;
  schoolName?: string | null;
  schoolMaxGradeScale?: string | null;
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
    private readonly parentsRepository: Repository<ParentEntity>,
    @InjectRepository(AcademicPeriodEntity)
    private readonly periodsRepository: Repository<AcademicPeriodEntity>,
    private readonly notifications: AcademicNotificationsService
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

  private computeUnderReview(a: ActivityEntity): boolean {
    if (a.publishedAt == null) return false;
    if (a.status !== ActivityStatus.OPEN) return false;
    if (!a.reopenedAt) return false;
    if (!a.closedAt) return true;
    return a.reopenedAt.getTime() > a.closedAt.getTime();
  }

  private async getSchoolInfoForGroup(
    groupId: string
  ): Promise<{ schoolId: string; maxScore: number }> {
    const rows = await this.studentsRepository.manager.query<
      { school_id: string; max_grade_scale: string }[]
    >(
      `SELECT g.school_id, COALESCE(s.max_grade_scale::text, '100.00') AS max_grade_scale
       FROM groups g
       INNER JOIN schools s ON s.id = g.school_id
       WHERE g.id = $1
       LIMIT 1`,
      [groupId]
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('No se encontró la escuela del grupo');
    const n = Number(row.max_grade_scale);
    const maxScore =
      Number.isFinite(n) && n >= 1 ? this.normalizeScoreTo2(n) : 100;
    return { schoolId: row.school_id, maxScore };
  }

  private async assertPeriodUsable(
    periodId: string,
    schoolId: string
  ): Promise<AcademicPeriodEntity> {
    const period = await this.periodsRepository.findOne({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Periodo académico no encontrado');
    if (period.schoolId !== schoolId) {
      throw new ForbiddenException('El periodo no pertenece a la escuela del grupo');
    }
    if (period.status === AcademicPeriodStatus.CLOSED) {
      throw new BadRequestException('El periodo está cerrado. No se pueden crear actividades.');
    }
    return period;
  }

  private async getTeacherIdByUser(userId: string): Promise<string> {
    const t = await this.ensureTeacherProfile(userId);
    return t.id;
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

  private async loadActivityOrFail(id: string): Promise<ActivityEntity> {
    const row = await this.activitiesRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Actividad no encontrada');
    return row;
  }

  private async assertActivityPeriodOpenForMutation(activity: ActivityEntity): Promise<void> {
    if (!activity.periodId) return;
    const period = await this.periodsRepository.findOne({ where: { id: activity.periodId } });
    if (!period) {
      throw new NotFoundException('Periodo académico de la actividad no encontrado');
    }
    if (period.status === AcademicPeriodStatus.CLOSED) {
      throw new BadRequestException(
        'El periodo está cerrado. No se permiten cambios en actividades o calificaciones.'
      );
    }
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
    const description = dto.description?.trim() ? this.normText(dto.description) : null;

    const { schoolId, maxScore: schoolMax } = await this.getSchoolInfoForGroup(dto.groupId);
    const period = await this.assertPeriodUsable(dto.periodId, schoolId);

    const institutionSetsMax =
      role === UserRole.DOCENTE || role === UserRole.ADMINISTRATIVO;

    let maxScore = schoolMax;
    if (!institutionSetsMax && dto.maxScore !== undefined && dto.maxScore !== null) {
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
      periodId: period.id,
      title,
      description,
      period: period.name,
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
    await this.assertActivityPeriodOpenForMutation(activity);
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
    if (dto.periodId !== undefined) {
      const { schoolId } = await this.getSchoolInfoForGroup(activity.groupId);
      const period = await this.assertPeriodUsable(dto.periodId, schoolId);
      activity.periodId = period.id;
      activity.period = period.name;
    }
    if (dto.maxScore !== undefined) {
      if (role === UserRole.DOCENTE || role === UserRole.ADMINISTRATIVO) {
        throw new BadRequestException(
          'La escala máxima la define la institución; no se puede cambiar en la actividad.'
        );
      }
      this.assertTwoDecimalScale(dto.maxScore, 'maxScore');
      if (dto.maxScore < 1) throw new BadRequestException('maxScore debe ser mayor o igual a 1');
      const { maxScore: schoolMax } = await this.getSchoolInfoForGroup(activity.groupId);
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
    await this.assertActivityPeriodOpenForMutation(activity);
    const count = await this.activityGradesRepository.count({ where: { activityId: id } });
    if (count > 0 && role === UserRole.DOCENTE) {
      throw new BadRequestException(
        'La actividad ya tiene calificaciones registradas. Ciérrala en su lugar o solicite apoyo a administración.'
      );
    }
    await this.activitiesRepository.delete({ id });
    return { ok: true };
  }

  /**
   * Cierra la actividad y completa con 0 a los estudiantes del roster que no tengan nota.
   * Marca publishedAt la primera vez para habilitar visibilidad a padres/alumnos.
   */
  async close(id: string, userId: string, role: UserRole): Promise<ActivityEntity> {
    const activity = await this.loadActivityOrFail(id);
    await this.assertCanManageActivity(activity, userId, role);
    await this.assertActivityPeriodOpenForMutation(activity);
    if (activity.status === ActivityStatus.CLOSED) return activity;

    const saved = await this.dataSource.transaction(async (mgr) => {
      await this.fillMissingGradesWithZero(mgr, activity, userId);
      activity.status = ActivityStatus.CLOSED;
      activity.closedAt = new Date();
      activity.closedBy = userId;
      if (!activity.publishedAt) {
        activity.publishedAt = activity.closedAt;
      }
      return mgr.getRepository(ActivityEntity).save(activity);
    });
    try {
      await this.notifications.notifyActivityClosed(saved);
    } catch {
      // no-op: fallo de notificación no revierte el cierre
    }
    return saved;
  }

  async closeManyByPeriod(
    mgr: EntityManager,
    periodId: string,
    systemUserId: string | null
  ): Promise<{ closed: number; closedActivities: ActivityEntity[] }> {
    const activities = await mgr
      .getRepository(ActivityEntity)
      .find({ where: { periodId, status: ActivityStatus.OPEN } });
    const closedActivities: ActivityEntity[] = [];
    for (const a of activities) {
      await this.fillMissingGradesWithZero(mgr, a, systemUserId);
      a.status = ActivityStatus.CLOSED;
      a.closedAt = new Date();
      a.closedBy = systemUserId;
      if (!a.publishedAt) a.publishedAt = a.closedAt;
      await mgr.getRepository(ActivityEntity).save(a);
      closedActivities.push(a);
    }
    return { closed: closedActivities.length, closedActivities };
  }

  /**
   * Cierra actividades OPEN con fecha de entrega (due_date) anterior a `todayYmd` en periodos ACTIVE.
   * Sin usuario en sesión (cron); mismo tratamiento que cierre manual (ceros a faltantes).
   */
  async closeOpenActivitiesPastDueDate(todayYmd: string): Promise<{ closed: number }> {
    return this.dataSource.transaction(async (mgr) => {
      const activities = await mgr
        .getRepository(ActivityEntity)
        .createQueryBuilder('a')
        .innerJoin('academic_periods', 'p', 'p.id = a.period_id')
        .where('a.status = :st', { st: ActivityStatus.OPEN })
        .andWhere('a.due_date IS NOT NULL')
        .andWhere('a.due_date < :today', { today: todayYmd })
        .andWhere('p.status = :pst', { pst: AcademicPeriodStatus.ACTIVE })
        .getMany();

      let closed = 0;
      for (const activity of activities) {
        await this.fillMissingGradesWithZero(mgr, activity, null);
        activity.status = ActivityStatus.CLOSED;
        activity.closedAt = new Date();
        activity.closedBy = null;
        if (!activity.publishedAt) activity.publishedAt = activity.closedAt;
        const saved = await mgr.getRepository(ActivityEntity).save(activity);
        closed += 1;
        try {
          await this.notifications.notifyActivityClosed(saved);
        } catch {
          // no-op
        }
      }
      return { closed };
    });
  }

  private async fillMissingGradesWithZero(
    mgr: EntityManager,
    activity: ActivityEntity,
    userId: string | null
  ): Promise<void> {
    const gradeRepo = mgr.getRepository(ActivityGradeEntity);
    const roster = await mgr.query<{ id: string }[]>(
      `SELECT s.id FROM students s WHERE s.group_id = $1`,
      [activity.groupId]
    );
    const existing = await gradeRepo.find({ where: { activityId: activity.id } });
    const withGrade = new Set(existing.map((g) => g.studentId));
    const missing = roster.filter((r) => !withGrade.has(r.id));
    for (const r of missing) {
      const row = gradeRepo.create({
        activityId: activity.id,
        studentId: r.id,
        score: (0).toFixed(2),
        notes: 'Sin calificar al cierre (asignado 0 automáticamente)',
        gradedBy: userId,
        gradedAt: new Date()
      });
      await gradeRepo.save(row);
    }
  }

  async reopen(id: string, userId: string, role: UserRole): Promise<ActivityEntity> {
    const activity = await this.loadActivityOrFail(id);
    await this.assertCanManageActivity(activity, userId, role);
    await this.assertActivityPeriodOpenForMutation(activity);
    if (activity.status === ActivityStatus.OPEN) return activity;
    activity.status = ActivityStatus.OPEN;
    activity.reopenedAt = new Date();
    activity.reopenedBy = userId;
    return this.activitiesRepository.save(activity);
  }

  private mapListRow = (r: {
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
    period_id: string | null;
    period_name: string | null;
    max_score: string;
    due_date: string | null;
    status: ActivityStatus;
    closed_at: Date | null;
    reopened_at: Date | null;
    published_at: Date | null;
    created_at: Date;
    updated_at: Date;
    school_id: string | null;
    school_name: string | null;
    graded_count?: string | null;
    roster_count?: string | null;
  }): ActivityListRow => {
    const closedAt = r.closed_at ? new Date(r.closed_at) : null;
    const reopenedAt = r.reopened_at ? new Date(r.reopened_at) : null;
    const publishedAt = r.published_at ? new Date(r.published_at) : null;
    const underReview =
      publishedAt != null &&
      r.status === ActivityStatus.OPEN &&
      reopenedAt != null &&
      (!closedAt || reopenedAt.getTime() > closedAt.getTime());
    return {
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
      periodId: r.period_id,
      periodName: r.period_name,
      maxScore: r.max_score,
      dueDate: r.due_date,
      status: r.status,
      closedAt: closedAt ? closedAt.toISOString() : null,
      reopenedAt: reopenedAt ? reopenedAt.toISOString() : null,
      publishedAt: publishedAt ? publishedAt.toISOString() : null,
      underReview,
      gradedCount: Number(r.graded_count ?? 0) || 0,
      rosterCount: Number(r.roster_count ?? 0) || 0,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
      schoolId: r.school_id,
      schoolName: r.school_name
    };
  };

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
    if (filters.periodId) {
      params.push(filters.periodId);
      wheres.push(`a.period_id = $${params.length}`);
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
      Parameters<typeof this.mapListRow>[0][]
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
         a.period_id,
         ap.name AS period_name,
         a.max_score::text AS max_score,
         a.due_date::text AS due_date,
         a.status,
         a.closed_at,
         a.reopened_at,
         a.published_at,
         a.created_at,
         a.updated_at,
         g.school_id,
         sch.name AS school_name,
         (SELECT COUNT(*) FROM activity_grades ag WHERE ag.activity_id = a.id)::text AS graded_count,
         (SELECT COUNT(*) FROM students st WHERE st.group_id = a.group_id)::text AS roster_count
       FROM activities a
       INNER JOIN groups g ON g.id = a.group_id
       LEFT JOIN schools sch ON sch.id = g.school_id
       LEFT JOIN academic_periods ap ON ap.id = a.period_id
       WHERE ${wheres.join(' AND ')}
       ORDER BY a.created_at DESC`,
      params
    );

    return rows.map((r) => this.mapListRow(r));
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
        periodId: activity.periodId,
        title: activity.title,
        description: activity.description,
        period: activity.period,
        maxScore: activity.maxScore,
        dueDate: activity.dueDate,
        status: activity.status,
        closedAt: activity.closedAt ? new Date(activity.closedAt).toISOString() : null,
        reopenedAt: activity.reopenedAt ? new Date(activity.reopenedAt).toISOString() : null,
        publishedAt: activity.publishedAt ? new Date(activity.publishedAt).toISOString() : null,
        underReview: this.computeUnderReview(activity)
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
    await this.assertActivityPeriodOpenForMutation(activity);
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
        if (student.lifecycleStatus !== StudentLifecycleStatus.ACTIVO) {
          throw new BadRequestException('No se puede calificar estudiantes con estado distinto a ACTIVO');
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

  /**
   * Devuelve las actividades publicadas visibles a un estudiante (por su userId)
   * junto con la nota del estudiante en esa actividad. Incluye también las que
   * fueron reabiertas (marcadas como en revisión) mientras ya habían sido publicadas.
   */
  async listForStudentUser(
    userId: string,
    filters: { periodId?: string | null } = {}
  ): Promise<(ActivityListRow & { myScore: string | null; myNotes: string | null })[]> {
    const student = await this.studentsRepository.findOne({ where: { userId } });
    if (!student) throw new ForbiddenException('Perfil alumno no encontrado');
    if (!student.groupId) return [];
    return this.fetchActivitiesForStudent(student.id, student.groupId, filters);
  }

  async listForParent(
    parentUserId: string,
    filters: { periodId?: string | null; studentId?: string | null } = {}
  ): Promise<(ActivityListRow & { myScore: string | null; myNotes: string | null; studentId: string })[]> {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    const children = await this.studentsRepository.manager.query<
      { id: string; group_id: string | null }[]
    >(
      `SELECT st.id, st.group_id
       FROM students st
       INNER JOIN student_parents sp ON sp.student_id = st.id
       WHERE sp.parent_id = $1 ${filters.studentId ? 'AND st.id = $2' : ''}`,
      filters.studentId ? [parent.id, filters.studentId] : [parent.id]
    );

    const out: (ActivityListRow & {
      myScore: string | null;
      myNotes: string | null;
      studentId: string;
    })[] = [];
    for (const child of children) {
      if (!child.group_id) continue;
      const rows = await this.fetchActivitiesForStudent(child.id, child.group_id, {
        periodId: filters.periodId ?? null
      });
      rows.forEach((r) => out.push({ ...r, studentId: child.id }));
    }
    return out;
  }

  async listTeacherAssignments(
    userId: string,
    role: UserRole,
    schoolIdFilter?: string | null
  ): Promise<TeacherAssignmentRow[]> {
    if (role === UserRole.ADMIN) {
      return this.studentsRepository.manager.query<TeacherAssignmentRow[]>(
        `SELECT
           g.id AS "groupId",
           g.name AS "groupName",
           g.grade AS "grade",
           g.school_year AS "schoolYear",
           s.id AS "subjectId",
           s.name AS "subjectName",
           g.school_id AS "schoolId",
           sch.name AS "schoolName",
           sch.max_grade_scale::text AS "schoolMaxGradeScale"
         FROM groups g
         INNER JOIN subjects s ON s.school_id = g.school_id
         LEFT JOIN schools sch ON sch.id = g.school_id
         WHERE g.school_id IS NOT NULL
           AND ($1::uuid IS NULL OR g.school_id = $1::uuid)
         ORDER BY sch.name ASC NULLS LAST, g.name ASC NULLS LAST, s.name ASC`,
        [schoolIdFilter ?? null]
      );
    }

    if (role === UserRole.ADMINISTRATIVO) {
      const schoolId = await this.resolveSchoolIdForAdministrativeUser(userId);
      return this.studentsRepository.manager.query<TeacherAssignmentRow[]>(
        `SELECT
           g.id AS "groupId",
           g.name AS "groupName",
           g.grade AS "grade",
           g.school_year AS "schoolYear",
           s.id AS "subjectId",
           s.name AS "subjectName",
           g.school_id AS "schoolId",
           sch.name AS "schoolName",
           sch.max_grade_scale::text AS "schoolMaxGradeScale"
         FROM groups g
         INNER JOIN subjects s ON s.school_id = g.school_id
         LEFT JOIN schools sch ON sch.id = g.school_id
         WHERE g.school_id IS NOT NULL
           AND g.school_id = $1::uuid
         ORDER BY sch.name ASC NULLS LAST, g.name ASC NULLS LAST, s.name ASC`,
        [schoolId]
      );
    }

    const teacher = await this.ensureTeacherProfile(userId);

    return this.studentsRepository.manager.query<TeacherAssignmentRow[]>(
      `SELECT
         g.id AS "groupId",
         g.name AS "groupName",
         g.grade AS "grade",
         g.school_year AS "schoolYear",
         s.id AS "subjectId",
         s.name AS "subjectName",
         g.school_id AS "schoolId",
         sch.name AS "schoolName",
         sch.max_grade_scale::text AS "schoolMaxGradeScale"
       FROM teacher_groups tg
       INNER JOIN groups g ON g.id = tg.group_id
       INNER JOIN subjects s ON s.id = tg.subject_id
       LEFT JOIN schools sch ON sch.id = g.school_id
       WHERE tg.teacher_id = $1 AND tg.subject_id IS NOT NULL
       ORDER BY sch.name ASC NULLS LAST, g.name ASC NULLS LAST, s.name ASC`,
      [teacher.id]
    );
  }

  /** Escuela del usuario administrativo (misma regla que en list() de actividades). */
  private async resolveSchoolIdForAdministrativeUser(userId: string): Promise<string> {
    const rows = await this.studentsRepository.manager.query<{ school_id: string | null }[]>(
      `SELECT school_id FROM users WHERE id = $1::uuid`,
      [userId]
    );
    const schoolId = rows[0]?.school_id?.trim();
    if (!schoolId) {
      throw new ForbiddenException('Tu usuario administrativo no tiene una escuela asignada');
    }
    return schoolId;
  }

  /**
   * Devuelve el perfil docente del usuario; si por alguna razón aún no existe
   * (por ejemplo, usuarios creados fuera del flujo estándar), crea uno vacío
   * para que el usuario pueda seguir operando sin errores 403.
   */
  private async ensureTeacherProfile(userId: string) {
    const existing = await this.teachersRepository.findOne({ where: { userId } });
    if (existing) {
      if (existing.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
        throw new ForbiddenException('El docente no está activo para operar actividades');
      }
      return existing;
    }
    const compact = userId.replace(/-/g, '');
    for (let i = 0; i < 20; i++) {
      const suffix = i === 0 ? '' : `-${i}`;
      const placeholder = `SE-${(compact + suffix).slice(0, 44)}`.slice(0, 50);
      const clash = await this.teachersRepository.findOne({ where: { employeeNumber: placeholder } });
      if (clash) continue;
      const created = this.teachersRepository.create({
        userId,
        employeeNumber: placeholder,
        lifecycleStatus: TeacherLifecycleStatus.ACTIVO
      });
      try {
        return await this.teachersRepository.save(created);
      } catch {
        /* colisión concurrente: reintentar */
      }
    }
    throw new BadRequestException('No se pudo crear el perfil docente automáticamente. Contacte a secretaría.');
  }

  private async fetchActivitiesForStudent(
    studentId: string,
    groupId: string,
    filters: { periodId?: string | null }
  ): Promise<(ActivityListRow & { myScore: string | null; myNotes: string | null })[]> {
    const params: unknown[] = [groupId, studentId];
    let where = `a.group_id = $1 AND (a.status = 'OPEN' OR a.published_at IS NOT NULL)`;
    if (filters.periodId) {
      params.push(filters.periodId);
      where += ` AND a.period_id = $${params.length}`;
    }
    const rows = await this.studentsRepository.manager.query<
      (Parameters<typeof this.mapListRow>[0] & {
        my_score: string | null;
        my_notes: string | null;
      })[]
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
         a.period_id,
         ap.name AS period_name,
         a.max_score::text AS max_score,
         a.due_date::text AS due_date,
         a.status,
         a.closed_at,
         a.reopened_at,
         a.published_at,
         a.created_at,
         a.updated_at,
         g.school_id,
         sch.name AS school_name,
         ag.score::text AS my_score,
         ag.notes AS my_notes
       FROM activities a
       INNER JOIN groups g ON g.id = a.group_id
       LEFT JOIN schools sch ON sch.id = g.school_id
       LEFT JOIN academic_periods ap ON ap.id = a.period_id
       LEFT JOIN activity_grades ag ON ag.activity_id = a.id AND ag.student_id = $2
       WHERE ${where}
       ORDER BY a.period, a.created_at DESC`,
      params
    );
    return rows.map((r) => ({
      ...this.mapListRow(r),
      myScore: r.my_score,
      myNotes: r.my_notes
    }));
  }
}

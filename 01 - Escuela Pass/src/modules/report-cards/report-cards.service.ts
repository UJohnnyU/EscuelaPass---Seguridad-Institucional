import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  AcademicPeriodEntity,
  AcademicPeriodStatus
} from '../../database/entities/academic-period.entity';
import { ActivityEntity, ActivityStatus } from '../../database/entities/activity.entity';
import {
  PromotionStatus,
  ReportCardEntity,
  ReportCardStatus,
  ReportCardType
} from '../../database/entities/report-card.entity';
import { ReportCardSubjectEntity } from '../../database/entities/report-card-subject.entity';
import { SchoolEntity } from '../../database/entities/school.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';

export type ReportCardSummary = {
  id: string;
  studentId: string;
  studentName: string;
  matricula: string;
  schoolId: string;
  schoolYear: string;
  type: ReportCardType;
  periodId: string | null;
  periodName: string | null;
  groupId: string | null;
  groupName: string | null;
  overallAverage: string;
  failedSubjectsCount: number;
  promotionStatus: PromotionStatus | null;
  status: ReportCardStatus;
  publishedAt: string | null;
  generatedAt: string;
};

export type ReportCardDetail = ReportCardSummary & {
  passingGrade: string;
  maxGradeScale: string;
  minFailedSubjectsToRepeat: number;
  subjects: {
    id: string;
    subjectId: string;
    subjectName: string;
    average: string;
    activityCount: number;
    gradedCount: number;
    isPassing: boolean;
  }[];
};

@Injectable()
export class ReportCardsService {
  private readonly logger = new Logger(ReportCardsService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(ReportCardEntity)
    private readonly reportCardsRepository: Repository<ReportCardEntity>,
    @InjectRepository(ReportCardSubjectEntity)
    private readonly reportCardSubjectsRepository: Repository<ReportCardSubjectEntity>,
    @InjectRepository(AcademicPeriodEntity)
    private readonly periodsRepository: Repository<AcademicPeriodEntity>,
    @InjectRepository(SchoolEntity)
    private readonly schoolsRepository: Repository<SchoolEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>
  ) {}

  /**
   * Genera (o regenera) los boletines por periodo para todos los estudiantes
   * que tengan al menos una actividad en ese periodo. Marca como DRAFT o
   * PUBLISHED según `publish`.
   */
  async generateForPeriod(
    periodId: string,
    publish: boolean,
    mgr?: EntityManager
  ): Promise<{ generated: number; published: number }> {
    const run = async (em: EntityManager) => {
      const period = await em
        .getRepository(AcademicPeriodEntity)
        .findOne({ where: { id: periodId } });
      if (!period) throw new NotFoundException('Periodo no encontrado');
      const school = await em
        .getRepository(SchoolEntity)
        .findOne({ where: { id: period.schoolId } });
      if (!school) throw new NotFoundException('Escuela no encontrada');

      const passingGrade = Number(school.passingGrade) || 0;

      const studentsRaw = await em.query<
        {
          student_id: string;
          group_id: string;
          subject_id: string;
          subject_name: string;
          activity_count: string;
          graded_count: string;
          avg_score: string | null;
        }[]
      >(
        `SELECT
           st.id AS student_id,
           st.group_id,
           a.subject_id,
           a.subject_name,
           COUNT(DISTINCT a.id)::text AS activity_count,
           COUNT(DISTINCT CASE WHEN ag.id IS NOT NULL THEN a.id END)::text AS graded_count,
           CASE
             WHEN SUM(CASE WHEN a.status = 'CLOSED' THEN 1 ELSE 0 END) = 0 THEN NULL
             ELSE AVG(
               CASE
                 WHEN a.status = 'CLOSED'
                   THEN COALESCE(ag.score, 0)
                 ELSE NULL
               END
             )::text
           END AS avg_score
         FROM activities a
         INNER JOIN groups g ON g.id = a.group_id
         INNER JOIN students st ON st.group_id = g.id
         LEFT JOIN activity_grades ag ON ag.activity_id = a.id AND ag.student_id = st.id
         WHERE a.period_id = $1 AND g.school_id = $2
         GROUP BY st.id, st.group_id, a.subject_id, a.subject_name`,
        [periodId, period.schoolId]
      );

      const byStudent = new Map<
        string,
        { groupId: string; subjects: Map<string, { name: string; avg: number | null; activities: number; graded: number }> }
      >();
      for (const row of studentsRaw) {
        const avg = row.avg_score !== null ? Number(row.avg_score) : null;
        const stEntry =
          byStudent.get(row.student_id) ?? {
            groupId: row.group_id,
            subjects: new Map()
          };
        stEntry.subjects.set(row.subject_id, {
          name: row.subject_name,
          avg,
          activities: Number(row.activity_count) || 0,
          graded: Number(row.graded_count) || 0
        });
        byStudent.set(row.student_id, stEntry);
      }

      const rcRepo = em.getRepository(ReportCardEntity);
      const rcsRepo = em.getRepository(ReportCardSubjectEntity);
      const now = new Date();

      let generated = 0;
      let published = 0;

      for (const [studentId, data] of byStudent) {
        let card = await rcRepo.findOne({
          where: {
            studentId,
            schoolId: period.schoolId,
            schoolYear: period.schoolYear,
            type: ReportCardType.PERIOD,
            periodId: period.id
          }
        });
        if (!card) {
          card = rcRepo.create({
            studentId,
            schoolId: period.schoolId,
            schoolYear: period.schoolYear,
            type: ReportCardType.PERIOD,
            periodId: period.id,
            generatedAt: now,
            status: ReportCardStatus.DRAFT
          });
        }

        let sumAvg = 0;
        let countAvg = 0;
        let failedCount = 0;
        const subjectRows: ReportCardSubjectEntity[] = [];
        for (const [subjectId, s] of data.subjects) {
          const avg = s.avg !== null ? Math.round(s.avg * 100) / 100 : 0;
          const isPassing = s.avg !== null && avg >= passingGrade - 1e-9;
          if (!isPassing) failedCount += 1;
          if (s.avg !== null) {
            sumAvg += avg;
            countAvg += 1;
          }
          subjectRows.push(
            rcsRepo.create({
              subjectId,
              subjectName: s.name,
              average: avg.toFixed(2),
              activityCount: s.activities,
              gradedCount: s.graded,
              isPassing
            })
          );
        }

        card.overallAverage = countAvg > 0 ? (sumAvg / countAvg).toFixed(2) : (0).toFixed(2);
        card.failedSubjectsCount = failedCount;
        card.promotionStatus = null;
        card.generatedAt = now;
        if (publish) {
          card.status = ReportCardStatus.PUBLISHED;
          card.publishedAt = now;
        } else if (!card.publishedAt) {
          card.status = ReportCardStatus.DRAFT;
        }
        const savedCard = await rcRepo.save(card);

        await rcsRepo.delete({ reportCardId: savedCard.id });
        for (const sr of subjectRows) {
          sr.reportCardId = savedCard.id;
          await rcsRepo.save(sr);
        }
        generated += 1;
        if (savedCard.status === ReportCardStatus.PUBLISHED) published += 1;
      }

      this.logger.log(
        `Boletines de periodo ${period.name} (${period.schoolYear}) generados=${generated} publicados=${published}`
      );
      return { generated, published };
    };
    return mgr ? run(mgr) : this.dataSource.transaction(run);
  }

  /**
   * Genera el boletín final cuando todos los periodos del año escolar están cerrados.
   * Usa promedio ponderado por `weight` de los periodos y la configuración institucional
   * (passing_grade y min_failed_subjects_to_repeat) para el estado de promoción.
   */
  async generateFinalForSchoolYear(
    schoolId: string,
    schoolYear: string,
    publish: boolean,
    mgr?: EntityManager
  ): Promise<{ generated: number; published: number; skipped: boolean }> {
    const run = async (em: EntityManager) => {
      const periods = await em.getRepository(AcademicPeriodEntity).find({
        where: { schoolId, schoolYear }
      });
      if (periods.length === 0) {
        return { generated: 0, published: 0, skipped: true };
      }
      const allClosed = periods.every((p) => p.status === AcademicPeriodStatus.CLOSED);
      if (!allClosed) {
        return { generated: 0, published: 0, skipped: true };
      }
      const school = await em.getRepository(SchoolEntity).findOne({ where: { id: schoolId } });
      if (!school) throw new NotFoundException('Escuela no encontrada');

      const passingGrade = Number(school.passingGrade) || 0;
      const minFailed = Number(school.minFailedSubjectsToRepeat) || 3;
      const totalWeight = periods.reduce((acc, p) => acc + Number(p.weight), 0) || 0;

      const rcRepo = em.getRepository(ReportCardEntity);
      const rcsRepo = em.getRepository(ReportCardSubjectEntity);

      const periodIds = periods.map((p) => p.id);
      const periodWeights = new Map(periods.map((p) => [p.id, Number(p.weight) || 0]));

      const rows = await em.query<
        {
          student_id: string;
          subject_id: string;
          subject_name: string;
          period_id: string;
          average: string;
          activity_count: string;
          graded_count: string;
        }[]
      >(
        `SELECT rc.student_id, rcs.subject_id, rcs.subject_name, rc.period_id,
                rcs.average::text, rcs.activity_count::text, rcs.graded_count::text
         FROM report_cards rc
         INNER JOIN report_card_subjects rcs ON rcs.report_card_id = rc.id
         WHERE rc.school_id = $1
           AND rc.school_year = $2
           AND rc.type = 'PERIOD'
           AND rc.period_id = ANY($3::uuid[])`,
        [schoolId, schoolYear, periodIds]
      );

      type SubjAgg = {
        name: string;
        weighted: number;
        totalW: number;
        activities: number;
        graded: number;
      };
      const studentMap = new Map<string, Map<string, SubjAgg>>();
      for (const r of rows) {
        const w = periodWeights.get(r.period_id) ?? 0;
        const avg = Number(r.average) || 0;
        let subjMap = studentMap.get(r.student_id);
        if (!subjMap) {
          subjMap = new Map();
          studentMap.set(r.student_id, subjMap);
        }
        const prev = subjMap.get(r.subject_id) ?? {
          name: r.subject_name,
          weighted: 0,
          totalW: 0,
          activities: 0,
          graded: 0
        };
        prev.weighted += avg * w;
        prev.totalW += w;
        prev.activities += Number(r.activity_count) || 0;
        prev.graded += Number(r.graded_count) || 0;
        subjMap.set(r.subject_id, prev);
      }

      const now = new Date();
      let generated = 0;
      let published = 0;

      for (const [studentId, subjMap] of studentMap) {
        let card = await rcRepo.findOne({
          where: {
            studentId,
            schoolId,
            schoolYear,
            type: ReportCardType.FINAL
          }
        });
        if (!card) {
          card = rcRepo.create({
            studentId,
            schoolId,
            schoolYear,
            type: ReportCardType.FINAL,
            periodId: null,
            generatedAt: now,
            status: ReportCardStatus.DRAFT
          });
        }

        let sumSubjectAvgs = 0;
        let failedSubjects = 0;
        const subjectRows: ReportCardSubjectEntity[] = [];
        for (const [subjectId, s] of subjMap) {
          const avg =
            s.totalW > 0 ? Math.round((s.weighted / s.totalW) * 100) / 100 : 0;
          const isPassing = avg >= passingGrade - 1e-9;
          if (!isPassing) failedSubjects += 1;
          sumSubjectAvgs += avg;
          subjectRows.push(
            rcsRepo.create({
              subjectId,
              subjectName: s.name,
              average: avg.toFixed(2),
              activityCount: s.activities,
              gradedCount: s.graded,
              isPassing
            })
          );
        }

        const overall =
          subjectRows.length > 0
            ? Math.round((sumSubjectAvgs / subjectRows.length) * 100) / 100
            : 0;
        const promotion: PromotionStatus =
          failedSubjects === 0
            ? PromotionStatus.APROBADO
            : failedSubjects >= minFailed
              ? PromotionStatus.REPROBADO
              : PromotionStatus.APROBADO_CON_PENDIENTES;

        card.overallAverage = overall.toFixed(2);
        card.failedSubjectsCount = failedSubjects;
        card.promotionStatus = promotion;
        card.generatedAt = now;
        if (publish) {
          card.status = ReportCardStatus.PUBLISHED;
          card.publishedAt = now;
        } else if (!card.publishedAt) {
          card.status = ReportCardStatus.DRAFT;
        }
        const savedCard = await rcRepo.save(card);

        await rcsRepo.delete({ reportCardId: savedCard.id });
        for (const sr of subjectRows) {
          sr.reportCardId = savedCard.id;
          await rcsRepo.save(sr);
        }
        generated += 1;
        if (savedCard.status === ReportCardStatus.PUBLISHED) published += 1;
      }

      this.logger.log(
        `Boletines finales ${schoolYear} generados=${generated} publicados=${published} (totalWeight=${totalWeight})`
      );
      return { generated, published, skipped: false };
    };
    return mgr ? run(mgr) : this.dataSource.transaction(run);
  }

  async publishPeriodCards(periodId: string): Promise<{ published: number }> {
    const now = new Date();
    const res = await this.reportCardsRepository
      .createQueryBuilder()
      .update()
      .set({ status: ReportCardStatus.PUBLISHED, publishedAt: now })
      .where('period_id = :pid AND type = :t AND status = :st', {
        pid: periodId,
        t: ReportCardType.PERIOD,
        st: ReportCardStatus.DRAFT
      })
      .execute();
    return { published: res.affected ?? 0 };
  }

  private async assertAccessibleSchool(user: UserEntity, schoolId: string | null) {
    if (user.role === UserRole.ADMIN) return;
    if (!user.schoolId) throw new ForbiddenException('Tu usuario no tiene escuela asignada');
    if (schoolId && schoolId !== user.schoolId) {
      throw new ForbiddenException('No puedes consultar reportes de otra escuela');
    }
  }

  async listForAdmin(
    userId: string,
    role: UserRole,
    filters: {
      schoolId?: string;
      schoolYear?: string;
      periodId?: string;
      type?: ReportCardType;
      studentId?: string;
    }
  ): Promise<ReportCardSummary[]> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new ForbiddenException('Usuario no encontrado');
    await this.assertAccessibleSchool(user, filters.schoolId ?? null);
    const effectiveSchoolId =
      role === UserRole.ADMIN ? filters.schoolId ?? null : user.schoolId;

    const qb = this.buildBaseListQuery();
    if (effectiveSchoolId) qb.andWhere('rc.school_id = :sid', { sid: effectiveSchoolId });
    if (filters.schoolYear) qb.andWhere('rc.school_year = :sy', { sy: filters.schoolYear });
    if (filters.periodId) qb.andWhere('rc.period_id = :pid', { pid: filters.periodId });
    if (filters.type) qb.andWhere('rc.type = :t', { t: filters.type });
    if (filters.studentId) qb.andWhere('rc.student_id = :st', { st: filters.studentId });
    if (role !== UserRole.ADMIN && role !== UserRole.ADMINISTRATIVO) {
      qb.andWhere('rc.status = :pub', { pub: ReportCardStatus.PUBLISHED });
    }
    qb.orderBy('rc.school_year', 'DESC')
      .addOrderBy('ap.order_index', 'ASC')
      .addOrderBy('rc.type', 'ASC');
    const rows = await qb.getRawMany<any>();
    return rows.map(this.mapListRow);
  }

  async listForStudentUser(userId: string): Promise<ReportCardSummary[]> {
    const res = await this.dataSource.query<{ id: string }[]>(
      `SELECT st.id FROM students st WHERE st.user_id = $1 LIMIT 1`,
      [userId]
    );
    if (!res[0]) throw new ForbiddenException('Perfil alumno no encontrado');
    const studentId = res[0].id;
    const qb = this.buildBaseListQuery()
      .andWhere('rc.student_id = :sid', { sid: studentId })
      .andWhere('rc.status = :pub', { pub: ReportCardStatus.PUBLISHED })
      .orderBy('rc.school_year', 'DESC')
      .addOrderBy('rc.type', 'ASC')
      .addOrderBy('ap.order_index', 'ASC');
    const rows = await qb.getRawMany<any>();
    return rows.map(this.mapListRow);
  }

  async listForParentUser(
    userId: string,
    studentId?: string
  ): Promise<ReportCardSummary[]> {
    const res = await this.dataSource.query<{ id: string }[]>(
      `SELECT p.id FROM parents p WHERE p.user_id = $1 LIMIT 1`,
      [userId]
    );
    if (!res[0]) throw new ForbiddenException('Perfil padre no encontrado');
    const parentId = res[0].id;
    const children = await this.dataSource.query<{ student_id: string }[]>(
      `SELECT sp.student_id FROM student_parents sp WHERE sp.parent_id = $1
        ${studentId ? 'AND sp.student_id = $2' : ''}`,
      studentId ? [parentId, studentId] : [parentId]
    );
    if (children.length === 0) return [];
    const ids = children.map((c) => c.student_id);
    const qb = this.buildBaseListQuery()
      .andWhere('rc.student_id IN (:...ids)', { ids })
      .andWhere('rc.status = :pub', { pub: ReportCardStatus.PUBLISHED })
      .orderBy('rc.school_year', 'DESC')
      .addOrderBy('rc.type', 'ASC')
      .addOrderBy('ap.order_index', 'ASC');
    const rows = await qb.getRawMany<any>();
    return rows.map(this.mapListRow);
  }

  private buildBaseListQuery() {
    return this.reportCardsRepository
      .createQueryBuilder('rc')
      .leftJoin('academic_periods', 'ap', 'ap.id = rc.period_id')
      .leftJoin('students', 'st', 'st.id = rc.student_id')
      .leftJoin('users', 'u', 'u.id = st.user_id')
      .leftJoin('groups', 'g', 'g.id = st.group_id')
      .select([
        'rc.id AS rc_id',
        'rc.student_id AS student_id',
        'u.full_name AS student_name',
        'st.matricula AS matricula',
        'rc.school_id AS school_id',
        'rc.school_year AS school_year',
        'rc.type AS type',
        'rc.period_id AS period_id',
        'ap.name AS period_name',
        'st.group_id AS group_id',
        'g.name AS group_name',
        'rc.overall_average::text AS overall_average',
        'rc.failed_subjects_count AS failed_subjects_count',
        'rc.promotion_status AS promotion_status',
        'rc.status AS status',
        'rc.published_at AS published_at',
        'rc.generated_at AS generated_at'
      ]);
  }

  private mapListRow = (r: any): ReportCardSummary => ({
    id: r.rc_id,
    studentId: r.student_id,
    studentName: r.student_name ?? '',
    matricula: r.matricula ?? '',
    schoolId: r.school_id,
    schoolYear: r.school_year,
    type: r.type,
    periodId: r.period_id,
    periodName: r.period_name,
    groupId: r.group_id ?? null,
    groupName: r.group_name ?? null,
    overallAverage: String(r.overall_average ?? '0.00'),
    failedSubjectsCount: Number(r.failed_subjects_count) || 0,
    promotionStatus: r.promotion_status,
    status: r.status,
    publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
    generatedAt: r.generated_at ? new Date(r.generated_at).toISOString() : new Date().toISOString()
  });

  async getDetail(id: string, requesterUserId: string, role: UserRole): Promise<ReportCardDetail> {
    const card = await this.reportCardsRepository.findOne({ where: { id } });
    if (!card) throw new NotFoundException('Boletín no encontrado');

    if (role === UserRole.ALUMNO) {
      const s = await this.dataSource.query<{ id: string }[]>(
        `SELECT st.id FROM students st WHERE st.user_id = $1 LIMIT 1`,
        [requesterUserId]
      );
      if (!s[0] || s[0].id !== card.studentId || card.status !== ReportCardStatus.PUBLISHED) {
        throw new ForbiddenException('No puedes acceder a este boletín');
      }
    } else if (role === UserRole.PADRE) {
      const p = await this.dataSource.query<{ id: string }[]>(
        `SELECT p.id FROM parents p WHERE p.user_id = $1 LIMIT 1`,
        [requesterUserId]
      );
      if (!p[0]) throw new ForbiddenException('Perfil padre no encontrado');
      const rel = await this.dataSource.query<{ c: string }[]>(
        `SELECT COUNT(*)::text AS c FROM student_parents WHERE parent_id = $1 AND student_id = $2`,
        [p[0].id, card.studentId]
      );
      if (Number(rel[0]?.c ?? 0) === 0 || card.status !== ReportCardStatus.PUBLISHED) {
        throw new ForbiddenException('No puedes acceder a este boletín');
      }
    } else if (role === UserRole.ADMINISTRATIVO) {
      const u = await this.usersRepository.findOne({ where: { id: requesterUserId } });
      if (!u || u.schoolId !== card.schoolId) {
        throw new ForbiddenException('No puedes acceder a este boletín');
      }
    } else if (role !== UserRole.ADMIN && role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado');
    }

    const school = await this.schoolsRepository.findOne({ where: { id: card.schoolId } });
    const period = card.periodId
      ? await this.periodsRepository.findOne({ where: { id: card.periodId } })
      : null;
    const subjects = await this.reportCardSubjectsRepository.find({
      where: { reportCardId: card.id },
      order: { subjectName: 'ASC' }
    });

    const meta = await this.dataSource.query<
      { full_name: string | null; matricula: string | null; group_id: string | null; group_name: string | null }[]
    >(
      `SELECT u.full_name, st.matricula, st.group_id, g.name AS group_name
       FROM students st
       LEFT JOIN users u ON u.id = st.user_id
       LEFT JOIN groups g ON g.id = st.group_id
       WHERE st.id = $1 LIMIT 1`,
      [card.studentId]
    );

    return {
      id: card.id,
      studentId: card.studentId,
      studentName: meta[0]?.full_name ?? '',
      matricula: meta[0]?.matricula ?? '',
      schoolId: card.schoolId,
      schoolYear: card.schoolYear,
      type: card.type,
      periodId: card.periodId,
      periodName: period?.name ?? null,
      groupId: meta[0]?.group_id ?? null,
      groupName: meta[0]?.group_name ?? null,
      overallAverage: card.overallAverage,
      failedSubjectsCount: card.failedSubjectsCount,
      promotionStatus: card.promotionStatus,
      status: card.status,
      publishedAt: card.publishedAt ? card.publishedAt.toISOString() : null,
      generatedAt: card.generatedAt.toISOString(),
      passingGrade: school?.passingGrade ?? '0.00',
      maxGradeScale: school?.maxGradeScale ?? '100.00',
      minFailedSubjectsToRepeat: school?.minFailedSubjectsToRepeat ?? 3,
      subjects: subjects.map((s) => ({
        id: s.id,
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        average: s.average,
        activityCount: s.activityCount,
        gradedCount: s.gradedCount,
        isPassing: s.isPassing
      }))
    };
  }

  async regenerateForPeriodByAdmin(
    periodId: string,
    userId: string,
    role: UserRole,
    publish: boolean
  ) {
    const period = await this.periodsRepository.findOne({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Periodo no encontrado');
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new ForbiddenException('Usuario no encontrado');
    await this.assertAccessibleSchool(user, period.schoolId);
    if (role !== UserRole.ADMIN && role !== UserRole.ADMINISTRATIVO) {
      throw new ForbiddenException('Solo admin o administrativo pueden regenerar boletines');
    }
    if (period.status !== AcademicPeriodStatus.CLOSED) {
      throw new BadRequestException(
        'El periodo debe estar CERRADO antes de generar boletines oficiales'
      );
    }
    const openActivities = await this.dataSource
      .getRepository(ActivityEntity)
      .count({ where: { periodId, status: ActivityStatus.OPEN } });
    if (openActivities > 0) {
      throw new BadRequestException(
        `Hay ${openActivities} actividades abiertas en el periodo. Ciérralas antes de generar boletines.`
      );
    }
    return this.generateForPeriod(periodId, publish);
  }

  async regenerateFinalByAdmin(
    schoolId: string,
    schoolYear: string,
    userId: string,
    role: UserRole,
    publish: boolean
  ) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new ForbiddenException('Usuario no encontrado');
    await this.assertAccessibleSchool(user, schoolId);
    if (role !== UserRole.ADMIN && role !== UserRole.ADMINISTRATIVO) {
      throw new ForbiddenException('Solo admin o administrativo pueden regenerar boletines');
    }
    return this.generateFinalForSchoolYear(schoolId, schoolYear, publish);
  }
}

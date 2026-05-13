import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CircuitRequestEntity,
  CircuitStatus,
  PickupMethod,
  TeacherCircuitSignal
} from '../../database/entities/circuit-request.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { ClassSessionEntity } from '../../database/entities/class-session.entity';
import { StudentEntity, StudentLifecycleStatus } from '../../database/entities/student.entity';
import { TeacherEntity, TeacherLifecycleStatus } from '../../database/entities/teacher.entity';
import { TeacherGroupEntity } from '../../database/entities/teacher-group.entity';
import { VehicleEntity } from '../../database/entities/vehicle.entity';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import {
  AttendanceRecordEntity,
  AttendanceStatus
} from '../../database/entities/attendance-record.entity';
import { CreateBatchCircuitRequestDto } from './dto/create-batch-circuit-request.dto';
import { CreateCircuitRequestDto } from './dto/create-circuit-request.dto';
import { UpdateCircuitGpsDto } from './dto/update-circuit-gps.dto';
import { UpdateParentCircuitProgressDto } from './dto/update-parent-circuit-progress.dto';
import { UpdateCircuitStatusDto } from './dto/update-circuit-status.dto';
import { UpdateTeacherCircuitSignalDto } from './dto/update-teacher-circuit-signal.dto';
import { AuditService } from '../audit/audit.service';
import { FcmService } from '../fcm/fcm.service';
import { DepartureConsentService } from '../departure-consent/departure-consent.service';
import { DEFAULT_CIRCUIT_TIMEZONE, getCircuitTimezone, todayYmdInCircuitTimezone } from './circuit-calendar';

/** TypeORM + PostgreSQL: `UPDATE`/`DELETE` con `repository.query` devuelve `[rows, rowCount]`, no `rows` solo. */
function pgMutationReturningRows<R>(raw: unknown): R[] {
  if (Array.isArray(raw) && raw.length === 2 && typeof raw[1] === 'number' && Array.isArray(raw[0])) {
    return raw[0] as R[];
  }
  return raw as R[];
}

type DistanceResult = {
  distanceKm: number;
  durationSeconds: number | null;
  source: 'mapbox' | 'haversine';
};

type SchoolGeo = {
  latitude: number;
  longitude: number;
  radiusKm: number;
};

type SchoolNow = {
  date: string;
  weekday: number;
  hour: number;
  minute: number;
};

/** Respuesta estable para GET /circuit-requests/today (camelCase; evita filas SQL crudas en fallback). */
export type CircuitTodayListItem = {
  id: string;
  studentId: string;
  status: CircuitStatus;
  pickupMethod: PickupMethod;
  requestTime: string | null;
  studentFullName: string | null;
  studentMatricula: string | null;
};

@Injectable()
export class CircuitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CircuitService.name);
  /** Cuando no hay `full_name` en el usuario del estudiante; no usar «de ${label}» en frases (usar «del estudiante»). */
  private static readonly ANONYMOUS_STUDENT_LABEL = 'el estudiante';
  private static readonly OPEN_OPERATIONAL_STATUSES: CircuitStatus[] = [
    CircuitStatus.PENDIENTE,
    CircuitStatus.PADRE_EN_CAMINO,
    CircuitStatus.NOTIFICADO_LLEGADA,
    CircuitStatus.AUTORIZADO_SALIR,
    CircuitStatus.EN_CAMINO
  ];
  private parentConfirmPoll: ReturnType<typeof setInterval> | null = null;
  private schoolTimezoneColumnKnown = false;
  private schoolTimezoneColumnExists = false;

  constructor(
    @InjectRepository(CircuitRequestEntity)
    private readonly circuitRepository: Repository<CircuitRequestEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>,
    @InjectRepository(VehicleEntity)
    private readonly vehiclesRepository: Repository<VehicleEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(TeacherGroupEntity)
    private readonly teacherGroupsRepository: Repository<TeacherGroupEntity>,
    @InjectRepository(ClassSessionEntity)
    private readonly classSessionsRepository: Repository<ClassSessionEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(AttendanceRecordEntity)
    private readonly attendanceRecordsRepository: Repository<AttendanceRecordEntity>,
    private readonly fcmService: FcmService,
    private readonly departureConsentService: DepartureConsentService,
    private readonly auditService: AuditService
  ) {}

  onModuleInit(): void {
    const pollMs = Number(process.env.CIRCUIT_PARENT_CONFIRM_POLL_MS ?? 60_000);
    this.parentConfirmPoll = setInterval(() => {
      void this.applyParentConfirmTimeouts().catch((err: unknown) => {
        this.logger.error(`Circuito: cierre por plazo de padre falló: ${String(err)}`);
      });
    }, pollMs);
  }

  onModuleDestroy(): void {
    if (this.parentConfirmPoll) {
      clearInterval(this.parentConfirmPoll);
      this.parentConfirmPoll = null;
    }
  }

  private parentConfirmWindowMinutes(): number {
    const n = Number(process.env.CIRCUIT_PARENT_CONFIRM_MINUTES ?? 15);
    if (!Number.isFinite(n) || n <= 0) return 15;
    /** Mínimo 15 minutos: ventana de confirmación de recibimiento tras «alumno en camino a salida». */
    return Math.min(Math.max(n, 15), 120);
  }

  private clearParentConfirmCountdown(req: CircuitRequestEntity): void {
    req.parentConfirmDeadlineAt = null;
    req.parentConfirmDeadlineStartedAt = null;
  }

  /**
   * Inicia el plazo para que el padre confirme el recibimiento solo cuando el estado operativo es EN_CAMINO
   * y el docente marcó ALUMNO_CAMINO_A_SALIDA. No reinicia un plazo ya iniciado.
   */
  private maybeStartParentConfirmCountdown(req: CircuitRequestEntity): void {
    if (req.status !== CircuitStatus.EN_CAMINO) return;
    if (req.teacherSignal !== TeacherCircuitSignal.ALUMNO_CAMINO_A_SALIDA) return;

    if (req.parentConfirmDeadlineAt != null && req.parentConfirmDeadlineStartedAt == null) {
      const mins = this.parentConfirmWindowMinutes();
      req.parentConfirmDeadlineStartedAt = new Date(
        req.parentConfirmDeadlineAt.getTime() - mins * 60_000
      );
      return;
    }
    if (req.parentConfirmDeadlineAt != null) return;

    const mins = this.parentConfirmWindowMinutes();
    const started = new Date();
    req.parentConfirmDeadlineStartedAt = started;
    req.parentConfirmDeadlineAt = new Date(started.getTime() + mins * 60_000);
  }

  /** Salida rápida si el entorno no captura ingreso/asistencia (todos los métodos de recogida, incl. solo consentimiento). */
  private skipIngressAttendanceCheck(): boolean {
    return String(process.env.CIRCUIT_SKIP_INGRESS_ATTENDANCE_CHECK ?? '')
      .trim()
      .toLowerCase() === 'true';
  }

  /**
   * Recogidas con trayecto físico del padre deben tener al menor registrado como presente o tardanza
   * en el día operativo (`APP_TIMEZONE`), alineado con `attendance_records.attendance_date`.
   */
  private async assertStudentPresentForPickupToday(studentId: string): Promise<void> {
    const today = await this.schoolTodayYmdForStudent(studentId);
    const row = await this.attendanceRecordsRepository
      .createQueryBuilder('ar')
      .where('ar.studentId = :studentId', { studentId })
      .andWhere('ar.attendanceDate = :d', { d: today })
      .andWhere('ar.status IN (:...present)', {
        present: [AttendanceStatus.PRESENTE, AttendanceStatus.RETARDO]
      })
      .getOne();
    if (!row) {
      throw new BadRequestException(
        'No puede iniciar el circuito: el alumno no consta como presente en el ingreso de hoy. Solicite que secretaría registre la asistencia o espere a que se documente.'
      );
    }
  }

  private getSchoolNow(schoolTimezone?: string | null, asOf: Date = new Date()): SchoolNow {
    const tz = schoolTimezone?.trim() || DEFAULT_CIRCUIT_TIMEZONE;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(asOf);
    const weekdayText = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6
    };
    const rawHour = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const hour = Number(rawHour === '24' ? '0' : rawHour);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    return {
      date: year && month && day ? `${year}-${month}-${day}` : asOf.toISOString().slice(0, 10),
      weekday: weekdayMap[weekdayText] ?? 0,
      hour,
      minute
    };
  }

  private zonedWeekdayAndTime(
    asOf: Date = new Date(),
    schoolTimezone?: string | null
  ): { weekday: number; hhmmss: string } {
    const now = this.getSchoolNow(schoolTimezone, asOf);
    return {
      weekday: now.weekday,
      hhmmss: `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}:00`
    };
  }

  private async hasSchoolTimezoneColumn(): Promise<boolean> {
    if (this.schoolTimezoneColumnKnown) return this.schoolTimezoneColumnExists;
    const rows = await this.studentsRepository.manager.query<{ exists: boolean }[]>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'schools'
           AND column_name = 'timezone'
       ) AS exists`
    );
    this.schoolTimezoneColumnExists = Boolean(rows[0]?.exists);
    this.schoolTimezoneColumnKnown = true;
    return this.schoolTimezoneColumnExists;
  }

  private async schoolTimezoneBySchoolId(schoolId: string | null | undefined): Promise<string> {
    if (!schoolId) return DEFAULT_CIRCUIT_TIMEZONE;
    if (!(await this.hasSchoolTimezoneColumn())) {
      // TODO Fase 7: agregar columna schools.timezone para configuración institucional explícita.
      return DEFAULT_CIRCUIT_TIMEZONE;
    }
    const rows = await this.studentsRepository.manager.query<{ timezone: string | null }[]>(
      `SELECT timezone FROM schools WHERE id = $1 LIMIT 1`,
      [schoolId]
    );
    return rows[0]?.timezone?.trim() || DEFAULT_CIRCUIT_TIMEZONE;
  }

  private async schoolTodayYmdForStudent(studentId: string): Promise<string> {
    const student = await this.studentsRepository.findOne({ where: { id: studentId } });
    const timezone = await this.schoolTimezoneBySchoolId(student?.schoolId);
    return this.getSchoolNow(timezone).date;
  }

  private async assertCircuitEnabledForStudent(studentId: string): Promise<void> {
    const row = await this.studentsRepository
      .createQueryBuilder('st')
      .leftJoin('schools', 's', 's.id = st.school_id')
      .select('st.school_id', 'schoolId')
      .addSelect('COALESCE(s.circuit_enabled, true)', 'enabled')
      .where('st.id = :studentId', { studentId })
      .getRawOne<{ schoolId: string | null; enabled: boolean }>();
    if (!row) throw new NotFoundException('Estudiante no encontrado');
    if (row.enabled === false) {
      throw new ForbiddenException('El módulo de Circuito del día está deshabilitado para esta escuela.');
    }
  }

  private async assertNoOpenCircuitRequestForStudentToday(studentId: string, schoolTimezone: string): Promise<void> {
    const rows = await this.circuitRepository.manager.query<{ id: string }[]>(
      `SELECT id
       FROM circuit_requests
       WHERE student_id = $1
         AND status = ANY($2::circuit_status[])
         AND (timezone($3::text, request_time))::date = (timezone($3::text, now()))::date
       ORDER BY request_time DESC
       LIMIT 1`,
      [studentId, CircuitService.OPEN_OPERATIONAL_STATUSES, schoolTimezone]
    );
    if (rows[0]?.id) {
      throw new BadRequestException('Ya existe una solicitud de salida abierta para este alumno hoy.');
    }
  }

  private async findCurrentClassSession(
    studentId: string,
    asOf: Date = new Date()
  ): Promise<ClassSessionEntity | null> {
    const student = await this.studentsRepository.findOne({ where: { id: studentId } });
    if (!student?.groupId) return null;
    const current = this.zonedWeekdayAndTime(asOf, await this.schoolTimezoneBySchoolId(student.schoolId));
    return this.classSessionsRepository
      .createQueryBuilder('cs')
      .where('cs.groupId = :groupId', { groupId: student.groupId })
      .andWhere('cs.weekday = :weekday', { weekday: current.weekday })
      .andWhere('cs.isActive = true')
      .andWhere('cs.startTime <= :nowTime AND cs.endTime > :nowTime', { nowTime: current.hhmmss })
      .orderBy('cs.startTime', 'DESC')
      .getOne();
  }

  private async currentTeacherUserIdsForStudent(studentId: string): Promise<string[]> {
    const current = await this.findCurrentClassSession(studentId);
    if (!current) return [];
    const teacher = await this.teachersRepository.findOne({ where: { id: current.teacherId } });
    return teacher?.userId ? [teacher.userId] : [];
  }

  private async adminUserIdsForStudentSchool(student: StudentEntity): Promise<string[]> {
    if (!student.schoolId) return [];
    const admins = await this.usersRepository.find({
      where: [
        { schoolId: student.schoolId, role: UserRole.ADMINISTRATIVO, status: true },
        { schoolId: student.schoolId, role: UserRole.ADMIN, status: true }
      ],
      select: ['id']
    });
    return admins.map((u) => u.id);
  }

  private async circuitStaffRecipientsForStudent(student: StudentEntity): Promise<string[]> {
    const [teacherUserIds, adminUserIds] = await Promise.all([
      this.currentTeacherUserIdsForStudent(student.id),
      this.adminUserIdsForStudentSchool(student)
    ]);
    return [...new Set([...teacherUserIds, ...adminUserIds])];
  }

  private async teacherForUser(userId: string): Promise<TeacherEntity> {
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    if (teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
      throw new ForbiddenException('El docente no está activo para operar en circuito');
    }
    return teacher;
  }

  private async assertTeacherCanHandleCircuitRequest(req: CircuitRequestEntity, userId: string): Promise<void> {
    const teacher = await this.teacherForUser(userId);
    const current = await this.findCurrentClassSession(req.studentId);
    if (current?.teacherId === teacher.id) return;

    const student = await this.studentsRepository.findOne({ where: { id: req.studentId } });
    if (req.teacherSignal && student?.groupId) {
      const tg = await this.teacherGroupsRepository.findOne({
        where: { teacherId: teacher.id, groupId: student.groupId }
      });
      if (tg) return;
    }
    throw new ForbiddenException('Solo el docente que tiene al alumno en clase ahora puede operar este circuito');
  }

  private async canTeacherHandleCircuitRequest(req: CircuitRequestEntity, userId: string): Promise<boolean> {
    try {
      await this.assertTeacherCanHandleCircuitRequest(req, userId);
      return true;
    } catch {
      return false;
    }
  }

  private async findTeacherAllowedTodayRequestIds(
    userId: string,
    searchQ: string | null | undefined,
    maxRows: number
  ): Promise<string[]> {
    const teacher = await this.teacherForUser(userId);
    const tz = getCircuitTimezone();
    const current = this.zonedWeekdayAndTime();
    const params: Array<string | number> = [tz, teacher.id, current.weekday, current.hhmmss, maxRows];
    let idx = params.length;
    let searchClause = '';
    const q = searchQ?.trim();
    if (q) {
      idx += 1;
      params.push(`%${q}%`);
      searchClause = ` AND (su.full_name ILIKE $${idx} OR st.matricula ILIKE $${idx} OR pu.full_name ILIKE $${idx})`;
    }

    const rows = await this.circuitRepository.manager.query<{ id: string }[]>(
      `SELECT cr.id
       FROM circuit_requests cr
       INNER JOIN students st ON st.id = cr.student_id
       INNER JOIN users su ON su.id = st.user_id
       INNER JOIN parents p ON p.id = cr.requested_by_parent_id
       INNER JOIN users pu ON pu.id = p.user_id
       WHERE (timezone($1::text, cr.request_time))::date = (timezone($1::text, now()))::date
         ${searchClause}
         AND (
           (
             st.group_id IS NOT NULL
             AND EXISTS (
               SELECT 1
               FROM class_sessions cs
               WHERE cs.group_id = st.group_id
                 AND cs.teacher_id = $2
                 AND cs.is_active = true
                 AND cs.weekday = $3
                 AND cs.start_time <= $4::time
                 AND cs.end_time > $4::time
             )
           )
           OR
           (
             cr.teacher_signal IS NOT NULL
             AND st.group_id IS NOT NULL
             AND EXISTS (
               SELECT 1
               FROM teacher_groups tg
               WHERE tg.teacher_id = $2
                 AND tg.group_id = st.group_id
             )
           )
         )
       ORDER BY cr.request_time DESC
       LIMIT $5`,
      params
    );
    return rows.map((r) => r.id).filter(Boolean);
  }

  private async filterTeacherAllowedRequestIds(userId: string, requestIds: string[]): Promise<Set<string>> {
    const uniqueIds = [...new Set(requestIds.filter(Boolean))];
    if (uniqueIds.length === 0) return new Set();
    const teacher = await this.teacherForUser(userId);
    const current = this.zonedWeekdayAndTime();
    const rows = await this.circuitRepository.manager.query<{ id: string }[]>(
      `SELECT cr.id
       FROM circuit_requests cr
       INNER JOIN students st ON st.id = cr.student_id
       WHERE cr.id = ANY($1::uuid[])
         AND (
           (
             st.group_id IS NOT NULL
             AND EXISTS (
               SELECT 1
               FROM class_sessions cs
               WHERE cs.group_id = st.group_id
                 AND cs.teacher_id = $2
                 AND cs.is_active = true
                 AND cs.weekday = $3
                 AND cs.start_time <= $4::time
                 AND cs.end_time > $4::time
             )
           )
           OR
           (
             cr.teacher_signal IS NOT NULL
             AND st.group_id IS NOT NULL
             AND EXISTS (
               SELECT 1
               FROM teacher_groups tg
               WHERE tg.teacher_id = $2
                 AND tg.group_id = st.group_id
             )
           )
         )`,
      [uniqueIds, teacher.id, current.weekday, current.hhmmss]
    );
    return new Set(rows.map((r) => r.id));
  }

  private isTerminalCircuitStatus(status: CircuitStatus): boolean {
    return (
      status === CircuitStatus.ENTREGADO ||
      status === CircuitStatus.CANCELADO ||
      status === CircuitStatus.CERRADO_SIN_CONFIRMACION_PADRE
    );
  }

  /**
   * Cierra EN_CAMINO con plazo vencido: el padre no confirmó recibimiento dentro de la ventana tras
   * «alumno en camino a salida». No exige `parent_confirm_deadline_started_at` (compat. con filas
   * anteriores a la columna o sin backfill). Solo solicitudes del **mismo criterio de “hoy”** que
   * `findAllActiveForParentUser` (misma fecha calendario en `APP_TIMEZONE`, p. ej. México).
   */
  async applyParentConfirmTimeouts(): Promise<void> {
    const now = new Date();
    const tz = getCircuitTimezone();
    const rawResult = await this.circuitRepository.query<
      | Array<{ id: string; student_id: string; requested_by_parent_id: string }>
      | [
          Array<{ id: string; student_id: string; requested_by_parent_id: string }>,
          number
        ]
    >(
      `UPDATE circuit_requests
       SET status = $1::circuit_status,
           teacher_signal = NULL,
           parent_confirm_deadline_at = NULL,
           parent_confirm_deadline_started_at = NULL
       WHERE status = $2::circuit_status
         AND parent_confirm_deadline_at IS NOT NULL
         AND parent_confirm_deadline_at <= $3
         AND teacher_signal = $4
         AND date(timezone($5::text, request_time)) = date(timezone($5::text, now()))
       RETURNING id, student_id, requested_by_parent_id`,
      [
        CircuitStatus.CERRADO_SIN_CONFIRMACION_PADRE,
        CircuitStatus.EN_CAMINO,
        now,
        TeacherCircuitSignal.ALUMNO_CAMINO_A_SALIDA,
        tz
      ]
    );

    const rows = pgMutationReturningRows<{ id: string; student_id: string; requested_by_parent_id: string }>(rawResult);

    if (rows.length > 0) {
      if (rows.length > 5) {
        this.logger.warn(
          `Circuito: cierre automático inusualmente alto — ${rows.length} solicitud(es) en un solo ciclo. Revisar datos históricos.`
        );
      }
      this.logger.log(
        `Circuito: cierre automático por plazo de confirmación del padre: ${rows.length} solicitud(es).`
      );
    }

    const windowMin = this.parentConfirmWindowMinutes();

    for (const row of rows) {
      const parentUid = await this.parentUserIdByPk(row.requested_by_parent_id);
      const name = await this.studentDisplayName(row.student_id);
      const body =
        name === CircuitService.ANONYMOUS_STUDENT_LABEL
          ? `Pasaron ${windowMin} minutos sin confirmar el recibimiento del menor. El circuito del estudiante se cerró sin confirmación final del padre en el tiempo indicado.`
          : `Pasaron ${windowMin} minutos sin confirmar el recibimiento del menor. El circuito de ${name} se cerró sin confirmación final del padre en el tiempo indicado.`;
      this.logger.log(
        `Circuito: envío FCM cierre por plazo (una vez por solicitud) requestId=${row.id} studentId=${row.student_id}`
      );
      this.pushCircuitToParent(
        parentUid,
        row.id,
        CircuitStatus.CERRADO_SIN_CONFIRMACION_PADRE,
        'Plazo de confirmación vencido',
        body
      );
    }
  }

  /**
   * Solicitud del padre aún no cerrada **del día actual** (misma regla que informes por fecha).
   * Evita redirigir al detalle por circuitos viejos en PENDIENTE u otros estados abiertos.
   */
  async findActiveForParentUser(parentUserId: string): Promise<{
    id: string;
    status: CircuitStatus;
    requestTime: Date;
  } | null> {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) return null;
    const tz = getCircuitTimezone();
    const terminal = [
      CircuitStatus.ENTREGADO,
      CircuitStatus.CANCELADO,
      CircuitStatus.CERRADO_SIN_CONFIRMACION_PADRE
    ];
    const row = await this.circuitRepository
      .createQueryBuilder('cr')
      .where('cr.requestedByParentId = :pid', { pid: parent.id })
      .andWhere('(timezone(:tz, cr.request_time))::date = (timezone(:tz, now()))::date', { tz })
      .andWhere('cr.status NOT IN (:...terminal)', { terminal })
      .orderBy('cr.requestTime', 'DESC')
      .getOne();
    if (!row) return null;
    return { id: row.id, status: row.status, requestTime: row.requestTime };
  }

  /** Devuelve TODAS las solicitudes no terminadas del día para el padre (multi-hijo). */
  async findAllActiveForParentUser(
    parentUserId: string
  ): Promise<Array<{ id: string; status: CircuitStatus; requestTime: Date; studentId: string }>> {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) return [];
    const tz = getCircuitTimezone();
    const terminal = [
      CircuitStatus.ENTREGADO,
      CircuitStatus.CANCELADO,
      CircuitStatus.CERRADO_SIN_CONFIRMACION_PADRE
    ];
    const rows = await this.circuitRepository
      .createQueryBuilder('cr')
      .where('cr.requestedByParentId = :pid', { pid: parent.id })
      .andWhere('(timezone(:tz, cr.request_time))::date = (timezone(:tz, now()))::date', { tz })
      .andWhere('cr.status NOT IN (:...terminal)', { terminal })
      .orderBy('cr.requestTime', 'ASC')
      .getMany();
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      requestTime: r.requestTime,
      studentId: r.studentId
    }));
  }

  /** Crea solicitudes de circuito para múltiples hijos en paralelo. */
  async createBatch(
    payload: CreateBatchCircuitRequestDto
  ): Promise<{ created: Array<{ requestId: string; studentId: string; status: CircuitStatus }>; errors: Array<{ studentId: string; reason: string }> }> {
    const created: Array<{ requestId: string; studentId: string; status: CircuitStatus }> = [];
    const errors: Array<{ studentId: string; reason: string }> = [];

    for (const studentId of payload.studentIds) {
      try {
        const result = await this.create({
          studentId,
          requestedByParentId: payload.requestedByParentId,
          pickupMethod: payload.pickupMethod,
          vehicleId: payload.vehicleId,
          pickupVehicleDescription: payload.pickupVehicleDescription,
          pickupNotes: payload.pickupNotes,
          parentGpsLatitude: payload.parentGpsLatitude,
          parentGpsLongitude: payload.parentGpsLongitude
        });
        created.push({ requestId: result.requestId, studentId, status: result.status });
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        errors.push({ studentId, reason });
      }
    }

    return { created, errors };
  }

  async create(payload: CreateCircuitRequestDto) {
    const student = await this.studentsRepository.findOne({ where: { id: payload.studentId } });
    if (!student) throw new NotFoundException('Estudiante no existe');
    if (student.lifecycleStatus !== StudentLifecycleStatus.ACTIVO) {
      throw new BadRequestException('Solo estudiantes ACTIVO pueden usar el circuito de recogida');
    }
    await this.assertCircuitEnabledForStudent(student.id);
    const schoolTimezone = await this.schoolTimezoneBySchoolId(student.schoolId);
    await this.assertNoOpenCircuitRequestForStudentToday(student.id, schoolTimezone);
    const today = this.getSchoolNow(schoolTimezone).date;
    if (await this.departureConsentService.hasAutonomousConsentOnDate(student.id, today)) {
      throw new BadRequestException(
        'Hoy tiene activo el permiso de salida autónoma para este alumno. Desactive el consentimiento en Circuito antes de iniciar una recogida con seguimiento.'
      );
    }
    if (!this.skipIngressAttendanceCheck()) {
      await this.assertStudentPresentForPickupToday(student.id);
    }
    const parent = await this.parentsRepository.findOne({
      where: { id: payload.requestedByParentId }
    });
    if (!parent) throw new NotFoundException('Padre no existe');

    const pickupOk = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM student_parents sp
        WHERE sp.student_id = $1 AND sp.parent_id = $2 AND sp.can_pickup = true
      ) AS ok`,
      [student.id, parent.id]
    );
    if (!pickupOk[0]?.ok) {
      throw new ForbiddenException(
        'Este perfil no está autorizado para recoger a este estudiante (can_pickup en la vinculación).'
      );
    }

    let vehicleId: string | null = null;
    if (payload.pickupMethod === PickupMethod.VEHICULO_REGISTRADO) {
      if (!payload.vehicleId) {
        throw new BadRequestException('Debe indicar vehicleId cuando el método es VEHICULO_REGISTRADO');
      }
      const vehicle = await this.vehiclesRepository.findOne({ where: { id: payload.vehicleId } });
      if (!vehicle || vehicle.parentId !== parent.id) {
        throw new BadRequestException('Vehículo no válido para el padre solicitante');
      }
      if (!vehicle.isActive) {
        throw new BadRequestException('El vehículo seleccionado no está activo');
      }
      vehicleId = vehicle.id;
    } else if (payload.vehicleId) {
      throw new BadRequestException('vehicleId solo aplica cuando el método es VEHICULO_REGISTRADO');
    }
    const pickupVehicleDescription = payload.pickupVehicleDescription?.trim() || null;
    if (payload.pickupMethod === PickupMethod.OTRO_VEHICULO && !pickupVehicleDescription) {
      throw new BadRequestException('Describe el vehículo o taxi usado para la recogida');
    }

    const initialStatus =
      payload.pickupMethod === PickupMethod.SOLO_CONSENTIMIENTO
        ? CircuitStatus.CONSENTIDO_SOLO
        : CircuitStatus.PENDIENTE;

    const request = this.circuitRepository.create({
      studentId: payload.studentId,
      requestedByParentId: payload.requestedByParentId,
      pickupMethod: payload.pickupMethod,
      status: initialStatus,
      requestTime: new Date(),
      parentGpsLatitude: payload.parentGpsLatitude?.toString() ?? null,
      parentGpsLongitude: payload.parentGpsLongitude?.toString() ?? null,
      vehicleId,
      pickupVehicleDescription,
      pickupNotes: payload.pickupNotes?.trim() || null,
      teacherSignal: null
    });
    const saved = await this.circuitRepository.save(request);
    await this.notifyTeachersOnNewCircuitRequest(saved, student, parent);
    return {
      message: 'Solicitud de circuito creada',
      requestId: saved.id,
      status: saved.status
    };
  }

  private async notifyTeachersOnNewCircuitRequest(
    request: CircuitRequestEntity,
    student: StudentEntity,
    parent: ParentEntity
  ): Promise<void> {
    const staffUserIds = await this.circuitStaffRecipientsForStudent(student);
    if (staffUserIds.length === 0) return;

    const parentUser = await this.usersRepository.findOne({ where: { id: parent.userId } });
    const studentName = await this.studentDisplayName(student.id);
    const parentName = parentUser?.fullName?.trim() || 'un padre/tutor';
    const title = `Nueva solicitud de recogida: ${studentName}`;
    const body = `${parentName} inició una solicitud de circuito. Revise Circuito del día para atenderla.`;

    const rows = staffUserIds.map((userId) =>
      this.notificationsRepository.create({
        userId,
        title,
        message: body,
        deliveryStatus: 'SENT'
      })
    );
    await this.notificationsRepository.save(rows);

    for (const userId of staffUserIds) {
      void this.fcmService
        .sendPushToUser(userId, title, body, {
          type: 'circuit',
          route: '/app/circuito/hoy',
          circuitRequestId: request.id,
          status: request.status
        })
        .catch((err: unknown) => {
          this.logger.warn(`Push circuito a personal no enviado: ${String(err)}`);
        });
    }
  }

  private async studentDisplayName(studentId: string): Promise<string> {
    const row = await this.studentsRepository
      .createQueryBuilder('s')
      .innerJoin('users', 'u', 'u.id = s.user_id')
      .select('u.full_name', 'fullName')
      .where('s.id = :id', { id: studentId })
      .getRawOne<{ fullName: string }>();
    const n = row?.fullName?.trim();
    return n || CircuitService.ANONYMOUS_STUDENT_LABEL;
  }

  private async parentUserIdByPk(parentPk: string): Promise<string | null> {
    const p = await this.parentsRepository.findOne({ where: { id: parentPk } });
    return p?.userId ?? null;
  }

  private pushCircuitToParent(
    parentUserId: string | null,
    requestId: string,
    status: CircuitStatus,
    title: string,
    body: string
  ) {
    if (!parentUserId || !requestId?.trim()) {
      if (!requestId?.trim()) {
        this.logger.warn('Circuito: omitiendo FCM (requestId vacío o inválido).');
      }
      return;
    }
    void this.fcmService
      .sendPushToUser(parentUserId, title, body, {
        type: 'circuit',
        circuitRequestId: requestId,
        status: String(status),
        openPath: `/app/circuito/${requestId}`
      })
      .catch((err: unknown) => {
        this.logger.warn(`FCM circuito no enviado: ${String(err)}`);
      });
  }

  private circuitPushCopy(
    status: CircuitStatus,
    studentName: string
  ): { title: string; body: string } | null {
    switch (status) {
      case CircuitStatus.PADRE_EN_CAMINO:
        return {
          title: 'En camino al plantel',
          body: `El padre indicó que va en camino a recoger a ${studentName}.`
        };
      case CircuitStatus.NOTIFICADO_LLEGADA:
        return {
          title: 'Llegada notificada',
          body: `Actualización del circuito: llegada al plantel (${studentName}).`
        };
      case CircuitStatus.AUTORIZADO_SALIR:
        return {
          title: 'Autorizado a salir',
          body: `Puedes acercarte a recoger a ${studentName}.`
        };
      case CircuitStatus.EN_CAMINO:
        return {
          title: 'En camino',
          body: `El circuito marcó "en camino" para ${studentName}.`
        };
      case CircuitStatus.ENTREGADO:
        return {
          title: 'Entrega completada',
          body: `Se cerró el circuito: ${studentName} — entregado.`
        };
      case CircuitStatus.CONSENTIDO_SOLO:
        return {
          title: 'Consentimiento registrado',
          body: `Consentimiento sin circuito de recogida (${studentName}).`
        };
      case CircuitStatus.CANCELADO:
        return {
          title: 'Circuito cancelado',
          body: `La solicitud de recogida de ${studentName} fue cancelada.`
        };
      case CircuitStatus.CERRADO_SIN_CONFIRMACION_PADRE:
        return {
          title: 'Circuito cerrado sin confirmación',
          body: `Se cerró el circuito de ${studentName} sin confirmación final del padre en el plazo indicado.`
        };
      default:
        return null;
    }
  }

  async updateParentGps(id: string, parentUserId: string, dto: UpdateCircuitGpsDto) {
    const req = await this.findById(id);
    await this.assertCircuitEnabledForStudent(req.studentId);
    if (this.isTerminalCircuitStatus(req.status)) {
      throw new BadRequestException('El circuito está cerrado; no se puede actualizar la ubicación.');
    }
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');
    if (req.requestedByParentId !== parent.id) {
      throw new ForbiddenException('Solo el padre solicitante puede actualizar el GPS');
    }
    req.parentGpsLatitude = dto.parentGpsLatitude.toString();
    req.parentGpsLongitude = dto.parentGpsLongitude.toString();

    const schoolGeo = await this.getSchoolGeoByRequest(req);
    const proximity = await this.calculateDistanceToSchool(
      dto.parentGpsLatitude,
      dto.parentGpsLongitude,
      schoolGeo.latitude,
      schoolGeo.longitude
    );

    const radiusKm = schoolGeo.radiusKm;
    let autoTransitioned = false;

    // Auto-transicion: si padre en PADRE_EN_CAMINO entra al radio -> NOTIFICADO_LLEGADA
    if (req.status === CircuitStatus.PADRE_EN_CAMINO && proximity.distanceKm <= radiusKm) {
      req.status = CircuitStatus.NOTIFICADO_LLEGADA;
      req.arrivalSnapshotLatitude = dto.parentGpsLatitude.toString();
      req.arrivalSnapshotLongitude = dto.parentGpsLongitude.toString();
      req.arrivalSnapshotAt = new Date();
      autoTransitioned = true;
    }

    const saved = await this.circuitRepository.save(req);

    if (autoTransitioned) {
      const studentName = await this.studentDisplayName(saved.studentId);
      await this.notifyStaffParentInRadius(saved, studentName);
      this.pushCircuitToParent(parentUserId, saved.id, saved.status, 'En el radio del plantel', `Entraste al area de recogida. El personal fue notificado. Espera autorizacion para ${studentName}.`);
    }

    return {
      message: autoTransitioned ? 'Ubicación actualizada — llegada detectada automáticamente' : 'Ubicación actualizada',
      id: saved.id,
      parentGpsLatitude: saved.parentGpsLatitude,
      parentGpsLongitude: saved.parentGpsLongitude,
      status: saved.status,
      schoolRadiusKm: radiusKm,
      distanceToSchoolKm: Number(proximity.distanceKm.toFixed(3)),
      etaMinutes: proximity.durationSeconds ? Math.ceil(proximity.durationSeconds / 60) : null,
      distanceSource: proximity.source,
      autoTransitioned
    };
  }

  /** Notifica al personal responsable (docente de la clase actual + admin de la escuela). */
  private async notifyStaffParentInRadius(req: CircuitRequestEntity, studentName: string): Promise<void> {
    const student = await this.studentsRepository.findOne({ where: { id: req.studentId } });
    if (!student) return;

    const uniqueStaff = await this.circuitStaffRecipientsForStudent(student);
    if (uniqueStaff.length === 0) return;

    const title = `Padre en radio — ${studentName}`;
    const body = `El padre/tutor esta en el area de recogida. Autoriza la salida de ${studentName} desde Circuito del dia.`;

    const rows = uniqueStaff.map((userId) =>
      this.notificationsRepository.create({ userId, title, message: body, deliveryStatus: 'SENT' })
    );
    await this.notificationsRepository.save(rows);

    for (const userId of uniqueStaff) {
      void this.fcmService
        .sendPushToUser(userId, title, body, {
          type: 'circuit',
          route: '/app/circuito/hoy',
          circuitRequestId: req.id,
          status: CircuitStatus.NOTIFICADO_LLEGADA
        })
        .catch((err: unknown) => {
          this.logger.warn(`FCM staff radio-circuito no enviado: ${String(err)}`);
        });
    }
  }

  async advanceParentProgress(id: string, parentUserId: string, dto: UpdateParentCircuitProgressDto) {
    const req = await this.findById(id);
    await this.assertCircuitEnabledForStudent(req.studentId);
    if (this.isTerminalCircuitStatus(req.status)) {
      throw new BadRequestException('El circuito está cerrado; no se puede avanzar el estado.');
    }
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');
    if (req.requestedByParentId !== parent.id) {
      throw new ForbiddenException('Solo el padre solicitante puede avanzar el circuito');
    }

    const hasGps =
      dto.parentGpsLatitude != null &&
      dto.parentGpsLongitude != null &&
      typeof dto.parentGpsLatitude === 'number' &&
      typeof dto.parentGpsLongitude === 'number';

    /** Compat: clientes que usan `NOTIFICADO_LLEGADA` + coordenadas en este mismo endpoint. */
    if (dto.status === CircuitStatus.NOTIFICADO_LLEGADA) {
      if (!hasGps) {
        throw new BadRequestException(
          'La llegada al plantel se confirma con la ubicación: use el seguimiento GPS del circuito o envíe coordenadas en el endpoint /gps.'
        );
      }
      if (req.status !== CircuitStatus.PADRE_EN_CAMINO) {
        throw new BadRequestException(`Transición de padre no permitida: ${req.status} -> NOTIFICADO_LLEGADA`);
      }
      await this.updateParentGps(id, parentUserId, {
        parentGpsLatitude: dto.parentGpsLatitude!,
        parentGpsLongitude: dto.parentGpsLongitude!
      });
      return this.findByIdForViewer(id, parentUserId, UserRole.PADRE);
    }

    const next = dto.status;

    if (req.status === next && !hasGps) {
      return this.findByIdForViewer(req.id, parentUserId, UserRole.PADRE);
    }

    if (req.status === next && next === CircuitStatus.PADRE_EN_CAMINO && hasGps) {
      await this.updateParentGps(id, parentUserId, {
        parentGpsLatitude: dto.parentGpsLatitude!,
        parentGpsLongitude: dto.parentGpsLongitude!
      });
      return this.findByIdForViewer(id, parentUserId, UserRole.PADRE);
    }

    if (req.status !== next) {
      this.assertParentTransition(req.status, next);
      req.status = next;
      const saved = await this.circuitRepository.save(req);

      const parentUid = await this.parentUserIdByPk(saved.requestedByParentId);
      const name = await this.studentDisplayName(saved.studentId);
      const copy = this.circuitPushCopy(next, name);
      if (copy) {
        this.pushCircuitToParent(parentUid, saved.id, saved.status, copy.title, copy.body);
      }
    }

    if (next === CircuitStatus.PADRE_EN_CAMINO && hasGps) {
      await this.updateParentGps(id, parentUserId, {
        parentGpsLatitude: dto.parentGpsLatitude!,
        parentGpsLongitude: dto.parentGpsLongitude!
      });
    }

    /** Misma forma que GET /circuit-requests/:id (evita estado desincronizado en el cliente tras el PATCH). */
    return this.findByIdForViewer(id, parentUserId, UserRole.PADRE);
  }

  private assertParentTransition(from: CircuitStatus, to: CircuitStatus) {
    if (from === CircuitStatus.PENDIENTE && to === CircuitStatus.PADRE_EN_CAMINO) return;
    // NOTIFICADO_LLEGADA is now triggered automatically by GPS proximity, not manually by the parent
    throw new BadRequestException(`Transición de padre no permitida: ${from} -> ${to}`);
  }

  /**
   * Solicitudes del día según rol:
   * - ADMIN: requiere `schoolId` (UUID de institución) para no mezclar escuelas.
   * - ADMINISTRATIVO: solo la institución vinculada a su usuario.
   * - DOCENTE: solo alumnos de grupos donde tiene asignación.
   */
  async findToday(
    userId: string,
    role: UserRole,
    schoolIdParam?: string | null,
    searchQ?: string | null,
    limitStr?: string | null
  ): Promise<CircuitTodayListItem[]> {
    const tz = getCircuitTimezone();
    const maxRows = Math.min(300, Math.max(10, Number.parseInt(limitStr ?? '120', 10) || 120));

    const qb = this.circuitRepository
      .createQueryBuilder('cr')
      /** No enlazar `groups` aquí: `students.group_id` es nullable y INNER JOIN excluía recogidas válidas. */
      .innerJoin('students', 'st', 'st.id = cr.student_id')
      .innerJoin('users', 'su', 'su.id = st.user_id')
      .innerJoin('parents', 'p', 'p.id = cr.requested_by_parent_id')
      .innerJoin('users', 'pu', 'pu.id = p.user_id')
      .where('(timezone(:tz, cr.request_time))::date = (timezone(:tz, now()))::date', { tz });

    const q = searchQ?.trim();
    if (q) {
      qb.andWhere('(su.full_name ILIKE :pat OR st.matricula ILIKE :pat OR pu.full_name ILIKE :pat)', {
        pat: `%${q}%`
      });
    }

    if (role === UserRole.ADMIN) {
      const sid = schoolIdParam?.trim();
      if (!sid || !this.isUuid(sid)) {
        return [];
      }
      qb.andWhere('st.school_id = :schoolId', { schoolId: sid });
    } else if (role === UserRole.ADMINISTRATIVO) {
      const schoolId = await this.userSchoolId(userId);
      if (!schoolId) {
        return [];
      }
      qb.andWhere('st.school_id = :schoolId', { schoolId });
    } else if (role === UserRole.DOCENTE) {
      const allowedIds = await this.findTeacherAllowedTodayRequestIds(userId, searchQ, maxRows);
      if (allowedIds.length === 0) return [];
      qb.andWhere('cr.id IN (:...allowedIds)', { allowedIds });
      qb.andWhere(
        `(
          (st.group_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM teachers t
            INNER JOIN teacher_groups tg ON tg.teacher_id = t.id
            WHERE t.user_id = :uid AND tg.group_id = st.group_id
          ))
          OR
          (st.group_id IS NULL AND EXISTS (
            SELECT 1 FROM teachers t
            INNER JOIN teacher_groups tg ON tg.teacher_id = t.id
            INNER JOIN groups g2 ON g2.id = tg.group_id
            WHERE t.user_id = :uid AND g2.school_id = st.school_id
          ))
        )`,
        { uid: userId }
      );
    }

    try {
      const entities = await qb.orderBy('cr.requestTime', 'DESC').take(maxRows).getMany();
      return await this.mapCircuitEntitiesToTodayList(entities);
    } catch (error) {
      const reason =
        error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      this.logger.warn(`Circuito findToday: fallback SQL por error en query principal (${reason})`);
      try {
        return await this.findTodayFallback(userId, role, schoolIdParam, searchQ, maxRows, todayYmdInCircuitTimezone());
      } catch (fallbackError) {
        const fallbackReason =
          fallbackError instanceof Error
            ? `${fallbackError.name}: ${fallbackError.message}`
            : String(fallbackError);
        this.logger.error(`Circuito findToday: fallback SQL también falló (${fallbackReason})`);
        throw error;
      }
    }
  }

  /**
   * Fallback robusto para entornos legacy donde request_time no siempre mantiene el mismo tipo SQL.
   * Filtra por prefijo de fecha textual (YYYY-MM-DD) y evita funciones de fecha sensibles al tipo.
   */
  private async findTodayFallback(
    userId: string,
    role: UserRole,
    schoolIdParam: string | null | undefined,
    searchQ: string | null | undefined,
    maxRows: number,
    todayIso: string
  ): Promise<CircuitTodayListItem[]> {
    const params: Array<string | number> = [todayIso, maxRows];
    let idx = params.length;
    const where: string[] = [`COALESCE(cr.request_time::text, '') LIKE ($1 || '%')`];

    const q = searchQ?.trim();
    if (q) {
      idx += 1;
      params.push(`%${q}%`);
      where.push(`(su.full_name ILIKE $${idx} OR st.matricula ILIKE $${idx} OR pu.full_name ILIKE $${idx})`);
    }

    if (role === UserRole.ADMIN) {
      const sid = schoolIdParam?.trim();
      if (!sid || !this.isUuid(sid)) {
        return [];
      }
      idx += 1;
      params.push(sid);
      where.push(`st.school_id = $${idx}`);
    } else if (role === UserRole.ADMINISTRATIVO) {
      const schoolId = await this.userSchoolId(userId);
      if (!schoolId) {
        return [];
      }
      idx += 1;
      params.push(schoolId);
      where.push(`st.school_id = $${idx}`);
    } else if (role === UserRole.DOCENTE) {
      idx += 1;
      const uidPlaceholder = `$${idx}`;
      params.push(userId);
      where.push(`(
          (st.group_id IS NOT NULL AND EXISTS (
            SELECT 1
            FROM teachers t
            INNER JOIN teacher_groups tg ON tg.teacher_id = t.id
            WHERE t.user_id = ${uidPlaceholder} AND tg.group_id = st.group_id
          ))
          OR
          (st.group_id IS NULL AND EXISTS (
            SELECT 1
            FROM teachers t
            INNER JOIN teacher_groups tg ON tg.teacher_id = t.id
            INNER JOIN groups g2 ON g2.id = tg.group_id
            WHERE t.user_id = ${uidPlaceholder} AND g2.school_id = st.school_id
          ))
      )`);
    }

    const sql = `
      SELECT
        cr.*,
        su.full_name AS student_full_name,
        st.matricula AS student_matricula
      FROM circuit_requests cr
      INNER JOIN students st ON st.id = cr.student_id
      INNER JOIN users su ON su.id = st.user_id
      INNER JOIN parents p ON p.id = cr.requested_by_parent_id
      INNER JOIN users pu ON pu.id = p.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY cr.request_time DESC
      LIMIT $2
    `;

    const raw = (await this.circuitRepository.query(sql, params)) as Record<string, unknown>[];
    const items = raw.map((row) => this.mapRawCircuitRowToTodayItem(row));
    if (role !== UserRole.DOCENTE) return items;
    const allowedIdSet = await this.filterTeacherAllowedRequestIds(
      userId,
      items.map((item) => item.id)
    );
    if (allowedIdSet.size === 0) return [];
    return items.filter((item) => item.id && allowedIdSet.has(item.id));
  }

  private async mapCircuitEntitiesToTodayList(entities: CircuitRequestEntity[]): Promise<CircuitTodayListItem[]> {
    const meta = await this.studentMetaForTodayList(entities.map((e) => e.studentId));
    return entities.map((e) => ({
      id: e.id,
      studentId: e.studentId,
      status: e.status,
      pickupMethod: e.pickupMethod,
      requestTime: this.normalizeRequestTimeIso(e.requestTime),
      studentFullName: meta.get(e.studentId)?.fullName ?? null,
      studentMatricula: meta.get(e.studentId)?.matricula ?? null
    }));
  }

  private async studentMetaForTodayList(studentIds: string[]): Promise<
    Map<string, { fullName: string; matricula: string }>
  > {
    const map = new Map<string, { fullName: string; matricula: string }>();
    const ids = [...new Set(studentIds)].filter(Boolean);
    if (ids.length === 0) return map;
    const rows = await this.studentsRepository
      .createQueryBuilder('st')
      .innerJoin('users', 'su', 'su.id = st.user_id')
      .select('st.id', 'sid')
      .addSelect('st.matricula', 'matricula')
      .addSelect('su.full_name', 'full_name')
      .where('st.id IN (:...ids)', { ids })
      .getRawMany<Record<string, unknown>>();
    for (const r of rows) {
      const sid = String(r.sid ?? '');
      const matricula = String(r.matricula ?? '');
      const fullName = String(r.full_name ?? '');
      if (sid) map.set(sid, { fullName, matricula });
    }
    return map;
  }

  private normalizeRequestTimeIso(value: unknown): string | null {
    if (value == null) return null;
    if (value instanceof Date) {
      const t = value.getTime();
      return Number.isNaN(t) ? null : value.toISOString();
    }
    if (typeof value === 'string') {
      const normalized =
        value.length >= 10 && value.includes(' ') && !value.includes('T') ? value.replace(' ', 'T') : value;
      const d = new Date(normalized);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    return null;
  }

  private mapRawCircuitRowToTodayItem(r: Record<string, unknown>): CircuitTodayListItem {
    const pickStr = (...keys: string[]) => {
      for (const k of keys) {
        const v = r[k];
        if (typeof v === 'string' && v.length > 0) return v;
      }
      return '';
    };
    const id = pickStr('id');
    const studentId = pickStr('student_id', 'studentId');
    const status = pickStr('status') as CircuitStatus;
    const pickupMethod = pickStr('pickup_method', 'pickupMethod') as PickupMethod;
    const rt = r.request_time ?? r.requestTime;
    const requestTime = this.normalizeRequestTimeIso(rt);
    const studentFullNameRaw = r.student_full_name ?? r.studentFullName;
    const studentMatriculaRaw = r.student_matricula ?? r.studentMatricula;
    const studentFullName =
      typeof studentFullNameRaw === 'string' && studentFullNameRaw.trim() ? studentFullNameRaw.trim() : null;
    const studentMatricula =
      typeof studentMatriculaRaw === 'string' && studentMatriculaRaw.trim()
        ? studentMatriculaRaw.trim()
        : null;
    return {
      id,
      studentId,
      status,
      pickupMethod,
      requestTime,
      studentFullName,
      studentMatricula
    };
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  private async userSchoolId(userId: string): Promise<string | null> {
    const rows = await this.studentsRepository.manager.query<{ school_id: string | null }[]>(
      `SELECT school_id FROM users WHERE id = $1`,
      [userId]
    );
    const sid = rows[0]?.school_id ?? null;
    return sid;
  }

  async findById(id: string) {
    const row = await this.circuitRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Solicitud no encontrada');
    return row;
  }

  async findByIdForViewer(id: string, userId: string, role: UserRole) {
    const row = await this.findById(id);
    await this.assertCanViewCircuitRequest(row, userId, role);
    return row;
  }

  async getMapContext(id: string, userId: string, role: UserRole) {
    const req = await this.findById(id);
    await this.assertCanViewCircuitRequest(req, userId, role);
    const schoolGeo = await this.getSchoolGeoByRequest(req);
    const schoolLat = schoolGeo.latitude;
    const schoolLng = schoolGeo.longitude;
    const radiusKm = schoolGeo.radiusKm;
    let distanceKm: number | null = null;
    let durationSeconds: number | null = null;
    let source: 'mapbox' | 'haversine' | null = null;
    const snapLatStr = req.arrivalSnapshotLatitude ?? req.parentGpsLatitude;
    const snapLngStr = req.arrivalSnapshotLongitude ?? req.parentGpsLongitude;
    if (snapLatStr != null && snapLngStr != null) {
      const lat = Number(snapLatStr);
      const lng = Number(snapLngStr);
      const prox = await this.calculateDistanceToSchool(lat, lng, schoolLat, schoolLng);
      distanceKm = prox.distanceKm;
      durationSeconds = prox.durationSeconds;
      source = prox.source;
    }
    const withinRadius =
      distanceKm !== null ? distanceKm <= radiusKm + 1e-6 : null;
    return {
      circuitRequestId: req.id,
      studentId: req.studentId,
      status: req.status,
      pickupMethod: req.pickupMethod,
      vehicleId: req.vehicleId,
      pickupVehicleDescription: req.pickupVehicleDescription,
      pickupNotes: req.pickupNotes,
      teacherSignal: req.teacherSignal,
      parentConfirmDeadlineAt: req.parentConfirmDeadlineAt,
      parentConfirmDeadlineStartedAt: req.parentConfirmDeadlineStartedAt,
      parentReceiptConfirmedAt: req.parentReceiptConfirmedAt,
      parentGpsLatitude: req.parentGpsLatitude,
      parentGpsLongitude: req.parentGpsLongitude,
      arrivalSnapshotLatitude: req.arrivalSnapshotLatitude,
      arrivalSnapshotLongitude: req.arrivalSnapshotLongitude,
      arrivalSnapshotAt: req.arrivalSnapshotAt,
      schoolLatitude: schoolLat,
      schoolLongitude: schoolLng,
      arrivalRadiusKm: radiusKm,
      distanceToSchoolKm: distanceKm !== null ? Number(distanceKm.toFixed(3)) : null,
      withinSchoolArrivalRadius: withinRadius,
      etaMinutes: durationSeconds != null ? Math.ceil(durationSeconds / 60) : null,
      distanceSource: source
    };
  }

  /**
   * Secuencia fija: primero solo PREPARA_SALIDA; luego solo ALUMNO_CAMINO_A_SALIDA. Sin saltos ni cambios arbitrarios.
   */
  private getNextAllowedTeacherSignal(current: string | null): TeacherCircuitSignal | null {
    if (current == null || current === '') {
      return TeacherCircuitSignal.PREPARA_SALIDA;
    }
    if (current === TeacherCircuitSignal.PREPARA_SALIDA) {
      return TeacherCircuitSignal.ALUMNO_CAMINO_A_SALIDA;
    }
    if (current === TeacherCircuitSignal.ALUMNO_CAMINO_A_SALIDA) {
      return null;
    }
    return TeacherCircuitSignal.PREPARA_SALIDA;
  }

  async setTeacherSignal(
    id: string,
    dto: UpdateTeacherCircuitSignalDto,
    userId: string,
    role: UserRole
  ) {
    const req = await this.findById(id);
    await this.assertCircuitEnabledForStudent(req.studentId);
    if (this.isTerminalCircuitStatus(req.status)) {
      throw new BadRequestException(
        'El circuito ya finalizó; no se pueden enviar señales al aula ni a la familia.'
      );
    }
    await this.assertCanSetTeacherSignal(req, userId, role);
    if (dto.signal === undefined) {
      return { message: 'Sin cambios', id: req.id, teacherSignal: req.teacherSignal };
    }
    if (dto.signal === null) {
      throw new BadRequestException(
        'No se puede anular la señal pedagógica; la secuencia es obligatoria (primero preparación, luego alumno en camino).'
      );
    }
    const nextAllowed = this.getNextAllowedTeacherSignal(req.teacherSignal);
    if (nextAllowed === null) {
      throw new BadRequestException(
        'Ya se enviaron las dos señales pedagógicas permitidas para esta solicitud.'
      );
    }
    if (dto.signal !== nextAllowed) {
      const label =
        nextAllowed === TeacherCircuitSignal.PREPARA_SALIDA
          ? 'Preparando salida'
          : 'Alumno en camino a salida';
      throw new BadRequestException(`La única señal permitida ahora es: ${label}.`);
    }
    const previousSignal = req.teacherSignal;
    req.teacherSignal = dto.signal;
    this.maybeStartParentConfirmCountdown(req);
    const saved = await this.circuitRepository.save(req);
    await this.auditService
      .log(userId, 'circuit.teacher.signal', 'circuit_requests', saved.id, {
        studentId: saved.studentId,
        previousSignal,
        nextSignal: saved.teacherSignal,
        status: saved.status,
        role
      })
      .catch((err) =>
        this.logger.error('No se pudo registrar auditoría de señal docente', err as Error)
      );
    return { message: 'Señal actualizada', id: saved.id, teacherSignal: saved.teacherSignal };
  }

  private async assertCanViewCircuitRequest(req: CircuitRequestEntity, userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessStudent(userId, req.studentId);
      return;
    }

    if (role === UserRole.PADRE) {
      const parent = await this.parentsRepository.findOne({ where: { userId } });
      if (!parent || req.requestedByParentId !== parent.id) {
        throw new ForbiddenException('No autorizado a ver esta solicitud');
      }
      return;
    }

    if (role === UserRole.DOCENTE) {
      await this.assertTeacherCanHandleCircuitRequest(req, userId);
      return;
    }

    throw new ForbiddenException('No autorizado');
  }

  private async assertCanSetTeacherSignal(req: CircuitRequestEntity, userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessStudent(userId, req.studentId);
      return;
    }
    if (role === UserRole.DOCENTE) {
      await this.assertTeacherCanHandleCircuitRequest(req, userId);
      return;
    }
    throw new ForbiddenException('Solo docencia o administración puede enviar señales al circuito');
  }

  private async assertTeacherAssignedToGroup(userId: string, groupId: string) {
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    if (teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
      throw new ForbiddenException('El docente no está activo para operar en circuito');
    }

    const tg = await this.teacherGroupsRepository.findOne({
      where: { teacherId: teacher.id, groupId }
    });
    if (!tg) {
      throw new ForbiddenException('No tienes asignación en el grupo del estudiante');
    }
  }

  async cancel(id: string, parentUserId: string) {
    const req = await this.findById(id);
    await this.assertCircuitEnabledForStudent(req.studentId);
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    if (req.requestedByParentId !== parent.id) {
      throw new ForbiddenException('No puedes cancelar una solicitud de otro padre');
    }
    if (req.status === CircuitStatus.ENTREGADO) {
      throw new BadRequestException('No se puede cancelar una solicitud ya entregada');
    }
    if (req.status === CircuitStatus.CERRADO_SIN_CONFIRMACION_PADRE) {
      throw new BadRequestException('No se puede cancelar un circuito ya cerrado por plazo de confirmación');
    }
    if (req.status === CircuitStatus.CANCELADO) {
      return { message: 'Solicitud ya estaba cancelada', id: req.id, status: req.status };
    }

    req.status = CircuitStatus.CANCELADO;
    this.clearParentConfirmCountdown(req);
    const saved = await this.circuitRepository.save(req);

    const parentUid = await this.parentUserIdByPk(saved.requestedByParentId);
    const name = await this.studentDisplayName(saved.studentId);
    const copy = this.circuitPushCopy(CircuitStatus.CANCELADO, name);
    if (copy) {
      this.pushCircuitToParent(parentUid, saved.id, saved.status, copy.title, copy.body);
    }

    return { message: 'Solicitud cancelada', id: saved.id, status: saved.status };
  }

  async confirmDelivered(id: string, userId: string, role: UserRole) {
    const req = await this.findById(id);
    await this.assertCircuitEnabledForStudent(req.studentId);

    if (req.status === CircuitStatus.CANCELADO) {
      throw new BadRequestException('No se puede confirmar entrega en solicitud cancelada');
    }
    if (req.status === CircuitStatus.ENTREGADO) {
      return { message: 'Solicitud ya estaba entregada', id: req.id, status: req.status };
    }
    if (this.isTerminalCircuitStatus(req.status)) {
      throw new BadRequestException('El circuito ya está cerrado');
    }

    if (role === UserRole.PADRE) {
      const parent = await this.parentsRepository.findOne({ where: { userId } });
      if (!parent) throw new ForbiddenException('Perfil padre no encontrado');
      if (req.requestedByParentId !== parent.id) {
        throw new ForbiddenException('No puedes confirmar la entrega de una solicitud ajena');
      }
      /** Solo con el menor en tránsito hacia la salida (docente pasó a EN_CAMINO). */
      if (req.status !== CircuitStatus.EN_CAMINO) {
        throw new BadRequestException(
          'Solo puedes confirmar el recibimiento cuando el plantel haya indicado que el menor va en camino hacia la salida.'
        );
      }
      req.status = CircuitStatus.ENTREGADO;
      req.parentReceiptConfirmedAt = new Date();
      this.clearParentConfirmCountdown(req);
      req.teacherSignal = null;
    } else if (role === UserRole.ADMIN || role === UserRole.ADMINISTRATIVO || role === UserRole.DOCENTE) {
      if (role === UserRole.ADMINISTRATIVO) {
        await this.assertAdministrativeCanAccessStudent(userId, req.studentId);
      }
      if (req.status !== CircuitStatus.CONSENTIDO_SOLO) {
        throw new BadRequestException(
          'Solo el padre puede confirmar el recibimiento físico del menor. La institución solo cierra solicitudes de solo consentimiento.'
        );
      }
      req.status = CircuitStatus.ENTREGADO;
      this.clearParentConfirmCountdown(req);
      req.teacherSignal = null;
    } else {
      throw new ForbiddenException('No autorizado para confirmar entrega');
    }

    const saved = await this.circuitRepository.save(req);

    const parentUid = await this.parentUserIdByPk(saved.requestedByParentId);
    const name = await this.studentDisplayName(saved.studentId);
    const copy = this.circuitPushCopy(CircuitStatus.ENTREGADO, name);
    if (copy) {
      this.pushCircuitToParent(parentUid, saved.id, saved.status, copy.title, copy.body);
    }

    return {
      message: 'Entrega confirmada',
      id: saved.id,
      status: saved.status,
      confirmedByRole: role
    };
  }

  async updateStatus(id: string, dto: UpdateCircuitStatusDto, userId: string, role: UserRole) {
    if (role !== UserRole.ADMIN && role !== UserRole.ADMINISTRATIVO && role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado a cambiar el estado del circuito');
    }

    // NOTIFICADO_LLEGADA is set automatically via GPS proximity; staff cannot set it manually
    if (dto.status === CircuitStatus.NOTIFICADO_LLEGADA) {
      throw new BadRequestException(
        'La llegada al plantel solo la registra el padre o madre con ubicación (acción «Ya llegué»).'
      );
    }

    const req = await this.findById(id);
    await this.assertCircuitEnabledForStudent(req.studentId);
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessStudent(userId, req.studentId);
    }
    if (role === UserRole.DOCENTE) {
      await this.assertTeacherCanHandleCircuitRequest(req, userId);
    }
    if (this.isTerminalCircuitStatus(req.status)) {
      throw new BadRequestException('Circuito cerrado; no se puede cambiar el estado.');
    }
    const next = dto.status;
    const prevStatus = req.status;

    if (req.status === next) {
      return { message: 'Sin cambios', id: req.id, status: req.status };
    }

    this.assertValidTransition(req.status, next);

    const leavingEnCamino =
      req.status === CircuitStatus.EN_CAMINO && next !== CircuitStatus.EN_CAMINO;
    if (leavingEnCamino) {
      this.clearParentConfirmCountdown(req);
    }

    if (prevStatus === CircuitStatus.NOTIFICADO_LLEGADA && next === CircuitStatus.PADRE_EN_CAMINO) {
      this.clearArrivalSnapshot(req);
      req.parentGpsLatitude = null;
      req.parentGpsLongitude = null;
    }

    req.status = next;

    // Al autorizar salida, se implica que el alumno ya va camino a la salida
    if (next === CircuitStatus.AUTORIZADO_SALIR) {
      req.teacherSignal = TeacherCircuitSignal.ALUMNO_CAMINO_A_SALIDA;
    }

    if (next === CircuitStatus.EN_CAMINO) {
      if (req.teacherSignal !== TeacherCircuitSignal.ALUMNO_CAMINO_A_SALIDA) {
        this.clearParentConfirmCountdown(req);
      }
      this.maybeStartParentConfirmCountdown(req);
    }

    // Nota: el esquema actual no tiene columna notes; dto.notes se deja para futuro
    const saved = await this.circuitRepository.save(req);

    const parentUid = await this.parentUserIdByPk(saved.requestedByParentId);
    const name = await this.studentDisplayName(saved.studentId);

    if (prevStatus === CircuitStatus.NOTIFICADO_LLEGADA && next === CircuitStatus.PADRE_EN_CAMINO) {
      this.pushCircuitToParent(
        parentUid,
        saved.id,
        saved.status,
        'Confirme su llegada nuevamente',
        `El plantel solicita acercarse al colegio y volver a marcar «Ya llegué» con la ubicación activa (${name}).`
      );
    } else {
      const copy = this.circuitPushCopy(next, name);
      if (copy) {
        this.pushCircuitToParent(parentUid, saved.id, saved.status, copy.title, copy.body);
      }
    }

    await this.auditService
      .log(userId, 'circuit.status.update', 'circuit_requests', saved.id, {
        studentId: saved.studentId,
        fromStatus: prevStatus,
        toStatus: saved.status,
        role
      })
      .catch((err) =>
        this.logger.error('No se pudo registrar auditoría de cambio de estado circuito', err as Error)
      );

    return { message: 'Estado actualizado', id: saved.id, status: saved.status, changedBy: userId };
  }

  private clearArrivalSnapshot(req: CircuitRequestEntity) {
    req.arrivalSnapshotLatitude = null;
    req.arrivalSnapshotLongitude = null;
    req.arrivalSnapshotAt = null;
  }

  private assertValidTransition(from: CircuitStatus, to: CircuitStatus) {
    const allowed: Record<CircuitStatus, CircuitStatus[]> = {
      [CircuitStatus.PENDIENTE]: [CircuitStatus.PADRE_EN_CAMINO, CircuitStatus.CANCELADO, CircuitStatus.CONSENTIDO_SOLO],
      [CircuitStatus.PADRE_EN_CAMINO]: [CircuitStatus.CANCELADO],
      [CircuitStatus.NOTIFICADO_LLEGADA]: [
        CircuitStatus.AUTORIZADO_SALIR,
        CircuitStatus.PADRE_EN_CAMINO,
        CircuitStatus.CANCELADO
      ],
      [CircuitStatus.AUTORIZADO_SALIR]: [
        CircuitStatus.EN_CAMINO,
        CircuitStatus.CANCELADO
      ],
      [CircuitStatus.EN_CAMINO]: [CircuitStatus.CANCELADO],
      [CircuitStatus.ENTREGADO]: [],
      [CircuitStatus.CERRADO_SIN_CONFIRMACION_PADRE]: [],
      [CircuitStatus.CONSENTIDO_SOLO]: [CircuitStatus.ENTREGADO, CircuitStatus.CANCELADO],
      [CircuitStatus.CANCELADO]: []
    };

    const ok = allowed[from]?.includes(to) ?? false;
    if (!ok) {
      throw new BadRequestException(`Transicion no permitida: ${from} -> ${to}`);
    }
  }

  private async assertAdministrativeCanAccessStudent(userId: string, studentId: string): Promise<void> {
    const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
         SELECT 1
         FROM users u
         JOIN students s ON s.id = $2
         JOIN groups g ON g.id = s.group_id
         WHERE u.id = $1
           AND u.role = 'ADMINISTRATIVO'
           AND u.school_id IS NOT NULL
           AND u.school_id = g.school_id
      ) AS ok`,
      [userId, studentId]
    );
    if (!rows[0]?.ok) {
      throw new ForbiddenException('No autorizado para gestionar este circuito');
    }
  }

  private getSchoolRadiusKm() {
    return Number(process.env.CIRCUIT_ARRIVAL_RADIUS_KM ?? 1.5);
  }

  private defaultSchoolLatitude() {
    return Number(process.env.SCHOOL_LATITUDE ?? 4.6097);
  }

  private defaultSchoolLongitude() {
    return Number(process.env.SCHOOL_LONGITUDE ?? -74.0817);
  }

  private async getSchoolGeoByRequest(req: CircuitRequestEntity): Promise<SchoolGeo> {
    const row = await this.studentsRepository.manager.query<
      Array<{ school_latitude: string | null; school_longitude: string | null }>
    >(
      `SELECT s.latitude AS school_latitude, s.longitude AS school_longitude
       FROM students st
       JOIN groups g ON g.id = st.group_id
       JOIN schools s ON s.id = g.school_id
       WHERE st.id = $1
       LIMIT 1`,
      [req.studentId]
    );
    const rawLat = row[0]?.school_latitude;
    const rawLng = row[0]?.school_longitude;
    const hasCoords =
      rawLat != null &&
      rawLng != null &&
      String(rawLat).trim() !== '' &&
      String(rawLng).trim() !== '';
    if (hasCoords) {
      const lat = Number(rawLat);
      const lng = Number(rawLng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { latitude: lat, longitude: lng, radiusKm: this.getSchoolRadiusKm() };
      }
    }
    return {
      latitude: this.defaultSchoolLatitude(),
      longitude: this.defaultSchoolLongitude(),
      radiusKm: this.getSchoolRadiusKm()
    };
  }

  private async calculateDistanceToSchool(
    parentLat: number,
    parentLng: number,
    schoolLat: number,
    schoolLng: number
  ): Promise<DistanceResult> {
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;

    if (mapboxToken) {
      const path = `${parentLng},${parentLat};${schoolLng},${schoolLat}`;
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/driving/${path}` +
        `?alternatives=false&geometries=geojson&overview=false&access_token=${encodeURIComponent(mapboxToken)}`;
      try {
        const response = await fetch(url, { method: 'GET' });
        if (response.ok) {
          const body = (await response.json()) as {
            routes?: Array<{ distance?: number; duration?: number }>;
          };
          const route = body.routes?.[0];
          if (route?.distance !== undefined) {
            return {
              distanceKm: route.distance / 1000,
              durationSeconds: route.duration ?? null,
              source: 'mapbox'
            };
          }
        }
      } catch {
        // Fallback local si Mapbox no está disponible.
      }
    }

    return {
      distanceKm: this.haversineKm(parentLat, parentLng, schoolLat, schoolLng),
      durationSeconds: null,
      source: 'haversine'
    };
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const earthKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthKm * c;
  }
}

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
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { TeacherGroupEntity } from '../../database/entities/teacher-group.entity';
import { VehicleEntity } from '../../database/entities/vehicle.entity';
import { UserRole } from '../../database/entities/user.entity';
import { CreateCircuitRequestDto } from './dto/create-circuit-request.dto';
import { UpdateCircuitGpsDto } from './dto/update-circuit-gps.dto';
import { UpdateParentCircuitProgressDto } from './dto/update-parent-circuit-progress.dto';
import { UpdateCircuitStatusDto } from './dto/update-circuit-status.dto';
import { UpdateTeacherCircuitSignalDto } from './dto/update-teacher-circuit-signal.dto';
import { FcmService } from '../fcm/fcm.service';
import { SettingsService } from '../settings/settings.service';

type DistanceResult = {
  distanceKm: number;
  durationSeconds: number | null;
  source: 'mapbox' | 'haversine';
};

@Injectable()
export class CircuitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CircuitService.name);
  private parentConfirmPoll: ReturnType<typeof setInterval> | null = null;

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
    private readonly fcmService: FcmService,
    private readonly settingsService: SettingsService
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
    return Number.isFinite(n) && n > 0 ? Math.min(n, 120) : 15;
  }

  private isTerminalCircuitStatus(status: CircuitStatus): boolean {
    return (
      status === CircuitStatus.ENTREGADO ||
      status === CircuitStatus.CANCELADO ||
      status === CircuitStatus.CERRADO_SIN_CONFIRMACION_PADRE
    );
  }

  /** Cierra solicitudes EN_CAMINO cuyo plazo para confirmación del padre ya venció. */
  async applyParentConfirmTimeouts(): Promise<void> {
    const now = new Date();
    const rows = await this.circuitRepository.query<
      Array<{ id: string; student_id: string; requested_by_parent_id: string }>
    >(
      `UPDATE circuit_requests
       SET status = $1::circuit_status,
           teacher_signal = NULL,
           parent_confirm_deadline_at = NULL
       WHERE status = $2::circuit_status
         AND parent_confirm_deadline_at IS NOT NULL
         AND parent_confirm_deadline_at <= $3
       RETURNING id, student_id, requested_by_parent_id`,
      [CircuitStatus.CERRADO_SIN_CONFIRMACION_PADRE, CircuitStatus.EN_CAMINO, now]
    );

    for (const row of rows) {
      const parentUid = await this.parentUserIdByPk(row.requested_by_parent_id);
      const name = await this.studentDisplayName(row.student_id);
      this.pushCircuitToParent(
        parentUid,
        row.id,
        CircuitStatus.CERRADO_SIN_CONFIRMACION_PADRE,
        'Plazo de confirmación vencido',
        `El circuito de ${name} se cerró sin confirmación final del padre en el tiempo indicado.`
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
    const today = new Date().toISOString().slice(0, 10);
    const terminal = [
      CircuitStatus.ENTREGADO,
      CircuitStatus.CANCELADO,
      CircuitStatus.CERRADO_SIN_CONFIRMACION_PADRE
    ];
    const row = await this.circuitRepository
      .createQueryBuilder('cr')
      .where('cr.requestedByParentId = :pid', { pid: parent.id })
      .andWhere('DATE(cr.request_time) = :today', { today })
      .andWhere('cr.status NOT IN (:...terminal)', { terminal })
      .orderBy('cr.requestTime', 'DESC')
      .getOne();
    if (!row) return null;
    return { id: row.id, status: row.status, requestTime: row.requestTime };
  }

  async create(payload: CreateCircuitRequestDto) {
    if (!(await this.settingsService.isCircuitEnabled())) {
      throw new BadRequestException('El circuito de recogida está deshabilitado por la institución.');
    }

    const student = await this.studentsRepository.findOne({ where: { id: payload.studentId } });
    if (!student) throw new NotFoundException('Estudiante no existe');
    const parent = await this.parentsRepository.findOne({
      where: { id: payload.requestedByParentId }
    });
    if (!parent) throw new NotFoundException('Padre no existe');

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
      teacherSignal: null
    });
    const saved = await this.circuitRepository.save(request);
    return {
      message: 'Solicitud de circuito creada',
      requestId: saved.id,
      status: saved.status
    };
  }

  private async studentDisplayName(studentId: string): Promise<string> {
    const row = await this.studentsRepository
      .createQueryBuilder('s')
      .innerJoin('users', 'u', 'u.id = s.user_id')
      .select('u.full_name', 'fullName')
      .where('s.id = :id', { id: studentId })
      .getRawOne<{ fullName: string }>();
    const n = row?.fullName?.trim();
    return n || 'el estudiante';
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
    if (!parentUserId) return;
    void this.fcmService
      .sendPushToUser(parentUserId, title, body, {
        type: 'circuit',
        circuitRequestId: requestId,
        status
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

    const proximity = await this.calculateDistanceToSchool(
      dto.parentGpsLatitude,
      dto.parentGpsLongitude
    );

    const radiusKm = this.getSchoolRadiusKm();

    const saved = await this.circuitRepository.save(req);

    /** El estado no cambia por radio/GPS: el padre usa PATCH .../parent-progress para “en camino” y “llegué”. */

    return {
      message: 'Ubicación actualizada',
      id: saved.id,
      parentGpsLatitude: saved.parentGpsLatitude,
      parentGpsLongitude: saved.parentGpsLongitude,
      status: saved.status,
      schoolRadiusKm: radiusKm,
      distanceToSchoolKm: Number(proximity.distanceKm.toFixed(3)),
      etaMinutes: proximity.durationSeconds ? Math.ceil(proximity.durationSeconds / 60) : null,
      distanceSource: proximity.source,
      autoTransitioned: false
    };
  }

  async advanceParentProgress(id: string, parentUserId: string, dto: UpdateParentCircuitProgressDto) {
    const req = await this.findById(id);
    if (this.isTerminalCircuitStatus(req.status)) {
      throw new BadRequestException('El circuito está cerrado; no se puede avanzar el estado.');
    }
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');
    if (req.requestedByParentId !== parent.id) {
      throw new ForbiddenException('Solo el padre solicitante puede avanzar el circuito');
    }

    const next = dto.status;
    if (req.status === next) {
      return this.findByIdForViewer(req.id, parentUserId, UserRole.PADRE);
    }

    this.assertParentTransition(req.status, next);

    if (next === CircuitStatus.NOTIFICADO_LLEGADA) {
      const lat =
        dto.parentGpsLatitude === null || dto.parentGpsLatitude === undefined
          ? NaN
          : Number(dto.parentGpsLatitude as number | string);
      const lng =
        dto.parentGpsLongitude === null || dto.parentGpsLongitude === undefined
          ? NaN
          : Number(dto.parentGpsLongitude as number | string);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new BadRequestException(
          'Debe permitir el acceso a la ubicación y enviar coordenadas al marcar que ya llegó al plantel.'
        );
      }
      req.parentGpsLatitude = lat.toString();
      req.parentGpsLongitude = lng.toString();
      req.arrivalSnapshotLatitude = lat.toString();
      req.arrivalSnapshotLongitude = lng.toString();
      req.arrivalSnapshotAt = new Date();
    }

    req.status = next;
    const saved = await this.circuitRepository.save(req);

    const parentUid = await this.parentUserIdByPk(saved.requestedByParentId);
    const name = await this.studentDisplayName(saved.studentId);
    const copy = this.circuitPushCopy(next, name);
    if (copy) {
      this.pushCircuitToParent(parentUid, saved.id, saved.status, copy.title, copy.body);
    }

    /** Misma forma que GET /circuit-requests/:id (evita estado desincronizado en el cliente tras el PATCH). */
    return this.findByIdForViewer(saved.id, parentUserId, UserRole.PADRE);
  }

  private assertParentTransition(from: CircuitStatus, to: CircuitStatus) {
    if (from === CircuitStatus.PENDIENTE && to === CircuitStatus.PADRE_EN_CAMINO) return;
    if (from === CircuitStatus.PADRE_EN_CAMINO && to === CircuitStatus.NOTIFICADO_LLEGADA) return;
    throw new BadRequestException(`Transición de padre no permitida: ${from} -> ${to}`);
  }

  async findToday() {
    const today = new Date().toISOString().slice(0, 10);
    return this.circuitRepository
      .createQueryBuilder('cr')
      .where('DATE(cr.request_time) = :today', { today })
      .orderBy('cr.request_time', 'DESC')
      .getMany();
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
    const schoolLat = this.getSchoolLatitude();
    const schoolLng = this.getSchoolLongitude();
    const radiusKm = this.getSchoolRadiusKm();
    let distanceKm: number | null = null;
    let durationSeconds: number | null = null;
    let source: 'mapbox' | 'haversine' | null = null;
    const snapLatStr = req.arrivalSnapshotLatitude ?? req.parentGpsLatitude;
    const snapLngStr = req.arrivalSnapshotLongitude ?? req.parentGpsLongitude;
    if (snapLatStr != null && snapLngStr != null) {
      const lat = Number(snapLatStr);
      const lng = Number(snapLngStr);
      const prox = await this.calculateDistanceToSchool(lat, lng);
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
      teacherSignal: req.teacherSignal,
      parentConfirmDeadlineAt: req.parentConfirmDeadlineAt,
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
    req.teacherSignal = dto.signal;
    const saved = await this.circuitRepository.save(req);
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
      const student = await this.studentsRepository.findOne({ where: { id: req.studentId } });
      if (!student?.groupId) throw new ForbiddenException('El estudiante no tiene grupo asignado');
      await this.assertTeacherAssignedToGroup(userId, student.groupId);
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
      const student = await this.studentsRepository.findOne({ where: { id: req.studentId } });
      if (!student?.groupId) throw new ForbiddenException('El estudiante no tiene grupo asignado');
      await this.assertTeacherAssignedToGroup(userId, student.groupId);
      return;
    }
    throw new ForbiddenException('Solo docencia o administración puede enviar señales al circuito');
  }

  private async assertTeacherAssignedToGroup(userId: string, groupId: string) {
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');

    const tg = await this.teacherGroupsRepository.findOne({
      where: { teacherId: teacher.id, groupId }
    });
    if (!tg) {
      throw new ForbiddenException('No tienes asignación en el grupo del estudiante');
    }
  }

  async cancel(id: string, parentUserId: string) {
    const req = await this.findById(id);
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
      req.parentConfirmDeadlineAt = null;
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
      req.parentConfirmDeadlineAt = null;
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

    if (dto.status === CircuitStatus.NOTIFICADO_LLEGADA) {
      throw new BadRequestException(
        'La llegada al plantel solo la registra el padre o madre con ubicación (acción «Ya llegué»).'
      );
    }

    const req = await this.findById(id);
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessStudent(userId, req.studentId);
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

    if (next === CircuitStatus.EN_CAMINO) {
      req.parentConfirmDeadlineAt = new Date(Date.now() + this.parentConfirmWindowMinutes() * 60_000);
    } else if (req.status === CircuitStatus.EN_CAMINO) {
      req.parentConfirmDeadlineAt = null;
    }

    if (prevStatus === CircuitStatus.NOTIFICADO_LLEGADA && next === CircuitStatus.PADRE_EN_CAMINO) {
      this.clearArrivalSnapshot(req);
      req.parentGpsLatitude = null;
      req.parentGpsLongitude = null;
    }

    req.status = next;
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

  private getSchoolLatitude() {
    return Number(process.env.SCHOOL_LATITUDE ?? 4.6097);
  }

  private getSchoolLongitude() {
    return Number(process.env.SCHOOL_LONGITUDE ?? -74.0817);
  }

  private getSchoolRadiusKm() {
    return Number(process.env.CIRCUIT_ARRIVAL_RADIUS_KM ?? 1.5);
  }

  private async calculateDistanceToSchool(parentLat: number, parentLng: number): Promise<DistanceResult> {
    const schoolLat = this.getSchoolLatitude();
    const schoolLng = this.getSchoolLongitude();
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

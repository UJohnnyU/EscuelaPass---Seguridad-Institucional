import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CircuitRequestEntity, CircuitStatus } from '../../database/entities/circuit-request.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { UserRole } from '../../database/entities/user.entity';
import { CreateCircuitRequestDto } from './dto/create-circuit-request.dto';
import { UpdateCircuitGpsDto } from './dto/update-circuit-gps.dto';
import { UpdateCircuitStatusDto } from './dto/update-circuit-status.dto';
import { FcmService } from '../fcm/fcm.service';
import { SettingsService } from '../settings/settings.service';

type DistanceResult = {
  distanceKm: number;
  durationSeconds: number | null;
  source: 'mapbox' | 'haversine';
};

@Injectable()
export class CircuitService {
  private readonly logger = new Logger(CircuitService.name);

  constructor(
    @InjectRepository(CircuitRequestEntity)
    private readonly circuitRepository: Repository<CircuitRequestEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>,
    private readonly fcmService: FcmService,
    private readonly settingsService: SettingsService
  ) {}

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
    const request = this.circuitRepository.create({
      studentId: payload.studentId,
      requestedByParentId: payload.requestedByParentId,
      pickupMethod: payload.pickupMethod,
      status: CircuitStatus.PENDIENTE,
      requestTime: new Date(),
      parentGpsLatitude: payload.parentGpsLatitude?.toString() ?? null,
      parentGpsLongitude: payload.parentGpsLongitude?.toString() ?? null
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
      default:
        return null;
    }
  }

  async updateParentGps(id: string, parentUserId: string, dto: UpdateCircuitGpsDto) {
    const req = await this.findById(id);
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
    const shouldNotifyArrival =
      proximity.distanceKm <= radiusKm &&
      (req.status === CircuitStatus.PENDIENTE || req.status === CircuitStatus.EN_CAMINO);

    let autoTransitioned = false;
    if (shouldNotifyArrival && req.status !== CircuitStatus.NOTIFICADO_LLEGADA) {
      req.status = CircuitStatus.NOTIFICADO_LLEGADA;
      autoTransitioned = true;
    }

    const saved = await this.circuitRepository.save(req);

    if (autoTransitioned && saved.status === CircuitStatus.NOTIFICADO_LLEGADA) {
      const parentUid = await this.parentUserIdByPk(saved.requestedByParentId);
      const name = await this.studentDisplayName(saved.studentId);
      this.pushCircuitToParent(
        parentUid,
        saved.id,
        saved.status,
        'Llegada al colegio',
        `Tu ubicación entró en el radio del plantel (${name}).`
      );
    }

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
      autoTransitioned
    };
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

    if (role === UserRole.PADRE) {
      const parent = await this.parentsRepository.findOne({ where: { userId } });
      if (!parent) throw new ForbiddenException('Perfil padre no encontrado');
      if (req.requestedByParentId !== parent.id) {
        throw new ForbiddenException('No puedes confirmar la entrega de una solicitud ajena');
      }
    } else if (role !== UserRole.ADMIN && role !== UserRole.ADMINISTRATIVO && role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado para confirmar entrega');
    }

    if (req.status === CircuitStatus.CANCELADO) {
      throw new BadRequestException('No se puede confirmar entrega en solicitud cancelada');
    }
    if (req.status === CircuitStatus.ENTREGADO) {
      return { message: 'Solicitud ya estaba entregada', id: req.id, status: req.status };
    }

    req.status = CircuitStatus.ENTREGADO;
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

    const req = await this.findById(id);
    const next = dto.status;

    if (req.status === next) {
      return { message: 'Sin cambios', id: req.id, status: req.status };
    }

    this.assertValidTransition(req.status, next);

    req.status = next;
    // Nota: el esquema actual no tiene columna notes; dto.notes se deja para futuro
    const saved = await this.circuitRepository.save(req);

    const parentUid = await this.parentUserIdByPk(saved.requestedByParentId);
    const name = await this.studentDisplayName(saved.studentId);
    const copy = this.circuitPushCopy(next, name);
    if (copy) {
      this.pushCircuitToParent(parentUid, saved.id, saved.status, copy.title, copy.body);
    }

    return { message: 'Estado actualizado', id: saved.id, status: saved.status, changedBy: userId };
  }

  private assertValidTransition(from: CircuitStatus, to: CircuitStatus) {
    const allowed: Record<CircuitStatus, CircuitStatus[]> = {
      [CircuitStatus.PENDIENTE]: [
        CircuitStatus.NOTIFICADO_LLEGADA,
        CircuitStatus.CANCELADO,
        CircuitStatus.CONSENTIDO_SOLO
      ],
      [CircuitStatus.NOTIFICADO_LLEGADA]: [
        CircuitStatus.AUTORIZADO_SALIR,
        CircuitStatus.CANCELADO
      ],
      [CircuitStatus.AUTORIZADO_SALIR]: [
        CircuitStatus.EN_CAMINO,
        CircuitStatus.CANCELADO
      ],
      [CircuitStatus.EN_CAMINO]: [
        CircuitStatus.ENTREGADO,
        CircuitStatus.CANCELADO
      ],
      [CircuitStatus.ENTREGADO]: [],
      [CircuitStatus.CONSENTIDO_SOLO]: [CircuitStatus.ENTREGADO, CircuitStatus.CANCELADO],
      [CircuitStatus.CANCELADO]: []
    };

    const ok = allowed[from]?.includes(to) ?? false;
    if (!ok) {
      throw new BadRequestException(`Transicion no permitida: ${from} -> ${to}`);
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

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CircuitRequestEntity, CircuitStatus } from '../../database/entities/circuit-request.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { UserRole } from '../../database/entities/user.entity';
import { CreateCircuitRequestDto } from './dto/create-circuit-request.dto';
import { UpdateCircuitGpsDto } from './dto/update-circuit-gps.dto';
import { UpdateCircuitStatusDto } from './dto/update-circuit-status.dto';

@Injectable()
export class CircuitService {
  constructor(
    @InjectRepository(CircuitRequestEntity)
    private readonly circuitRepository: Repository<CircuitRequestEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>
  ) {}

  async create(payload: CreateCircuitRequestDto) {
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

  async updateParentGps(id: string, parentUserId: string, dto: UpdateCircuitGpsDto) {
    const req = await this.findById(id);
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');
    if (req.requestedByParentId !== parent.id) {
      throw new ForbiddenException('Solo el padre solicitante puede actualizar el GPS');
    }
    req.parentGpsLatitude = dto.parentGpsLatitude.toString();
    req.parentGpsLongitude = dto.parentGpsLongitude.toString();
    const saved = await this.circuitRepository.save(req);
    return {
      message: 'Ubicación actualizada',
      id: saved.id,
      parentGpsLatitude: saved.parentGpsLatitude,
      parentGpsLongitude: saved.parentGpsLongitude
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
    return { message: 'Solicitud cancelada', id: saved.id, status: saved.status };
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
}

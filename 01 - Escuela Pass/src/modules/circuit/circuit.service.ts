import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CircuitRequestEntity, CircuitStatus } from '../../database/entities/circuit-request.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { CreateCircuitRequestDto } from './dto/create-circuit-request.dto';

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

  async findToday() {
    const today = new Date().toISOString().slice(0, 10);
    return this.circuitRepository
      .createQueryBuilder('cr')
      .where('DATE(cr.request_time) = :today', { today })
      .orderBy('cr.request_time', 'DESC')
      .getMany();
  }
}

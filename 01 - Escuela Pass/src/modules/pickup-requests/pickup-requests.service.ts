import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParentEntity } from '../../database/entities/parent.entity';
import {
  PickupRequestEntity,
  PickupRequestStatus
} from '../../database/entities/pickup-request.entity';
import { SchoolEntity } from '../../database/entities/school.entity';
import { StudentEntity, StudentLifecycleStatus } from '../../database/entities/student.entity';
import { TeacherEntity, TeacherLifecycleStatus } from '../../database/entities/teacher.entity';
import { UserRole } from '../../database/entities/user.entity';
import { CreatePickupRequestDto } from './dto/create-pickup-request.dto';
import { UpdatePickupRequestStatusDto } from './dto/update-pickup-request-status.dto';

@Injectable()
export class PickupRequestsService {
  constructor(
    @InjectRepository(PickupRequestEntity)
    private readonly requestsRepository: Repository<PickupRequestEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(SchoolEntity)
    private readonly schoolsRepository: Repository<SchoolEntity>
  ) {}

  async create(dto: CreatePickupRequestDto, parentUserId: string) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    await this.assertParentLinkedToStudent(parent.id, dto.studentId);

    const visit = new Date(dto.visitDatetime);
    if (Number.isNaN(visit.getTime())) {
      throw new BadRequestException('La fecha y hora del retiro no son válidas.');
    }
    const nowMs = Date.now();
    if (visit.getTime() <= nowMs + 9 * 60 * 1000) {
      throw new BadRequestException('La fecha de retiro debe ser al menos 10 minutos en el futuro.');
    }
    const maxAhead = 120 * 24 * 60 * 60 * 1000;
    if (visit.getTime() > nowMs + maxAhead) {
      throw new BadRequestException('No se pueden programar retiros con más de 120 días de anticipación.');
    }

    const row = this.requestsRepository.create({
      parentId: parent.id,
      studentId: dto.studentId,
      visitDatetime: new Date(dto.visitDatetime),
      reason: dto.reason?.trim() ?? null,
      status: PickupRequestStatus.PENDIENTE
    });
    return this.requestsRepository.save(row);
  }

  async listMine(parentUserId: string) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    return this.requestsRepository.find({
      where: { parentId: parent.id },
      order: { visitDatetime: 'DESC' }
    });
  }

  async listForStaff(userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) {
      return this.requestsRepository.find({ order: { visitDatetime: 'DESC' } });
    }
    if (role === UserRole.ADMINISTRATIVO) {
      return this.requestsRepository
        .createQueryBuilder('vr')
        .innerJoin('students', 's', 's.id = vr.student_id')
        .innerJoin('groups', 'g', 'g.id = s.group_id')
        .innerJoin('users', 'u', 'u.id = :uid', { uid: userId })
        .where('u.school_id = g.school_id')
        .orderBy('vr.visit_datetime', 'DESC')
        .getMany();
    }
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado');
    }
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    if (teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
      throw new ForbiddenException('El docente no está activo para gestionar solicitudes');
    }

    return this.requestsRepository
      .createQueryBuilder('vr')
      .innerJoin('students', 's', 's.id = vr.student_id')
      .where('s.group_id IS NOT NULL')
      .andWhere(
        `EXISTS (SELECT 1 FROM teacher_groups tg WHERE tg.teacher_id = :tid AND tg.group_id = s.group_id)`,
        { tid: teacher.id }
      )
      .orderBy('vr.visit_datetime', 'DESC')
      .getMany();
  }

  async updateStatus(id: string, dto: UpdatePickupRequestStatusDto, userId: string, role: UserRole) {
    const row = await this.requestsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Solicitud no encontrada');

    if (
      row.status === PickupRequestStatus.RECHAZADA ||
      row.status === PickupRequestStatus.COMPLETADA ||
      row.status === PickupRequestStatus.CANCELADA
    ) {
      throw new BadRequestException('La solicitud ya está cerrada y no admite cambios.');
    }

    if (row.status === PickupRequestStatus.PENDIENTE) {
      if (
        dto.status !== PickupRequestStatus.APROBADA &&
        dto.status !== PickupRequestStatus.RECHAZADA
      ) {
        throw new BadRequestException('Una solicitud pendiente solo puede aprobarse o rechazarse.');
      }
    } else if (row.status === PickupRequestStatus.APROBADA) {
      if (
        dto.status !== PickupRequestStatus.COMPLETADA &&
        dto.status !== PickupRequestStatus.CANCELADA
      ) {
        throw new BadRequestException(
          'Una solicitud aprobada solo puede marcarse como completada o cancelada.'
        );
      }
    }

    if (role === UserRole.ADMIN) {
      row.status = dto.status;
      return this.requestsRepository.save(row);
    }
    if (role === UserRole.ADMINISTRATIVO) {
      const st = await this.studentsRepository.findOne({ where: { id: row.studentId } });
      if (!st?.groupId) throw new ForbiddenException('Estudiante sin grupo asignado');
      const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
        `SELECT EXISTS (
           SELECT 1 FROM users u
           JOIN groups g ON g.id = $2
           WHERE u.id = $1 AND u.role = 'ADMINISTRATIVO'
             AND u.school_id IS NOT NULL
             AND u.school_id = g.school_id
        ) AS ok`,
        [userId, st.groupId]
      );
      if (!rows[0]?.ok) throw new ForbiddenException('No autorizado');
      row.status = dto.status;
      return this.requestsRepository.save(row);
    }
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado');
    }
    await this.assertDocenteCanAccessStudentGroup(userId, row.studentId);
    row.status = dto.status;
    return this.requestsRepository.save(row);
  }

  /** Padre/tutor cancela su propia solicitud (pendiente o aprobada). */
  async cancelByParent(id: string, parentUserId: string) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    const row = await this.requestsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Solicitud no encontrada');
    if (row.parentId !== parent.id) {
      throw new ForbiddenException('No autorizado');
    }
    if (
      row.status !== PickupRequestStatus.PENDIENTE &&
      row.status !== PickupRequestStatus.APROBADA
    ) {
      throw new BadRequestException('Solo puede cancelar solicitudes pendientes o aprobadas.');
    }
    row.status = PickupRequestStatus.CANCELADA;
    return this.requestsRepository.save(row);
  }

  /**
   * Hay al menos una solicitud APROBADA para el estudiante cuya visit_datetime cae en el día UTC indicado (YYYY-MM-DD).
   */
  async hasApprovedPickupForStudentOnDate(studentId: string, ymdUtc: string): Promise<boolean> {
    const n = await this.requestsRepository
      .createQueryBuilder('vr')
      .where('vr.student_id = :sid', { sid: studentId })
      .andWhere('vr.status = :st', { st: PickupRequestStatus.APROBADA })
      .andWhere(`to_char(vr.visit_datetime AT TIME ZONE 'UTC', 'YYYY-MM-DD') = :d`, { d: ymdUtc })
      .getCount();
    return n > 0;
  }

  /**
   * Si la escuela lo exige, bloquea hasta exista retiro anticipado aprobado para el día actual (UTC).
   */
  async assertEarlyPickupApprovedIfSchoolRequires(studentId: string): Promise<void> {
    const student = await this.studentsRepository.findOne({
      where: { id: studentId },
      select: ['id', 'schoolId']
    });
    if (!student?.schoolId) return;

    const school = await this.schoolsRepository.findOne({
      where: { id: student.schoolId },
      select: ['circuitRequiresEarlyPickupApproval']
    });
    if (!school?.circuitRequiresEarlyPickupApproval) return;

    const ymd = new Date().toISOString().slice(0, 10);
    const ok = await this.hasApprovedPickupForStudentOnDate(studentId, ymd);
    if (!ok) {
      throw new BadRequestException(
        'La institución exige una solicitud de retiro anticipado aprobada para hoy antes de iniciar el circuito de recogida. Solicítela en «Retiro anticipado» y espere la aprobación del plantel.'
      );
    }
  }

  private async assertParentLinkedToStudent(parentId: string, studentId: string) {
    const student = await this.studentsRepository.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    if (student.lifecycleStatus !== StudentLifecycleStatus.ACTIVO) {
      throw new ForbiddenException('El estudiante no está activo para solicitudes de recogida');
    }

    const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM student_parents sp
        WHERE sp.parent_id = $1 AND sp.student_id = $2
      ) AS ok`,
      [parentId, studentId]
    );
    if (!rows[0]?.ok) {
      throw new ForbiddenException('No eres tutor de este estudiante');
    }
  }

  private async assertDocenteCanAccessStudentGroup(userId: string, studentId: string) {
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    const student = await this.studentsRepository.findOne({ where: { id: studentId } });
    if (!student?.groupId) {
      throw new ForbiddenException('El estudiante no tiene grupo asignado');
    }
    const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM teacher_groups WHERE teacher_id = $1 AND group_id = $2
      ) AS ok`,
      [teacher.id, student.groupId]
    );
    if (!rows[0]?.ok) {
      throw new ForbiddenException('No tienes asignación en el grupo de este estudiante');
    }
  }
}

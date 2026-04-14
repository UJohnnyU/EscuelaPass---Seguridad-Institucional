import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroupEntity } from '../../database/entities/group.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { SchoolNonInstructionalDayEntity } from '../../database/entities/school-non-instructional-day.entity';
import { CreateNonInstructionalDayDto } from './dto/create-non-instructional-day.dto';

export type NonInstructionalInfo = {
  nonInstructional: boolean;
  reasons: string[];
};

@Injectable()
export class SchoolCalendarService {
  constructor(
    @InjectRepository(SchoolNonInstructionalDayEntity)
    private readonly daysRepository: Repository<SchoolNonInstructionalDayEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupsRepository: Repository<GroupEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>
  ) {}

  /** Días sin clases que aplican al grupo del estudiante (y globales), en un rango de fechas. */
  async listNonInstructionalForStudent(userId: string, from?: string, to?: string) {
    const student = await this.studentsRepository.findOne({ where: { userId } });
    if (!student) throw new ForbiddenException('Perfil de estudiante no encontrado');
    if (!student.groupId) {
      return { groupId: null as string | null, days: [] };
    }
    const days = await this.list(from, to, student.groupId);
    return { groupId: student.groupId, days };
  }

  async listNonInstructionalForParent(userId: string, from?: string, to?: string) {
    const parentRows = await this.studentsRepository.manager.query<{ id: string }[]>(
      `SELECT id FROM parents WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const parentId = parentRows[0]?.id;
    if (!parentId) throw new ForbiddenException('Perfil padre no encontrado');

    const children = await this.studentsRepository.manager.query<
      { studentId: string; studentName: string; groupId: string | null }[]
    >(
      `SELECT s.id AS "studentId", u.full_name AS "studentName", s.group_id AS "groupId"
       FROM student_parents sp
       JOIN students s ON s.id = sp.student_id
       JOIN users u ON u.id = s.user_id
       WHERE sp.parent_id = $1
       ORDER BY u.full_name`,
      [parentId]
    );

    const byGroup = new Map<string, SchoolNonInstructionalDayEntity[]>();
    for (const child of children) {
      if (!child.groupId || byGroup.has(child.groupId)) continue;
      const days = await this.list(from, to, child.groupId);
      byGroup.set(child.groupId, days);
    }

    return {
      children: children.map((child) => ({
        studentId: child.studentId,
        studentName: child.studentName,
        groupId: child.groupId,
        days: child.groupId ? byGroup.get(child.groupId) ?? [] : []
      }))
    };
  }

  async create(dto: CreateNonInstructionalDayDto, createdByUserId: string) {
    const exceptionDate = dto.exceptionDate.slice(0, 10);
    if (dto.groupId) {
      const g = await this.groupsRepository.findOne({ where: { id: dto.groupId } });
      if (!g) throw new BadRequestException('Grupo no encontrado');
    }
    const row = this.daysRepository.create({
      exceptionDate,
      groupId: dto.groupId ?? null,
      reason: dto.reason?.trim() || null,
      createdBy: createdByUserId
    });
    try {
      return await this.daysRepository.save(row);
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
      if (code === '23505') {
        throw new BadRequestException('Ya existe un día sin clases para esa fecha y alcance');
      }
      throw e;
    }
  }

  async list(from?: string, to?: string, groupId?: string) {
    const qb = this.daysRepository.createQueryBuilder('d').orderBy('d.exceptionDate', 'ASC').addOrderBy('d.groupId', 'ASC');

    if (from) qb.andWhere('d.exceptionDate >= :from', { from: from.slice(0, 10) });
    if (to) qb.andWhere('d.exceptionDate <= :to', { to: to.slice(0, 10) });
    if (groupId) {
      qb.andWhere('(d.groupId IS NULL OR d.groupId = :gid)', { gid: groupId });
    }

    return qb.getMany();
  }

  async remove(id: string) {
    const res = await this.daysRepository.delete({ id });
    if (!res.affected) throw new NotFoundException('Registro no encontrado');
    return { deleted: true };
  }

  /**
   * Día sin clases para la fecha y el grupo del estudiante (o solo institución si groupId es null).
   */
  async getNonInstructionalForDate(dateStr: string, groupId: string | null): Promise<NonInstructionalInfo> {
    const date = dateStr.slice(0, 10);
    const qb = this.daysRepository
      .createQueryBuilder('d')
      .where('d.exceptionDate = :date', { date });

    // No pasar null como :gid: en Postgres el tipo del parámetro queda indeterminado ("$2").
    if (groupId === null) {
      qb.andWhere('d.groupId IS NULL');
    } else {
      qb.andWhere('(d.groupId IS NULL OR d.groupId = :gid)', { gid: groupId });
    }

    const rows = await qb.getMany();

    const reasons = rows.map((r) => r.reason).filter((x): x is string => !!x?.trim());
    return { nonInstructional: rows.length > 0, reasons };
  }

  assertInstructionalDay(info: NonInstructionalInfo): void {
    if (!info.nonInstructional) return;
    const detail = info.reasons.length ? ` (${info.reasons.join('; ')})` : '';
    throw new BadRequestException(
      `La fecha está marcada como día sin clases en el calendario escolar${detail}`
    );
  }

  /** Solo filas de alcance global (toda la institución). */
  async isGloballyNonInstructional(dateStr: string): Promise<boolean> {
    const date = dateStr.slice(0, 10);
    const n = await this.daysRepository
      .createQueryBuilder('d')
      .where('d.exceptionDate = :date', { date })
      .andWhere('d.groupId IS NULL')
      .getCount();
    return n > 0;
  }

  async getNonInstructionalForGroupDate(dateStr: string, groupId: string): Promise<NonInstructionalInfo> {
    const date = dateStr.slice(0, 10);
    const rows = await this.daysRepository
      .createQueryBuilder('d')
      .where('d.exceptionDate = :date', { date })
      .andWhere('(d.groupId IS NULL OR d.groupId = :gid)', { gid: groupId })
      .getMany();
    const reasons = rows.map((r) => r.reason).filter((x): x is string => !!x?.trim());
    return { nonInstructional: rows.length > 0, reasons };
  }
}

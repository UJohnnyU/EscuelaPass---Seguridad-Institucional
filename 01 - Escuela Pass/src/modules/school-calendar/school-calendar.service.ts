/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroupEntity } from '../../database/entities/group.entity';
import { SchoolNonInstructionalDayEntity } from '../../database/entities/school-non-instructional-day.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { CreateNonInstructionalDayDto } from './dto/create-non-instructional-day.dto';

export type NonInstructionalInfo = {
  nonInstructional: boolean;
  reasons: string[];
};

type JwtUserLike = { userId: string; role: UserRole };

@Injectable()
export class SchoolCalendarService {
  constructor(
    @InjectRepository(SchoolNonInstructionalDayEntity)
    private readonly daysRepository: Repository<SchoolNonInstructionalDayEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupsRepository: Repository<GroupEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>
  ) {}

  /** Días sin clases que aplican al grupo del estudiante (y globales de su escuela), en un rango de fechas. */
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

  async listForStaff(jwtUser: JwtUserLike, from?: string, to?: string, groupId?: string) {
    if (jwtUser.role === UserRole.DOCENTE) {
      if (!groupId) {
        throw new BadRequestException('Indique groupId para listar días sin clases');
      }
      await this.assertDocenteAssignedToGroup(jwtUser.userId, groupId);
      return this.list(from, to, groupId, undefined);
    }
    if (jwtUser.role === UserRole.ADMINISTRATIVO) {
      const u = await this.usersRepository.findOne({ where: { id: jwtUser.userId } });
      const scope = u?.schoolId ?? null;
      if (!scope) return [];
      if (groupId) {
        const g = await this.groupsRepository.findOne({ where: { id: groupId } });
        if (!g || g.schoolId !== scope) {
          throw new ForbiddenException('El grupo no pertenece a su escuela');
        }
        return this.list(from, to, groupId, undefined);
      }
      return this.list(from, to, undefined, scope);
    }
    return this.list(from, to, groupId, undefined);
  }

  async create(dto: CreateNonInstructionalDayDto, userId: string, role: UserRole) {
    const exceptionDate = dto.exceptionDate.slice(0, 10);

    if (dto.groupId) {
      const g = await this.groupsRepository.findOne({ where: { id: dto.groupId } });
      if (!g) throw new BadRequestException('Grupo no encontrado');
      if (role === UserRole.DOCENTE) {
        await this.assertDocenteAssignedToGroup(userId, dto.groupId);
      } else if (role === UserRole.ADMINISTRATIVO) {
        await this.assertAdministrativoSchool(userId, g.schoolId);
      }
      const row = this.daysRepository.create({
        exceptionDate,
        groupId: dto.groupId,
        schoolId: g.schoolId,
        reason: dto.reason?.trim() || null,
        createdBy: userId
      });
      return this.saveRow(row);
    }

    if (role === UserRole.DOCENTE) {
      throw new ForbiddenException(
        'Solo personal de secretaría puede marcar un día sin clases para toda la institución'
      );
    }

    let schoolId: string | null = dto.schoolId ?? null;
    if (role === UserRole.ADMINISTRATIVO) {
      const u = await this.usersRepository.findOne({ where: { id: userId } });
      if (!u?.schoolId) throw new BadRequestException('Su usuario no tiene escuela asignada');
      schoolId = u.schoolId;
    } else if (role === UserRole.ADMIN) {
      if (!schoolId) {
        const schools = await this.usersRepository.manager.query<{ id: string }[]>(
          `SELECT id FROM schools ORDER BY name LIMIT 2`
        );
        if (schools.length === 1) schoolId = schools[0].id;
      }
      if (!schoolId) {
        throw new BadRequestException('Indique la escuela (schoolId) para un día sin clases a nivel institución');
      }
    }

    const row = this.daysRepository.create({
      exceptionDate,
      groupId: null,
      schoolId,
      reason: dto.reason?.trim() || null,
      createdBy: userId
    });
    return this.saveRow(row);
  }

  private async saveRow(row: SchoolNonInstructionalDayEntity) {
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

  async remove(id: string, userId: string, role: UserRole) {
    const row = await this.daysRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Registro no encontrado');

    if (role === UserRole.DOCENTE) {
      if (!row.groupId) throw new ForbiddenException('No autorizado');
      await this.assertDocenteAssignedToGroup(userId, row.groupId);
    } else if (role === UserRole.ADMINISTRATIVO) {
      if (row.groupId) {
        const g = await this.groupsRepository.findOne({ where: { id: row.groupId } });
        if (g) await this.assertAdministrativoSchool(userId, g.schoolId);
      } else if (row.schoolId) {
        await this.assertAdministrativoSchool(userId, row.schoolId);
      } else {
        throw new ForbiddenException('No autorizado');
      }
    }

    await this.daysRepository.delete({ id });
    return { deleted: true };
  }

  /**
   * Lista días sin clases. Con `groupId`: globales de la escuela de ese grupo + los del grupo.
   * Con `staffSchoolScope`: solo entradas de esa escuela (globales o grupos de la escuela).
   */
  async list(from?: string, to?: string, groupId?: string, staffSchoolScope?: string | null) {
    const qb = this.daysRepository
      .createQueryBuilder('d')
      .orderBy('d.exceptionDate', 'ASC')
      .addOrderBy('d.groupId', 'ASC');

    if (from) qb.andWhere('d.exceptionDate >= :from', { from: from.slice(0, 10) });
    if (to) qb.andWhere('d.exceptionDate <= :to', { to: to.slice(0, 10) });

    if (groupId) {
      const g = await this.groupsRepository.findOne({ where: { id: groupId } });
      if (!g) return [];
      qb.andWhere('(d.groupId = :gid OR (d.groupId IS NULL AND d.schoolId = :sid))', {
        gid: groupId,
        sid: g.schoolId
      });
    } else if (staffSchoolScope) {
      qb.andWhere(
        '(d.schoolId = :scope OR EXISTS (SELECT 1 FROM groups g WHERE g.id = d.groupId AND g.school_id = :scope))',
        { scope: staffSchoolScope }
      );
    }

    return qb.getMany();
  }

  /**
   * Día sin clases para la fecha y el grupo del estudiante (globales de la escuela + del grupo).
   */
  async getNonInstructionalForDate(dateStr: string, groupId: string | null): Promise<NonInstructionalInfo> {
    if (groupId === null) {
      return { nonInstructional: false, reasons: [] };
    }
    return this.getNonInstructionalForGroupDate(dateStr, groupId);
  }

  assertInstructionalDay(info: NonInstructionalInfo): void {
    if (!info.nonInstructional) return;
    const detail = info.reasons.length ? ` (${info.reasons.join('; ')})` : '';
    throw new BadRequestException(
      `La fecha está marcada como día sin clases en el calendario escolar${detail}`
    );
  }

  /** Cualquier suspensión institucional global en la fecha (para tableros multi-escuela). */
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
    const group = await this.groupsRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    const date = dateStr.slice(0, 10);
    const rows = await this.daysRepository
      .createQueryBuilder('d')
      .where('d.exceptionDate = :date', { date })
      .andWhere('(d.groupId = :gid OR (d.groupId IS NULL AND d.schoolId = :sid))', {
        gid: groupId,
        sid: group.schoolId
      })
      .getMany();
    const reasons = rows.map((r) => r.reason).filter((x): x is string => !!x?.trim());
    return { nonInstructional: rows.length > 0, reasons };
  }

  private async assertDocenteAssignedToGroup(userId: string, groupId: string): Promise<void> {
    const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM teachers t
        INNER JOIN teacher_groups tg ON tg.teacher_id = t.id AND tg.group_id = $2
        WHERE t.user_id = $1
      ) AS ok`,
      [userId, groupId]
    );
    if (!rows[0]?.ok) {
      throw new ForbiddenException('No tiene asignación docente en este grupo');
    }
  }

  private async assertAdministrativoSchool(userId: string, schoolId: string): Promise<void> {
    const rows = await this.usersRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = $1 AND u.role = 'ADMINISTRATIVO' AND u.school_id = $2
      ) AS ok`,
      [userId, schoolId]
    );
    if (!rows[0]?.ok) {
      throw new ForbiddenException('No tiene permisos sobre esta escuela');
    }
  }
}

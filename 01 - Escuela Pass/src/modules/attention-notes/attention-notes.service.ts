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

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { NotificationEntity } from '../../database/entities/notification.entity';
import {
  AttentionSeverity,
  StudentAttentionNoteEntity
} from '../../database/entities/student-attention-note.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity, TeacherLifecycleStatus } from '../../database/entities/teacher.entity';
import { UserRole } from '../../database/entities/user.entity';
import { FcmService } from '../fcm/fcm.service';
import { CreateAttentionNoteDto } from './dto/create-attention-note.dto';

@Injectable()
export class AttentionNotesService {
  constructor(
    @InjectRepository(StudentAttentionNoteEntity)
    private readonly notesRepository: Repository<StudentAttentionNoteEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly fcmService: FcmService
  ) {}

  async create(dto: CreateAttentionNoteDto, userId: string, role: UserRole) {
    const student = await this.studentsRepository.findOne({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    await this.assertCanCreateForStudent(userId, role, student);

    const row = this.notesRepository.create({
      studentId: dto.studentId,
      createdByUserId: userId,
      severity: dto.severity,
      title: dto.title.trim(),
      description: dto.description.trim(),
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      notifiedParent: true
    });
    const saved = await this.notesRepository.save(row);
    await this.notifyParents(saved, student.id);
    return saved;
  }

  async listByGroupForTeacher(userId: string, role: UserRole, groupId: string) {
    if (role === UserRole.ADMIN) {
      // sin restricción adicional
    } else if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessGroup(userId, groupId);
    } else if (role === UserRole.DOCENTE) {
      const teacher = await this.teachersRepository.findOne({ where: { userId } });
      if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
      if (teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
        throw new ForbiddenException('El docente no está activo para consultar anotaciones');
      }

      const ok = await this.dataSource.query<{ ok: boolean }[]>(
        `SELECT EXISTS (
          SELECT 1 FROM teacher_groups WHERE teacher_id = $1 AND group_id = $2
        ) AS ok`,
        [teacher.id, groupId]
      );
      if (!ok[0]?.ok) {
        throw new ForbiddenException('No tienes asignación en este grupo');
      }
    } else {
      throw new ForbiddenException('No autorizado a listar anotaciones de este grupo');
    }

    return this.dataSource.query<
      {
        id: string;
        studentId: string;
        studentName: string;
        matricula: string;
        severity: AttentionSeverity;
        title: string;
        description: string;
        occurredAt: string;
        createdAt: string;
        createdByName: string;
      }[]
    >(
      `SELECT n.id,
              n.student_id AS "studentId",
              su.full_name AS "studentName",
              st.matricula,
              n.severity,
              n.title,
              n.description,
              n.occurred_at AS "occurredAt",
              n.created_at AS "createdAt",
              cu.full_name AS "createdByName"
       FROM student_attention_notes n
       INNER JOIN students st ON st.id = n.student_id
       INNER JOIN users su ON su.id = st.user_id
       INNER JOIN users cu ON cu.id = n.created_by_user_id
       WHERE st.group_id = $1
       ORDER BY n.occurred_at DESC, n.created_at DESC`,
      [groupId]
    );
  }

  async listMyChildren(parentUserId: string, studentId?: string) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    const children = await this.dataSource.query<{ student_id: string }[]>(
      `SELECT sp.student_id
       FROM student_parents sp
       WHERE sp.parent_id = $1`,
      [parent.id]
    );
    const studentIds = children.map((x) => x.student_id);
    if (studentIds.length === 0) return [];
    if (studentId && !studentIds.includes(studentId)) {
      throw new ForbiddenException('No tienes relación con este estudiante');
    }
    const filterIds = studentId ? [studentId] : studentIds;

    return this.dataSource.query<
      {
        id: string;
        studentId: string;
        studentName: string;
        severity: AttentionSeverity;
        title: string;
        description: string;
        occurredAt: string;
        createdAt: string;
        createdByName: string;
      }[]
    >(
      `SELECT n.id,
              n.student_id AS "studentId",
              su.full_name AS "studentName",
              n.severity,
              n.title,
              n.description,
              n.occurred_at AS "occurredAt",
              n.created_at AS "createdAt",
              cu.full_name AS "createdByName"
       FROM student_attention_notes n
       JOIN students s ON s.id = n.student_id
       JOIN users su ON su.id = s.user_id
       JOIN users cu ON cu.id = n.created_by_user_id
       WHERE n.student_id = ANY($1::uuid[])
       ORDER BY n.occurred_at DESC, n.created_at DESC`,
      [filterIds]
    );
  }

  private async assertAdministrativeCanAccessGroup(userId: string, groupId: string): Promise<void> {
    const rows = await this.dataSource.query<{ ok: boolean }[]>(
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

  private async assertCanCreateForStudent(userId: string, role: UserRole, student: StudentEntity) {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      if (!student.groupId) throw new ForbiddenException('El estudiante no tiene grupo asignado');
      await this.assertAdministrativeCanAccessGroup(userId, student.groupId);
      return;
    }

    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('Solo personal autorizado puede registrar anotaciones');
    }
    if (!student.groupId) throw new ForbiddenException('El estudiante no tiene grupo asignado');
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    if (teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
      throw new ForbiddenException('El docente no está activo para crear anotaciones');
    }
    const rows = await this.dataSource.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM teacher_groups WHERE teacher_id = $1 AND group_id = $2
      ) AS ok`,
      [teacher.id, student.groupId]
    );
    if (!rows[0]?.ok) {
      throw new ForbiddenException('No tienes asignación en el grupo del estudiante');
    }
  }

  private async notifyParents(note: StudentAttentionNoteEntity, studentId: string) {
    const rows = await this.dataSource.query<{ user_id: string }[]>(
      `SELECT u.id AS user_id
       FROM student_parents sp
       JOIN parents p ON p.id = sp.parent_id
       JOIN users u ON u.id = p.user_id
       WHERE sp.student_id = $1`,
      [studentId]
    );
    const userIds = [...new Set(rows.map((x) => x.user_id))];
    if (userIds.length === 0) {
      await this.notesRepository.update({ id: note.id }, { notifiedParent: false });
      return;
    }

    const nameRows = await this.dataSource.query<{ full_name: string | null }[]>(
      `SELECT u.full_name
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [studentId]
    );
    const studentName = (nameRows[0]?.full_name ?? 'Su hijo/a').trim() || 'Su hijo/a';

    const sev = note.severity.toLowerCase();
    const notifications = userIds.map((uid) =>
      this.notificationsRepository.create({
        userId: uid,
        noticeId: null,
        title: `Anotación sobre ${studentName} (${sev})`,
        message: `${note.title}\n\n${note.description}`,
        deliveryStatus: 'SENT'
      })
    );
    const savedNotifications = await this.notificationsRepository.save(notifications);
    void this.fcmService.sendPushForNotifications(savedNotifications).catch(() => undefined);
    await this.notesRepository.update({ id: note.id }, { notifiedParent: true });
  }
}


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
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserRole } from '../../database/entities/user.entity';
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
    private readonly dataSource: DataSource
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

  async listByGroupForTeacher(userId: string, groupId: string) {
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');

    const ok = await this.dataSource.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM teacher_groups WHERE teacher_id = $1 AND group_id = $2
      ) AS ok`,
      [teacher.id, groupId]
    );
    if (!ok[0]?.ok) {
      throw new ForbiddenException('No tienes asignación en este grupo');
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

  private async assertCanCreateForStudent(userId: string, role: UserRole, student: StudentEntity) {
    if (role === UserRole.ADMIN || role === UserRole.ADMINISTRATIVO) return;

    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('Solo personal autorizado puede registrar anotaciones');
    }
    if (!student.groupId) throw new ForbiddenException('El estudiante no tiene grupo asignado');
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
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
    await this.notificationsRepository.save(notifications);
    await this.notesRepository.update({ id: note.id }, { notifiedParent: true });
  }
}


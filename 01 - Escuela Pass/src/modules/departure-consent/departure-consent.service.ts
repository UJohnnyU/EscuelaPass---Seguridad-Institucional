import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  ConsentType,
  StudentDepartureConsentEntity
} from '../../database/entities/student-departure-consent.entity';
import {
  CircuitRequestEntity,
  CircuitStatus
} from '../../database/entities/circuit-request.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';

@Injectable()
export class DepartureConsentService {
  private static readonly OPEN_ENDED_DATE = '9999-12-31';

  constructor(
    @InjectRepository(StudentDepartureConsentEntity)
    private readonly consentRepository: Repository<StudentDepartureConsentEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupsRepository: Repository<GroupEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(CircuitRequestEntity)
    private readonly circuitRepository: Repository<CircuitRequestEntity>
  ) {}

  private todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /** Indica si el estudiante tiene consentimiento de salida autónoma (SALIDA_SOLO) vigente en la fecha. */
  async hasAutonomousConsentOnDate(studentId: string, dateStr: string): Promise<boolean> {
    const d = dateStr.slice(0, 10);
    const n = await this.consentRepository
      .createQueryBuilder('c')
      .where('c.studentId = :sid', { sid: studentId })
      .andWhere('c.consentType = :ct', { ct: ConsentType.SALIDA_SOLO })
      .andWhere('c.validFrom <= :d AND c.validUntil >= :d', { d })
      .getCount();
    return n > 0;
  }

  async listTodayForParent(parentUserId: string): Promise<
    Array<{ studentId: string; autonomousToday: boolean }>
  > {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');
    const rows = await this.consentRepository.manager.query<{ student_id: string }[]>(
      `SELECT s.id AS student_id
       FROM student_parents sp
       INNER JOIN students s ON s.id = sp.student_id
       WHERE sp.parent_id = $1`,
      [parent.id]
    );
    const today = this.todayStr();
    const out: Array<{ studentId: string; autonomousToday: boolean }> = [];
    for (const r of rows) {
      const autonomousToday = await this.hasAutonomousConsentOnDate(r.student_id, today);
      out.push({ studentId: r.student_id, autonomousToday });
    }
    return out;
  }

  /**
   * Para perfil alumno: muestra si hoy puede salir solo por consentimiento registral.
   */
  async listAutonomousForGroup(
    userId: string,
    role: UserRole,
    groupId: string,
    dateStr?: string
  ): Promise<Array<{ studentId: string; autonomous: boolean }>> {
    const g = await this.groupsRepository.findOne({ where: { id: groupId } });
    if (!g) throw new ForbiddenException('Grupo no encontrado');

    if (role === UserRole.ADMINISTRATIVO) {
      const u = await this.usersRepository.findOne({ where: { id: userId }, select: ['schoolId'] });
      if (!u?.schoolId || u.schoolId !== g.schoolId) throw new ForbiddenException('Sin acceso a este grupo');
    } else if (role === UserRole.DOCENTE) {
      const ok = await this.consentRepository.manager.query<{ ok: boolean }[]>(
        `SELECT EXISTS (
          SELECT 1 FROM teachers t
          INNER JOIN teacher_groups tg ON tg.teacher_id = t.id AND tg.group_id = $2
          WHERE t.user_id = $1
        ) AS ok`,
        [userId, groupId]
      );
      if (!ok[0]?.ok) throw new ForbiddenException('No tiene asignación en este grupo');
    }

    const d = (dateStr ?? this.todayStr()).slice(0, 10);
    const students = await this.consentRepository.manager.query<{ id: string }[]>(
      `SELECT id FROM students WHERE group_id = $1 ORDER BY id`,
      [groupId]
    );
    const out: Array<{ studentId: string; autonomous: boolean }> = [];
    for (const s of students) {
      const autonomous = await this.hasAutonomousConsentOnDate(s.id, d);
      out.push({ studentId: s.id, autonomous });
    }
    return out;
  }

  async statusForStudentUser(studentUserId: string): Promise<{ autonomousToday: boolean }> {
    const rows = await this.consentRepository.manager.query<{ id: string }[]>(
      `SELECT id FROM students WHERE user_id = $1 LIMIT 1`,
      [studentUserId]
    );
    const sid = rows[0]?.id;
    if (!sid) return { autonomousToday: false };
    return { autonomousToday: await this.hasAutonomousConsentOnDate(sid, this.todayStr()) };
  }

  async setAutonomousForParent(
    parentUserId: string,
    studentId: string,
    dateStr: string,
    active: boolean
  ): Promise<{ ok: true; date: string; autonomous: boolean }> {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    const link = await this.consentRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM student_parents WHERE parent_id = $1 AND student_id = $2
      ) AS ok`,
      [parent.id, studentId]
    );
    if (!link[0]?.ok) {
      throw new ForbiddenException('No está vinculado a este estudiante');
    }

    const d = dateStr.slice(0, 10);

    await this.consentRepository.manager.transaction(async (em) => {
      const repo = em.getRepository(StudentDepartureConsentEntity);

      if (active) {
        // Garantiza un único consentimiento vigente "hasta desmarcar".
        await repo
          .createQueryBuilder()
          .delete()
          .where('student_id = :sid', { sid: studentId })
          .andWhere('parent_id = :pid', { pid: parent.id })
          .andWhere('consent_type = :ct', { ct: ConsentType.SALIDA_SOLO })
          .execute();

        await repo.save(
          repo.create({
            studentId,
            parentId: parent.id,
            consentType: ConsentType.SALIDA_SOLO,
            validFrom: d,
            validUntil: DepartureConsentService.OPEN_ENDED_DATE
          })
        );
        await this.cancelOpenCircuitsForStudentOnDate(em, studentId, d);
      } else {
        // Al desmarcar, elimina consentimientos vigentes desde hoy en adelante.
        await repo
          .createQueryBuilder()
          .delete()
          .where('student_id = :sid', { sid: studentId })
          .andWhere('parent_id = :pid', { pid: parent.id })
          .andWhere('consent_type = :ct', { ct: ConsentType.SALIDA_SOLO })
          .andWhere('valid_until >= :d', { d })
          .execute();
      }
    });

    return { ok: true, date: d, autonomous: active };
  }

  private async cancelOpenCircuitsForStudentOnDate(
    em: EntityManager,
    studentId: string,
    dateStr: string
  ): Promise<void> {
    const repo = em.getRepository(CircuitRequestEntity);
    const terminal: CircuitStatus[] = [
      CircuitStatus.ENTREGADO,
      CircuitStatus.CANCELADO,
      CircuitStatus.CERRADO_SIN_CONFIRMACION_PADRE
    ];
    await repo
      .createQueryBuilder()
      .update(CircuitRequestEntity)
      .set({ status: CircuitStatus.CANCELADO })
      .where('student_id = :sid', { sid: studentId })
      .andWhere('DATE(request_time) = :d', { d: dateStr })
      .andWhere('status NOT IN (:...t)', { t: terminal })
      .execute();
  }
}

import { ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserRole } from '../../database/entities/user.entity';

export type PrivateFileBucket = 'avatars' | 'comprobantes' | 'excuses' | 'reports';

@Injectable()
export class FilesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async assertCanRead(
    userId: string,
    role: UserRole,
    bucket: PrivateFileBucket,
    filename: string
  ): Promise<void> {
    if (bucket === 'avatars') {
      await this.assertCanReadAvatar(userId, role, filename);
      return;
    }
    if (bucket === 'comprobantes') {
      await this.assertCanReadComprobante(userId, role, filename);
      return;
    }
    if (bucket === 'excuses') {
      await this.assertCanReadExcuse(userId, role, filename);
      return;
    }
    await this.assertCanReadReportEvidence(userId, role, filename);
  }

  private async assertCanReadAvatar(userId: string, role: UserRole, filename: string): Promise<void> {
    const filePath = `/uploads/avatars/${filename}`;
    const rows = await this.dataSource.query<
      Array<{ ownerUserId: string | null; ownerSchoolId: string | null }>
    >(
      `SELECT u.id AS "ownerUserId", u.school_id AS "ownerSchoolId"
       FROM users u
       WHERE u.avatar_path = $1
       LIMIT 1`,
      [filePath]
    );
    const row = rows[0];
    if (!row?.ownerUserId) {
      throw new ForbiddenException('No autorizado para acceder a este archivo.');
    }
    if (row.ownerUserId === userId) return;
    if (role === UserRole.ALUMNO) {
      throw new ForbiddenException('No autorizado para acceder a este archivo.');
    }
    if (role === UserRole.ADMIN) return;

    if (role === UserRole.ADMINISTRATIVO || role === UserRole.DOCENTE) {
      const sameSchool = await this.userSharesSchoolWithOwner(userId, row.ownerUserId);
      if (sameSchool) return;
      throw new ForbiddenException('No autorizado para acceder a este archivo.');
    }

    if (role === UserRole.PADRE) {
      const isMyChild = await this.dataSource.query<Array<{ ok: boolean }>>(
        `SELECT EXISTS (
           SELECT 1
           FROM parents p
           JOIN student_parents sp ON sp.parent_id = p.id
           JOIN students st ON st.id = sp.student_id
           WHERE p.user_id = $1
             AND st.user_id = $2
         ) AS ok`,
        [userId, row.ownerUserId]
      );
      if (isMyChild[0]?.ok) return;
    }

    throw new ForbiddenException('No autorizado para acceder a este archivo.');
  }

  private async assertCanReadComprobante(userId: string, role: UserRole, filename: string): Promise<void> {
    const filePath = `/uploads/comprobantes/${filename}`;
    const rows = await this.dataSource.query<
      Array<{ debtId: string; studentId: string; schoolId: string | null }>
    >(
      `SELECT d.id AS "debtId", d.student_id AS "studentId", st.school_id AS "schoolId"
       FROM debts d
       JOIN students st ON st.id = d.student_id
       WHERE d.voucher_path = $1
       LIMIT 1`,
      [filePath]
    );
    const row = rows[0];
    if (!row?.debtId) {
      throw new ForbiddenException('No autorizado para acceder a este archivo.');
    }
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      const sameSchool = await this.dataSource.query<Array<{ ok: boolean }>>(
        `SELECT EXISTS (
           SELECT 1 FROM users u
           WHERE u.id = $1
             AND u.school_id IS NOT NULL
             AND u.school_id = $2
         ) AS ok`,
        [userId, row.schoolId]
      );
      if (sameSchool[0]?.ok) return;
      throw new ForbiddenException('No autorizado para acceder a este archivo.');
    }
    if (role === UserRole.PADRE) {
      const isOwnerParent = await this.dataSource.query<Array<{ ok: boolean }>>(
        `SELECT EXISTS (
           SELECT 1
           FROM parents p
           JOIN student_parents sp ON sp.parent_id = p.id
           WHERE p.user_id = $1
             AND sp.student_id = $2
         ) AS ok`,
        [userId, row.studentId]
      );
      if (isOwnerParent[0]?.ok) return;
    }
    throw new ForbiddenException('No autorizado para acceder a este archivo.');
  }

  private async assertCanReadExcuse(userId: string, role: UserRole, filename: string): Promise<void> {
    const filePath = `/uploads/excuses/${filename}`;
    const regular = await this.dataSource.query<
      Array<{ studentId: string; groupId: string | null; schoolId: string | null }>
    >(
      `SELECT a.student_id AS "studentId", a.group_id AS "groupId", st.school_id AS "schoolId"
       FROM attendance_records a
       JOIN students st ON st.id = a.student_id
       WHERE a.excuse_attachment_path = $1
       LIMIT 1`,
      [filePath]
    );
    const classBased = await this.dataSource.query<
      Array<{ studentId: string; classSessionId: string; schoolId: string | null }>
    >(
      `SELECT car.student_id AS "studentId", car.class_session_id AS "classSessionId", st.school_id AS "schoolId"
       FROM class_attendance_records car
       JOIN students st ON st.id = car.student_id
       WHERE car.excuse_attachment_path = $1
       LIMIT 1`,
      [filePath]
    );

    const regularHit = regular[0];
    const classHit = classBased[0];
    const studentId = regularHit?.studentId ?? classHit?.studentId ?? null;
    const schoolId = regularHit?.schoolId ?? classHit?.schoolId ?? null;
    if (!studentId) {
      throw new ForbiddenException('No autorizado para acceder a este archivo.');
    }

    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ALUMNO) {
      const isOwner = await this.dataSource.query<Array<{ ok: boolean }>>(
        `SELECT EXISTS (
           SELECT 1
           FROM students st
           WHERE st.id = $1
             AND st.user_id = $2
         ) AS ok`,
        [studentId, userId]
      );
      if (isOwner[0]?.ok) return;
      throw new ForbiddenException('No autorizado para acceder a este archivo.');
    }
    if (role === UserRole.ADMINISTRATIVO) {
      const sameSchool = await this.dataSource.query<Array<{ ok: boolean }>>(
        `SELECT EXISTS (
           SELECT 1 FROM users u
           WHERE u.id = $1
             AND u.school_id IS NOT NULL
             AND u.school_id = $2
         ) AS ok`,
        [userId, schoolId]
      );
      if (sameSchool[0]?.ok) return;
      throw new ForbiddenException('No autorizado para acceder a este archivo.');
    }
    if (role === UserRole.PADRE) {
      const ownsStudent = await this.dataSource.query<Array<{ ok: boolean }>>(
        `SELECT EXISTS (
           SELECT 1
           FROM parents p
           JOIN student_parents sp ON sp.parent_id = p.id
           WHERE p.user_id = $1
             AND sp.student_id = $2
         ) AS ok`,
        [userId, studentId]
      );
      if (ownsStudent[0]?.ok) return;
      throw new ForbiddenException('No autorizado para acceder a este archivo.');
    }
    if (role === UserRole.DOCENTE) {
      if (classHit?.classSessionId) {
        const teachesClass = await this.dataSource.query<Array<{ ok: boolean }>>(
          `SELECT EXISTS (
             SELECT 1
             FROM teachers t
             JOIN class_sessions cs ON cs.teacher_id = t.id
             WHERE t.user_id = $1
               AND cs.id = $2
           ) AS ok`,
          [userId, classHit.classSessionId]
        );
        if (teachesClass[0]?.ok) return;
      }
      if (regularHit?.groupId) {
        const teachesGroup = await this.dataSource.query<Array<{ ok: boolean }>>(
          `SELECT EXISTS (
             SELECT 1
             FROM teachers t
             JOIN teacher_groups tg ON tg.teacher_id = t.id
             WHERE t.user_id = $1
               AND tg.group_id = $2
           ) AS ok`,
          [userId, regularHit.groupId]
        );
        if (teachesGroup[0]?.ok) return;
      }
    }

    throw new ForbiddenException('No autorizado para acceder a este archivo.');
  }

  private async assertCanReadReportEvidence(userId: string, role: UserRole, filename: string): Promise<void> {
    const adminOrStaff = role === UserRole.ADMIN || role === UserRole.ADMINISTRATIVO;
    const filePath = `/uploads/reports/${filename}`;
    const legacyPath = `/uploads/report-evidence/${filename}`;
    try {
      const rows = await this.dataSource.query<Array<{ schoolId: string; createdByUserId: string }>>(
        `SELECT ar.school_id AS "schoolId", ar.created_by_user_id AS "createdByUserId"
         FROM admin_reports ar
         WHERE ar.message LIKE $1 OR ar.message LIKE $2
         ORDER BY ar.created_at DESC
         LIMIT 1`,
        [`%${filePath}%`, `%${legacyPath}%`]
      );
      const row = rows[0];
      if (!row) {
        if (adminOrStaff) return;
        throw new ForbiddenException('No autorizado para acceder a este archivo.');
      }
      if (role === UserRole.ADMIN) return;
      if (role === UserRole.ADMINISTRATIVO) {
        const sameSchool = await this.dataSource.query<Array<{ ok: boolean }>>(
          `SELECT EXISTS (
             SELECT 1 FROM users u
             WHERE u.id = $1
               AND u.school_id IS NOT NULL
               AND u.school_id = $2
           ) AS ok`,
          [userId, row.schoolId]
        );
        if (sameSchool[0]?.ok) return;
      }
      if (row.createdByUserId === userId) return;
      throw new ForbiddenException('No autorizado para acceder a este archivo.');
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      if (adminOrStaff) return;
      throw new ForbiddenException('No autorizado para acceder a este archivo.');
    }
  }

  private async userSharesSchoolWithOwner(userId: string, ownerUserId: string): Promise<boolean> {
    const rows = await this.dataSource.query<Array<{ ok: boolean }>>(
      `SELECT EXISTS (
         SELECT 1
         FROM users actor
         JOIN users owner ON owner.id = $2
         WHERE actor.id = $1
           AND actor.school_id IS NOT NULL
           AND actor.school_id = owner.school_id
       ) AS ok`,
      [userId, ownerUserId]
    );
    return !!rows[0]?.ok;
  }
}

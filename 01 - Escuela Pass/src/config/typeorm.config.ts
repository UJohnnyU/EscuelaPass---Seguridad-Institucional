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

/**
 * Construye la configuración TypeORM para Nest (`forRootAsync`) y para el CLI (`typeorm.datasource.ts`).
 * Entidades enumeradas explícitamente; migraciones: `dist/database/migrations/*.js` en runtime compilado.
 */
import { join } from 'path';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AcademicPeriodEntity } from '../database/entities/academic-period.entity';
import { AdminReportCommentEntity } from '../database/entities/admin-report-comment.entity';
import { AdminReportEntity } from '../database/entities/admin-report.entity';
import { ActivityEntity } from '../database/entities/activity.entity';
import { ActivityGradeEntity } from '../database/entities/activity-grade.entity';
import { AttendanceRecordEntity } from '../database/entities/attendance-record.entity';
import { AccessCredentialEntity } from '../database/entities/access-credential.entity';
import { AccessEventEntity } from '../database/entities/access-event.entity';
import { AdministrativeStaffEntity } from '../database/entities/administrative-staff.entity';
import { CircuitRequestEntity } from '../database/entities/circuit-request.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { ClassSessionEntity } from '../database/entities/class-session.entity';
import { ClassAttendanceRecordEntity } from '../database/entities/class-attendance-record.entity';
import { ClassScheduleSlotEntity } from '../database/entities/class-schedule-slot.entity';
import { ImportJobEntity } from '../database/entities/import-job.entity';
import { MeetingEntity } from '../database/entities/meeting.entity';
import { MeetingParticipantEntity } from '../database/entities/meeting-participant.entity';
import { NoticeEntity } from '../database/entities/notice.entity';
import { NotificationEntity } from '../database/entities/notification.entity';
import { DebtEntity } from '../database/entities/debt.entity';
import { DebtAdjustmentEntity } from '../database/entities/debt-adjustment.entity';
import { ReportCardEntity } from '../database/entities/report-card.entity';
import { ReportCardSubjectEntity } from '../database/entities/report-card-subject.entity';
import { SubjectEntity } from '../database/entities/subject.entity';
import { TeacherGroupEntity } from '../database/entities/teacher-group.entity';
import { TeacherLifecycleEventEntity } from '../database/entities/teacher-lifecycle-event.entity';
import { TeacherSubjectEntity } from '../database/entities/teacher-subject.entity';
import { PaymentConceptEntity } from '../database/entities/payment-concept.entity';
import { PaymentRecordEntity } from '../database/entities/payment-record.entity';
import { ParentEntity } from '../database/entities/parent.entity';
import { RefreshTokenEntity } from '../database/entities/refresh-token.entity';
import { InstitutionSettingEntity } from '../database/entities/institution-setting.entity';
import { SchoolNonInstructionalDayEntity } from '../database/entities/school-non-instructional-day.entity';
import { StudentDepartureConsentEntity } from '../database/entities/student-departure-consent.entity';
import { StudentAttentionNoteEntity } from '../database/entities/student-attention-note.entity';
import { StudentLifecycleEventEntity } from '../database/entities/student-lifecycle-event.entity';
import { StudentParentEntity } from '../database/entities/student-parent.entity';
import { StudentEntity } from '../database/entities/student.entity';
import { TeacherEntity } from '../database/entities/teacher.entity';
import { UserEntity } from '../database/entities/user.entity';
import { UserFcmTokenEntity } from '../database/entities/user-fcm-token.entity';
import { VehicleEntity } from '../database/entities/vehicle.entity';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { PrivacyPolicyEntity } from '../database/entities/privacy-policy.entity';
import { UserPrivacyAcceptanceEntity } from '../database/entities/user-privacy-acceptance.entity';
import { SchoolEntity } from '../database/entities/school.entity';
import { ExternalVisitEntity } from '../database/entities/external-visit.entity';
import { ExternalVisitGroupEntity } from '../database/entities/external-visit-group.entity';
import { ExternalVisitStudentEntity } from '../database/entities/external-visit-student.entity';

function directPostgresUrl(): string | undefined {
  const u = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!u) return undefined;
  if (u.startsWith('postgres://') || u.startsWith('postgresql://')) {
    return u;
  }
  throw new Error('DATABASE_URL invalida: para Nest/TypeORM define una URL postgres:// o postgresql:// directa.');
}

export function buildTypeOrmConfig(): TypeOrmModuleOptions {
  const entities = [
      UserEntity,
      StudentEntity,
      StudentLifecycleEventEntity,
      StudentParentEntity,
      TeacherEntity,
      TeacherLifecycleEventEntity,
      ParentEntity,
      AdministrativeStaffEntity,
      AccessCredentialEntity,
      AccessEventEntity,
      RefreshTokenEntity,
      StudentDepartureConsentEntity,
      StudentAttentionNoteEntity,
      CircuitRequestEntity,
      GroupEntity,
      NoticeEntity,
      NotificationEntity,
      PaymentConceptEntity,
      DebtEntity,
      DebtAdjustmentEntity,
      PaymentRecordEntity,
      AttendanceRecordEntity,
      ClassAttendanceRecordEntity,
      AcademicPeriodEntity,
      ActivityEntity,
      AdminReportCommentEntity,
      AdminReportEntity,
      ActivityGradeEntity,
      ReportCardEntity,
      ReportCardSubjectEntity,
      SubjectEntity,
      TeacherGroupEntity,
      TeacherSubjectEntity,
      ImportJobEntity,
      MeetingEntity,
      MeetingParticipantEntity,
      ClassScheduleSlotEntity,
      ClassSessionEntity,
      UserFcmTokenEntity,
      SchoolNonInstructionalDayEntity,
      InstitutionSettingEntity,
      ExternalVisitEntity,
      ExternalVisitGroupEntity,
      ExternalVisitStudentEntity,
      VehicleEntity,
      AuditLogEntity,
      PrivacyPolicyEntity,
      UserPrivacyAcceptanceEntity,
      SchoolEntity
  ];

  const url = directPostgresUrl();
  const migrationPaths = [join(__dirname, '..', 'database', 'migrations', '*.js')];
  if (url) {
    const needsSsl =
      url.includes('sslmode=require') ||
      process.env.DB_SSL === 'true' ||
      /\.railway\.app|\.rlwy\.net|supabase\.co|render\.com/i.test(url);
    return {
      type: 'postgres',
      url,
      ssl: needsSsl ? { rejectUnauthorized: false } : false,
      synchronize: false,
      logging: false,
      entities,
      migrations: migrationPaths,
      migrationsTableName: 'typeorm_migrations'
    };
  }

  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: (process.env.DB_SSL ?? 'false') === 'true' ? { rejectUnauthorized: false } : false,
    synchronize: false,
    logging: false,
    entities,
    migrations: migrationPaths,
    migrationsTableName: 'typeorm_migrations'
  };
}


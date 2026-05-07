/**
 * Construye la configuración TypeORM para Nest (`forRootAsync`) y para el CLI (`typeorm.datasource.ts`).
 * Entidades enumeradas explícitamente; migraciones: `dist/database/migrations/*.js` en runtime compilado.
 */
import { join } from 'path';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AcademicPeriodEntity } from '../database/entities/academic-period.entity';
import { ActivityEntity } from '../database/entities/activity.entity';
import { ActivityGradeEntity } from '../database/entities/activity-grade.entity';
import { AttendanceRecordEntity } from '../database/entities/attendance-record.entity';
import { AccessCredentialEntity } from '../database/entities/access-credential.entity';
import { AccessEventEntity } from '../database/entities/access-event.entity';
import { AdministrativeStaffEntity } from '../database/entities/administrative-staff.entity';
import { CircuitRequestEntity } from '../database/entities/circuit-request.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { ClassSessionEntity } from '../database/entities/class-session.entity';
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
      AcademicPeriodEntity,
      ActivityEntity,
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


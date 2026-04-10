import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AttendanceRecordEntity } from '../database/entities/attendance-record.entity';
import { AccessCredentialEntity } from '../database/entities/access-credential.entity';
import { AccessEventEntity } from '../database/entities/access-event.entity';
import { AdministrativeStaffEntity } from '../database/entities/administrative-staff.entity';
import { CircuitRequestEntity } from '../database/entities/circuit-request.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { ClassScheduleSlotEntity } from '../database/entities/class-schedule-slot.entity';
import { ImportJobEntity } from '../database/entities/import-job.entity';
import { ParentTeacherMeetingEntity } from '../database/entities/parent-teacher-meeting.entity';
import { NoticeEntity } from '../database/entities/notice.entity';
import { NotificationEntity } from '../database/entities/notification.entity';
import { DebtEntity } from '../database/entities/debt.entity';
import { GradeEntity } from '../database/entities/grade.entity';
import { SubjectEntity } from '../database/entities/subject.entity';
import { TeacherGroupEntity } from '../database/entities/teacher-group.entity';
import { PaymentConceptEntity } from '../database/entities/payment-concept.entity';
import { PaymentRecordEntity } from '../database/entities/payment-record.entity';
import { ParentEntity } from '../database/entities/parent.entity';
import { PickupAuthorizationEntity } from '../database/entities/pickup-authorization.entity';
import { RefreshTokenEntity } from '../database/entities/refresh-token.entity';
import { InstitutionSettingEntity } from '../database/entities/institution-setting.entity';
import { SchoolNonInstructionalDayEntity } from '../database/entities/school-non-instructional-day.entity';
import { StudentDepartureConsentEntity } from '../database/entities/student-departure-consent.entity';
import { StudentEntity } from '../database/entities/student.entity';
import { TeacherEntity } from '../database/entities/teacher.entity';
import { UserEntity } from '../database/entities/user.entity';
import { UserFcmTokenEntity } from '../database/entities/user-fcm-token.entity';
import { VisitRequestEntity } from '../database/entities/visit-request.entity';
import { VehicleEntity } from '../database/entities/vehicle.entity';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { PrivacyPolicyEntity } from '../database/entities/privacy-policy.entity';
import { UserPrivacyAcceptanceEntity } from '../database/entities/user-privacy-acceptance.entity';

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
      TeacherEntity,
      ParentEntity,
      AdministrativeStaffEntity,
      AccessCredentialEntity,
      AccessEventEntity,
      PickupAuthorizationEntity,
      RefreshTokenEntity,
      StudentDepartureConsentEntity,
      CircuitRequestEntity,
      GroupEntity,
      NoticeEntity,
      NotificationEntity,
      PaymentConceptEntity,
      DebtEntity,
      PaymentRecordEntity,
      AttendanceRecordEntity,
      GradeEntity,
      SubjectEntity,
      TeacherGroupEntity,
      ImportJobEntity,
      VisitRequestEntity,
      ParentTeacherMeetingEntity,
      ClassScheduleSlotEntity,
      UserFcmTokenEntity,
      SchoolNonInstructionalDayEntity,
      InstitutionSettingEntity,
      VehicleEntity,
      AuditLogEntity,
      PrivacyPolicyEntity,
      UserPrivacyAcceptanceEntity
  ];

  const url = directPostgresUrl();
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
      entities
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
    entities
  };
}


import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './config/env.validation';
import { buildTypeOrmConfig } from './config/typeorm.config';
import { AcademicPeriodsModule } from './modules/academic-periods/academic-periods.module';
import { AcademicSchedulerModule } from './modules/academic-scheduler/academic-scheduler.module';
import { AccessModule } from './modules/access/access.module';
import { AuthModule } from './modules/auth/auth.module';
import { CircuitModule } from './modules/circuit/circuit.module';
import { NoticesModule } from './modules/notices/notices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { HealthModule } from './modules/health/health.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { ReportCardsModule } from './modules/report-cards/report-cards.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SchoolModule } from './modules/school/school.module';
import { ExportsModule } from './modules/exports/exports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { VisitsModule } from './modules/visits/visits.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { SchoolCalendarModule } from './modules/school-calendar/school-calendar.module';
import { SettingsModule } from './modules/settings/settings.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AuditModule } from './modules/audit/audit.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { AttentionNotesModule } from './modules/attention-notes/attention-notes.module';
import { SchoolsModule } from './modules/schools/schools.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      validate: validateEnv
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => buildTypeOrmConfig()
    }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
        limit: Number(process.env.THROTTLE_LIMIT ?? 100)
      }
    ]),
    ScheduleModule.forRoot(),
    HealthModule,
    AuthModule,
    AccessModule,
    CircuitModule,
    NoticesModule,
    PaymentsModule,
    AttendanceModule,
    ActivitiesModule,
    AcademicPeriodsModule,
    ReportCardsModule,
    AcademicSchedulerModule,
    ReportsModule,
    SchoolModule,
    ExportsModule,
    DashboardModule,
    VisitsModule,
    MeetingsModule,
    SchedulesModule,
    SchoolCalendarModule,
    SettingsModule,
    VehiclesModule,
    DocumentsModule,
    AuditModule,
    PrivacyModule,
    AttentionNotesModule,
    SchoolsModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}

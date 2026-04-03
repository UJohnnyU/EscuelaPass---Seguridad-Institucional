import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './config/env.validation';
import { buildTypeOrmConfig } from './config/typeorm.config';
import { AccessModule } from './modules/access/access.module';
import { AuthModule } from './modules/auth/auth.module';
import { CircuitModule } from './modules/circuit/circuit.module';
import { NoticesModule } from './modules/notices/notices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { HealthModule } from './modules/health/health.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { GradesModule } from './modules/grades/grades.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SchoolModule } from './modules/school/school.module';
import { ExportsModule } from './modules/exports/exports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { VisitsModule } from './modules/visits/visits.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { SchoolCalendarModule } from './modules/school-calendar/school-calendar.module';

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
    HealthModule,
    AuthModule,
    AccessModule,
    CircuitModule,
    NoticesModule,
    PaymentsModule,
    AttendanceModule,
    GradesModule,
    ReportsModule,
    SchoolModule,
    ExportsModule,
    DashboardModule,
    VisitsModule,
    MeetingsModule,
    SchedulesModule,
    SchoolCalendarModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}


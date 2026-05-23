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
 * Módulo raíz: configuración global (entorno, TypeORM, rate limit, tareas programadas) y registro
 * de todos los bounded contexts de la API Escuela Pass.
 */
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
import { ClassAttendanceModule } from './modules/class-attendance/class-attendance.module';
import { ClassSessionsModule } from './modules/class-sessions/class-sessions.module';
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
import { SchedulesModule } from './modules/schedules/schedules.module';
import { SchoolCalendarModule } from './modules/school-calendar/school-calendar.module';
import { SettingsModule } from './modules/settings/settings.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AuditModule } from './modules/audit/audit.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { DepartureConsentModule } from './modules/departure-consent/departure-consent.module';
import { EventSchedulerModule } from './modules/event-scheduler/event-scheduler.module';
import { ExternalVisitsModule } from './modules/external-visits/external-visits.module';
import { AttentionNotesModule } from './modules/attention-notes/attention-notes.module';
import { MailModule } from './modules/mail/mail.module';
import { FilesModule } from './modules/files/files.module';

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
    MailModule,
    AuthModule,
    AccessModule,
    CircuitModule,
    ClassAttendanceModule,
    ClassSessionsModule,
    NoticesModule,
    PaymentsModule,
    AttendanceModule,
    ActivitiesModule,
    AttentionNotesModule,
    AcademicPeriodsModule,
    ReportCardsModule,
    AcademicSchedulerModule,
    ReportsModule,
    SchoolModule,
    ExportsModule,
    DashboardModule,
    SchedulesModule,
    SchoolCalendarModule,
    SettingsModule,
    VehiclesModule,
    DocumentsModule,
    AuditModule,
    PrivacyModule,
    SchoolsModule,
    UploadsModule,
    FilesModule,
    DepartureConsentModule,
    EventSchedulerModule,
    ExternalVisitsModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}

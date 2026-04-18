import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalVisitEntity } from '../../database/entities/external-visit.entity';
import { ExternalVisitGroupEntity } from '../../database/entities/external-visit-group.entity';
import { ExternalVisitStudentEntity } from '../../database/entities/external-visit-student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { EventsCoreModule } from '../events-core/events-core.module';
import { ExternalVisitsController } from './external-visits.controller';
import { ExternalVisitsService } from './external-visits.service';

@Module({
  imports: [
    AuthModule,
    EventsCoreModule,
    TypeOrmModule.forFeature([
      ExternalVisitEntity,
      ExternalVisitGroupEntity,
      ExternalVisitStudentEntity,
      UserEntity,
      TeacherEntity
    ])
  ],
  controllers: [ExternalVisitsController],
  providers: [ExternalVisitsService],
  exports: [ExternalVisitsService]
})
export class ExternalVisitsModule {}

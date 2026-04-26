import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicPeriodEntity } from '../../database/entities/academic-period.entity';
import { ClassSessionEntity } from '../../database/entities/class-session.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { SubjectEntity } from '../../database/entities/subject.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { ClassSessionsController } from './class-sessions.controller';
import { ClassSessionsService } from './class-sessions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClassSessionEntity,
      AcademicPeriodEntity,
      GroupEntity,
      SubjectEntity,
      TeacherEntity,
      UserEntity
    ])
  ],
  controllers: [ClassSessionsController],
  providers: [ClassSessionsService]
})
export class ClassSessionsModule {}

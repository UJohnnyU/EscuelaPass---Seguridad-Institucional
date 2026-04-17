import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityEntity } from '../../database/entities/activity.entity';
import { ActivityGradeEntity } from '../../database/entities/activity-grade.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { AuthModule } from '../auth/auth.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      ActivityEntity,
      ActivityGradeEntity,
      StudentEntity,
      TeacherEntity,
      ParentEntity
    ])
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService]
})
export class ActivitiesModule {}

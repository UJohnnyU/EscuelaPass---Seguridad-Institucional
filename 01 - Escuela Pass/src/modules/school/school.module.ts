import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupEntity } from '../../database/entities/group.entity';
import { ImportJobEntity } from '../../database/entities/import-job.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentParentEntity } from '../../database/entities/student-parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { StudentLifecycleEventEntity } from '../../database/entities/student-lifecycle-event.entity';
import { SubjectEntity } from '../../database/entities/subject.entity';
import { SchoolEntity } from '../../database/entities/school.entity';
import { TeacherGroupEntity } from '../../database/entities/teacher-group.entity';
import { TeacherSubjectEntity } from '../../database/entities/teacher-subject.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { TeacherLifecycleEventEntity } from '../../database/entities/teacher-lifecycle-event.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { AccessModule } from '../access/access.module';
import { SchoolController } from './school.controller';
import { SchoolService } from './school.service';

@Module({
  imports: [
    AuthModule,
    SettingsModule,
    VehiclesModule,
    AccessModule,
    TypeOrmModule.forFeature([
      GroupEntity,
      SubjectEntity,
      SchoolEntity,
      StudentEntity,
      TeacherEntity,
      TeacherLifecycleEventEntity,
      TeacherGroupEntity,
      TeacherSubjectEntity,
      UserEntity,
      ImportJobEntity,
      ParentEntity,
      StudentParentEntity,
      StudentLifecycleEventEntity
    ])
  ],
  controllers: [SchoolController],
  providers: [SchoolService]
})
export class SchoolModule {}

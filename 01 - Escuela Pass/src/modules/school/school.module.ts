import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupEntity } from '../../database/entities/group.entity';
import { ImportJobEntity } from '../../database/entities/import-job.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { SubjectEntity } from '../../database/entities/subject.entity';
import { TeacherGroupEntity } from '../../database/entities/teacher-group.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { SchoolController } from './school.controller';
import { SchoolService } from './school.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      GroupEntity,
      SubjectEntity,
      StudentEntity,
      TeacherEntity,
      TeacherGroupEntity,
      UserEntity,
      ImportJobEntity
    ])
  ],
  controllers: [SchoolController],
  providers: [SchoolService]
})
export class SchoolModule {}

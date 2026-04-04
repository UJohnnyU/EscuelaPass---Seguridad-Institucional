import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GradeEntity } from '../../database/entities/grade.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { AuthModule } from '../auth/auth.module';
import { GradesController } from './grades.controller';
import { GradesService } from './grades.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([GradeEntity, StudentEntity, TeacherEntity, ParentEntity])
  ],
  controllers: [GradesController],
  providers: [GradesService],
  exports: [GradesService]
})
export class GradesModule {}
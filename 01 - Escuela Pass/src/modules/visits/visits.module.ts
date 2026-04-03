import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { VisitRequestEntity } from '../../database/entities/visit-request.entity';
import { AuthModule } from '../auth/auth.module';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([VisitRequestEntity, StudentEntity, ParentEntity, TeacherEntity])
  ],
  controllers: [VisitsController],
  providers: [VisitsService]
})
export class VisitsModule {}

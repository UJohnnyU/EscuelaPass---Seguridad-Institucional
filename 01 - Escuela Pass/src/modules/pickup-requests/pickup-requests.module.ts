import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentEntity } from '../../database/entities/parent.entity';
import { PickupRequestEntity } from '../../database/entities/pickup-request.entity';
import { SchoolEntity } from '../../database/entities/school.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { AuthModule } from '../auth/auth.module';
import { PickupRequestsController } from './pickup-requests.controller';
import { PickupRequestsService } from './pickup-requests.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([PickupRequestEntity, StudentEntity, ParentEntity, TeacherEntity, SchoolEntity])
  ],
  controllers: [PickupRequestsController],
  providers: [PickupRequestsService],
  exports: [PickupRequestsService]
})
export class PickupRequestsModule {}

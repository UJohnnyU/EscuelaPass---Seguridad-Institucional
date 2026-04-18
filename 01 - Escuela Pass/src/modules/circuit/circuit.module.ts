import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CircuitRequestEntity } from '../../database/entities/circuit-request.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { TeacherGroupEntity } from '../../database/entities/teacher-group.entity';
import { VehicleEntity } from '../../database/entities/vehicle.entity';
import { FcmModule } from '../fcm/fcm.module';
import { SettingsModule } from '../settings/settings.module';
import { CircuitController } from './circuit.controller';
import { CircuitService } from './circuit.service';

@Module({
  imports: [
    FcmModule,
    SettingsModule,
    TypeOrmModule.forFeature([
      CircuitRequestEntity,
      StudentEntity,
      GroupEntity,
      ParentEntity,
      VehicleEntity,
      TeacherEntity,
      TeacherGroupEntity
    ])
  ],
  controllers: [CircuitController],
  providers: [CircuitService]
})
export class CircuitModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CircuitRequestEntity } from '../../database/entities/circuit-request.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { TeacherGroupEntity } from '../../database/entities/teacher-group.entity';
import { VehicleEntity } from '../../database/entities/vehicle.entity';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { FcmModule } from '../fcm/fcm.module';
import { DepartureConsentModule } from '../departure-consent/departure-consent.module';
import { SettingsModule } from '../settings/settings.module';
import { CircuitController } from './circuit.controller';
import { CircuitService } from './circuit.service';

@Module({
  imports: [
    FcmModule,
    SettingsModule,
    DepartureConsentModule,
    TypeOrmModule.forFeature([
      CircuitRequestEntity,
      StudentEntity,
      GroupEntity,
      ParentEntity,
      VehicleEntity,
      TeacherEntity,
      TeacherGroupEntity,
      NotificationEntity,
      UserEntity
    ])
  ],
  controllers: [CircuitController],
  providers: [CircuitService]
})
export class CircuitModule {}

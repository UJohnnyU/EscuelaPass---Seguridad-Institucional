import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdministrativeStaffEntity } from '../../database/entities/administrative-staff.entity';
import { DebtEntity } from '../../database/entities/debt.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { PaymentConceptEntity } from '../../database/entities/payment-concept.entity';
import { PaymentRecordEntity } from '../../database/entities/payment-record.entity';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { AuthModule } from '../auth/auth.module';
import { FcmModule } from '../fcm/fcm.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    AuthModule,
    FcmModule,
    TypeOrmModule.forFeature([
      PaymentConceptEntity,
      DebtEntity,
      PaymentRecordEntity,
      StudentEntity,
      ParentEntity,
      AdministrativeStaffEntity,
      NotificationEntity
    ])
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService]
})
export class PaymentsModule {}

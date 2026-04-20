import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CircuitRequestEntity } from '../../database/entities/circuit-request.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { StudentDepartureConsentEntity } from '../../database/entities/student-departure-consent.entity';
import { AuthModule } from '../auth/auth.module';
import { DepartureConsentController } from './departure-consent.controller';
import { DepartureConsentService } from './departure-consent.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      StudentDepartureConsentEntity,
      ParentEntity,
      GroupEntity,
      UserEntity,
      CircuitRequestEntity
    ])
  ],
  controllers: [DepartureConsentController],
  providers: [DepartureConsentService],
  exports: [DepartureConsentService]
})
export class DepartureConsentModule {}

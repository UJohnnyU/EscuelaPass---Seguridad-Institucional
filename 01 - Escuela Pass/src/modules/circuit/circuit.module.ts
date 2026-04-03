import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CircuitRequestEntity } from '../../database/entities/circuit-request.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { FcmModule } from '../fcm/fcm.module';
import { CircuitController } from './circuit.controller';
import { CircuitService } from './circuit.service';

@Module({
  imports: [
    FcmModule,
    TypeOrmModule.forFeature([CircuitRequestEntity, StudentEntity, ParentEntity])
  ],
  controllers: [CircuitController],
  providers: [CircuitService]
})
export class CircuitModule {}

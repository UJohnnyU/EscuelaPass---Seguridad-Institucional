import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessCredentialEntity } from '../../database/entities/access-credential.entity';
import { AccessEventEntity } from '../../database/entities/access-event.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccessCredentialEntity, AccessEventEntity, UserEntity])
  ],
  controllers: [AccessController],
  providers: [AccessService]
})
export class AccessModule {}

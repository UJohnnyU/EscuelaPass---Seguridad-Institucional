import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserFcmTokenEntity } from '../../database/entities/user-fcm-token.entity';
import { FcmService } from './fcm.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserFcmTokenEntity])],
  providers: [FcmService],
  exports: [FcmService]
})
export class FcmModule {}

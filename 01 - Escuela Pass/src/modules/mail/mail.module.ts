import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { MailService } from './mail.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [MailService],
  exports: [MailService]
})
export class MailModule {}

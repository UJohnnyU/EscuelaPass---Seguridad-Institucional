import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentParentEntity } from '../../database/entities/student-parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([UserEntity, StudentEntity, StudentParentEntity, ParentEntity])],
  controllers: [FilesController],
  providers: [FilesService]
})
export class FilesModule {}

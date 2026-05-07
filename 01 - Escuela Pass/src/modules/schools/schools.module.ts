import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolEntity } from '../../database/entities/school.entity';
import { AdministrativeStaffEntity } from '../../database/entities/administrative-staff.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([SchoolEntity, UserEntity, AdministrativeStaffEntity])],
  controllers: [SchoolsController],
  providers: [SchoolsService]
})
export class SchoolsModule {}

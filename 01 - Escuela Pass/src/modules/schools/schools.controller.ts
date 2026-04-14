import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AssignUserSchoolDto } from './dto/assign-user-school.dto';
import { CreateSchoolAdminDto } from './dto/create-school-admin.dto';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolsService } from './schools.service';

@Controller('schools')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  list() {
    return this.schoolsService.list();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.schoolsService.get(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateSchoolDto) {
    return this.schoolsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSchoolDto
  ) {
    return this.schoolsService.update(id, dto);
  }

  @Post('assign-user')
  @Roles(UserRole.ADMIN)
  assignUserSchool(@Body() dto: AssignUserSchoolDto) {
    return this.schoolsService.assignUserSchool(dto);
  }

  @Get(':id/users')
  @Roles(UserRole.ADMIN)
  listUsersBySchool(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.schoolsService.listUsersBySchool(id);
  }

  @Post(':id/admin')
  @Roles(UserRole.ADMIN)
  async createSchoolAdmin(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateSchoolAdminDto
  ) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.schoolsService.createSchoolAdmin(id, {
      email: dto.email,
      fullName: dto.fullName,
      passwordHash
    });
  }
}

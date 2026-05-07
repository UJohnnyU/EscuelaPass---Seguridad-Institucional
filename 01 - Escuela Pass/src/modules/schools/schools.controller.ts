import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AssignUserSchoolDto } from './dto/assign-user-school.dto';
import { CreateSchoolAdminDto } from './dto/create-school-admin.dto';
import { CreateSchoolDto } from './dto/create-school.dto';
import { ResetSchoolAdminPasswordDto } from './dto/reset-school-admin-password.dto';
import { UpdateSchoolAdminUserDto } from './dto/update-school-admin-user.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolsService } from './schools.service';

@ApiTags('schools')
@ApiBearerAuth()
@Controller('schools')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar todas las escuelas' })
  @ApiResponse({ status: 200, description: 'Listado ordenado por nombre.' })
  list() {
    return this.schoolsService.list();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Obtener una escuela por id' })
  @ApiParam({ name: 'id', description: 'UUID de la escuela' })
  @ApiResponse({ status: 200, description: 'Escuela encontrada.' })
  @ApiResponse({ status: 404, description: 'Escuela no encontrada.' })
  get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.schoolsService.get(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear escuela' })
  @ApiResponse({ status: 201, description: 'Escuela creada.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos (p. ej. horarios de jornada).' })
  @ApiResponse({ status: 409, description: 'Nombre o código ya existente.' })
  create(@Body() dto: CreateSchoolDto) {
    return this.schoolsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar escuela (reglas, ubicación, estado, jornadas)' })
  @ApiParam({ name: 'id', description: 'UUID de la escuela' })
  @ApiResponse({ status: 200, description: 'Escuela actualizada.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 404, description: 'Escuela no encontrada.' })
  @ApiResponse({ status: 409, description: 'Nombre duplicado.' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSchoolDto
  ) {
    return this.schoolsService.update(id, dto);
  }

  @Post('assign-user')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Asignar o reasignar la escuela de un usuario',
    description: 'Actualiza `school_id` del usuario indicado.'
  })
  @ApiResponse({ status: 200, description: 'Usuario vinculado a la escuela.' })
  @ApiResponse({ status: 404, description: 'Usuario o escuela no encontrados.' })
  assignUserSchool(@Body() dto: AssignUserSchoolDto) {
    return this.schoolsService.assignUserSchool(dto);
  }

  @Get(':id/users')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Listar usuarios de una escuela',
    description:
      'Incluye todos los usuarios con `school_id` asignado a la escuela (docentes, padres, administrativos, etc.). Campos útiles por fila: id, email, role, fullName, status, phone, canAccessCampus.'
  })
  @ApiParam({ name: 'id', description: 'UUID de la escuela' })
  @ApiResponse({ status: 200, description: 'Listado ordenado por nombre.' })
  @ApiResponse({ status: 404, description: 'Escuela no encontrada.' })
  listUsersBySchool(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.schoolsService.listUsersBySchool(id);
  }

  @Post(':id/admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Crear usuario administrativo para una escuela',
    description:
      'Crea un usuario con rol ADMINISTRATIVO, registra la fila en `administrative_staff` y opcionalmente teléfono y permiso de acceso al campus.'
  })
  @ApiParam({ name: 'id', description: 'UUID de la escuela' })
  @ApiResponse({ status: 201, description: 'Administrativo creado (id, email, role, schoolId).' })
  @ApiResponse({ status: 409, description: 'El correo ya está registrado.' })
  async createSchoolAdmin(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateSchoolAdminDto
  ) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.schoolsService.createSchoolAdmin(id, {
      email: dto.email,
      fullName: dto.fullName,
      passwordHash,
      phone: dto.phone,
      canAccessCampus: dto.canAccessCampus
    });
  }

  @Patch(':schoolId/users/:userId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Actualizar administrativo de una escuela',
    description:
      'Solo usuarios con rol ADMINISTRATIVO y `school_id` coincidente con `schoolId`. Envíe al menos uno de: fullName, phone, canAccessCampus, status.'
  })
  @ApiParam({ name: 'schoolId', description: 'UUID de la escuela' })
  @ApiParam({ name: 'userId', description: 'UUID del usuario administrativo' })
  @ApiResponse({ status: 200, description: 'Usuario actualizado (payload con datos de perfil).' })
  @ApiResponse({ status: 400, description: 'Cuerpo vacío o rol no administrativo.' })
  @ApiResponse({ status: 404, description: 'Usuario no pertenece a la escuela.' })
  updateSchoolAdministrativeUser(
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: UpdateSchoolAdminUserDto
  ) {
    return this.schoolsService.updateSchoolAdministrativeUser(schoolId, userId, dto);
  }

  @Post(':schoolId/users/:userId/reset-password')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restablecer contraseña de un administrativo escolar',
    description: 'Solo rol ADMINISTRATIVO de la escuela indicada. Mínimo 8 caracteres.'
  })
  @ApiParam({ name: 'schoolId', description: 'UUID de la escuela' })
  @ApiParam({ name: 'userId', description: 'UUID del usuario administrativo' })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada (id, email).' })
  @ApiResponse({ status: 400, description: 'Contraseña demasiado corta (validación).' })
  @ApiResponse({ status: 404, description: 'Usuario no pertenece a la escuela.' })
  async resetSchoolAdministrativePassword(
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: ResetSchoolAdminPasswordDto
  ) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.schoolsService.resetSchoolAdministrativePassword(schoolId, userId, passwordHash);
  }
}

/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

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

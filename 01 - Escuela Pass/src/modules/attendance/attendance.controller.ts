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
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AttendanceService } from './attendance.service';
import { ParentExcuseDto } from './dto/parent-excuse.dto';
import { RegisterAttendanceDto } from './dto/register-attendance.dto';
import { RegisterBulkAttendanceDto } from './dto/register-bulk-attendance.dto';
import { excuseMulterOptions } from './multer-excuse.config';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('register')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  register(@Body() dto: RegisterAttendanceDto, @Req() req: Request & { user: JwtUser }) {
    return this.attendanceService.register(dto, req.user.userId, req.user.role);
  }

  @Post('register-bulk')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  registerBulk(@Body() dto: RegisterBulkAttendanceDto, @Req() req: Request & { user: JwtUser }) {
    return this.attendanceService.registerBulkBySession(dto, req.user.userId, req.user.role);
  }

  @Get('groups/:groupId')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  listByGroup(
    @Param('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Query('date') date: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('studentId') studentId: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.attendanceService.listByGroup(groupId, req.user.userId, req.user.role, {
      date,
      from,
      to,
      studentId
    });
  }

  @Get('parent/my-children')
  @Roles(UserRole.PADRE)
  listParent(@Query('date') date: string | undefined, @Req() req: Request & { user: JwtUser }) {
    return this.attendanceService.listMyChildrenAttendance(req.user.userId, date);
  }

  @Get('parent/my-students')
  @Roles(UserRole.PADRE)
  listMyStudents(@Req() req: Request & { user: JwtUser }) {
    return this.attendanceService.listMyStudentsForParent(req.user.userId);
  }

  @Post('parent/excuse')
  @Roles(UserRole.PADRE)
  @UseInterceptors(FileInterceptor('file', excuseMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['studentId', 'date', 'reason'],
      properties: {
        studentId: { type: 'string', format: 'uuid' },
        date: { type: 'string', example: '2026-04-20' },
        reason: { type: 'string' },
        file: { type: 'string', format: 'binary' }
      }
    }
  })
  submitParentExcuse(
    @Req() req: Request & { user: JwtUser },
    @Body() dto: ParentExcuseDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    const path = file ? `/uploads/excuses/${file.filename}` : null;
    return this.attendanceService.submitParentExcuse(req.user.userId, dto, path);
  }
}

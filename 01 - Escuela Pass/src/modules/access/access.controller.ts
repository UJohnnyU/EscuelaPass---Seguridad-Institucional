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

import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AccessService } from './access.service';
import { RegisterAccessEventDto } from './dto/register-access-event.dto';
import { AssignNfcCredentialDto } from './dto/assign-nfc-credential.dto';
import { CredentialType } from '../../database/entities/access-credential.entity';

type JwtReq = Request & { user: { userId: string; email: string; role: UserRole; schoolId?: string | null } };

@ApiTags('access-events')
@ApiBearerAuth()
@Controller('access-events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get('my-qr')
  @ApiOperation({ summary: 'Obtener o crear el código QR del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Valor QR para escanear en acceso/asistencia.' })
  getMyQr(@Req() req: JwtReq) {
    return this.accessService.getOrCreateQrForUser(req.user.userId);
  }

  @Post('scan')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @ApiOperation({ summary: 'Registrar evento de acceso por QR o NFC' })
  @ApiResponse({ status: 201, description: 'Evento de acceso registrado.' })
  @ApiResponse({ status: 403, description: 'Credencial fuera de la escuela del operador.' })
  @ApiResponse({ status: 404, description: 'Credencial no encontrada o inactiva.' })
  scan(@Body() payload: RegisterAccessEventDto, @Req() req: JwtReq) {
    return this.accessService.scanAccess(payload, {
      userId: req.user.userId,
      role: req.user.role,
      schoolId: req.user.schoolId ?? null
    });
  }

  /** RF2 — Asignar credencial NFC a un usuario (ADMIN o ADMINISTRATIVO). */
  @Post('credentials/nfc')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Asignar credencial NFC a un usuario' })
  @ApiResponse({ status: 201, description: 'Credencial NFC asignada correctamente.' })
  @ApiResponse({ status: 400, description: 'UID NFC ya asignado a otro usuario.' })
  assignNfc(@Body() dto: AssignNfcCredentialDto, @Req() req: JwtReq) {
    return this.accessService.assignNfcCredential(dto.targetUserId, dto.nfcUid, req.user.userId);
  }

  @Get('credentials/assignable-users')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Buscar usuarios para asignar credencial NFC' })
  assignableUsers(@Req() req: JwtReq, @Query('q') q?: string, @Query('limit') limitRaw?: string) {
    const take = Math.min(50, Math.max(1, Number.parseInt(limitRaw ?? '24', 10) || 24));
    const schoolId = (req.user as { schoolId?: string | null }).schoolId ?? null;
    return this.accessService.searchAssignableUsers(schoolId, q, take);
  }

  /** RF2 — Listar credenciales activas de la institución. */
  @Get('credentials')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Listar credenciales activas de la institución' })
  @ApiResponse({ status: 200, description: 'Lista paginada de credenciales activas.' })
  listCredentials(
    @Req() req: JwtReq,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('role') role?: string
  ) {
    const p = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
    const l = Math.min(200, Math.max(1, Number.parseInt(limit ?? '50', 10) || 50));
    const schoolId = (req.user as { schoolId?: string | null }).schoolId ?? null;
    const credentialType =
      type?.trim().toUpperCase() === 'NFC'
        ? CredentialType.NFC
        : type?.trim().toUpperCase() === 'QR'
          ? CredentialType.QR
          : undefined;
    const r = role?.trim().toUpperCase();
    const userRole =
      r && (Object.values(UserRole) as string[]).includes(r) ? (r as UserRole) : undefined;
    return this.accessService.listCredentials(schoolId, p, l, {
      search: q?.trim() || null,
      credentialType,
      userRole
    });
  }

  /** RF2 — Revocar credencial por ID. */
  @Delete('credentials/:id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Revocar una credencial de acceso' })
  @ApiResponse({ status: 200, description: 'Credencial revocada.' })
  @ApiResponse({ status: 404, description: 'Credencial no encontrada.' })
  revokeCredential(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: JwtReq
  ) {
    return this.accessService.revokeCredential(id, req.user.userId);
  }
}

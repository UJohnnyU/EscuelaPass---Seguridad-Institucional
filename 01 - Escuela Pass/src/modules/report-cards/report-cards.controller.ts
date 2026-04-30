import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { Request } from 'express';
import { ReportCardType } from '../../database/entities/report-card.entity';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReportCardsService } from './report-cards.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('report-cards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportCardsController {
  constructor(private readonly service: ReportCardsService) {}

  @Get()
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  list(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string,
    @Query('schoolYear') schoolYear?: string,
    @Query('periodId') periodId?: string,
    @Query('type') type?: string,
    @Query('studentId') studentId?: string
  ) {
    const t = type === 'PERIOD' || type === 'FINAL' ? (type as ReportCardType) : undefined;
    return this.service.listForAdmin(req.user.userId, req.user.role, {
      schoolId: schoolId || undefined,
      schoolYear: schoolYear || undefined,
      periodId: periodId || undefined,
      type: t,
      studentId: studentId || undefined
    });
  }

  @Get('student/me')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ALUMNO)
  listForStudent(@Req() req: Request & { user: JwtUser }) {
    return this.service.listForStudentUser(req.user.userId);
  }

  /** Alias corto: debe declararse antes de `:id` para no caer en ParseUUIDPipe('me'). */
  @Get('me')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ALUMNO)
  listForStudentMeAlias(@Req() req: Request & { user: JwtUser }) {
    return this.service.listForStudentUser(req.user.userId);
  }

  @Get('parent/my-children')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.PADRE)
  listForParent(
    @Req() req: Request & { user: JwtUser },
    @Query('studentId') studentId?: string
  ) {
    return this.service.listForParentUser(req.user.userId, studentId?.trim() || undefined);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(
    UserRole.ADMIN,
    UserRole.ADMINISTRATIVO,
    UserRole.DOCENTE,
    UserRole.PADRE,
    UserRole.ALUMNO
  )
  detail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.service.getDetail(id, req.user.userId, req.user.role);
  }

  @Post('generate-period/:periodId')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  regeneratePeriod(
    @Param('periodId', new ParseUUIDPipe({ version: '4' })) periodId: string,
    @Body() body: { publish?: boolean } | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.service.regenerateForPeriodByAdmin(
      periodId,
      req.user.userId,
      req.user.role,
      body?.publish ?? true
    );
  }

  @Post('generate-final')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  regenerateFinal(
    @Body() body: { schoolId: string; schoolYear: string; publish?: boolean },
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.service.regenerateFinalByAdmin(
      body.schoolId,
      body.schoolYear,
      req.user.userId,
      req.user.role,
      body.publish ?? true
    );
  }
}

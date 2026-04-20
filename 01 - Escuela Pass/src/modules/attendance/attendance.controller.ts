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

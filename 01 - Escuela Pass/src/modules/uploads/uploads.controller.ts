import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { avatarMulterOptions, schoolLogoMulterOptions } from './image-multer.config';
import { UploadsService } from './uploads.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('users/:userId/avatar')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @UseInterceptors(FileInterceptor('file', avatarMulterOptions))
  async uploadUserAvatar(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user: JwtUser }
  ) {
    if (!file?.filename) {
      return { avatarUrl: null };
    }
    return this.uploadsService.setUserAvatar(req.user.userId, req.user.role, userId, file.filename);
  }

  @Post('schools/:schoolId/logo')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', schoolLogoMulterOptions))
  async uploadSchoolLogo(
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file?.filename) {
      return { logoUrl: null };
    }
    return this.uploadsService.setSchoolLogo(schoolId, file.filename);
  }
}

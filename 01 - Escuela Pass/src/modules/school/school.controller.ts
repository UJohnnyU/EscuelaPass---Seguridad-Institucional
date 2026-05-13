import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AssignTeacherGroupDto } from './dto/assign-teacher-group.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateParentDto } from './dto/create-parent.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { LinkParentStudentDto } from './dto/link-parent-student.dto';
import { UpdateStudentParentLinkDto } from './dto/update-student-parent-link.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { CreateVehicleDto } from '../vehicles/dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../vehicles/dto/update-vehicle.dto';
import { VehiclesService } from '../vehicles/vehicles.service';
import { TransitionStudentLifecycleDto } from './dto/transition-student-lifecycle.dto';
import { TransitionTeacherLifecycleDto } from './dto/transition-teacher-lifecycle.dto';
import { SchoolService } from './school.service';

type JwtUser = { userId: string; email: string; role: UserRole; schoolId?: string | null };

@Controller('school')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
export class SchoolController {
  constructor(
    private readonly schoolService: SchoolService,
    private readonly vehiclesService: VehiclesService
  ) {}

  private scopeSchool(user: JwtUser): string | undefined {
    return user.role === UserRole.ADMIN ? undefined : user.schoolId ?? undefined;
  }

  /** Plantillas Excel: escuela del usuario o `schoolId` en query (solo ADMIN de plataforma). */
  private resolveSchoolIdForTemplate(user: JwtUser, querySchoolId?: string): string | null {
    if (user.role === UserRole.ADMIN) {
      const q = querySchoolId?.trim();
      return q || null;
    }
    return user.schoolId ?? null;
  }

  /** Límite opcional para búsquedas (1–100). */
  private parseSearchLimit(limitRaw: string | undefined): number | undefined {
    if (!limitRaw?.trim()) return undefined;
    const n = parseInt(limitRaw, 10);
    if (Number.isNaN(n)) return undefined;
    return Math.min(Math.max(n, 1), 100);
  }

  private parseAuditLimit(limitRaw: string | undefined): number {
    if (!limitRaw?.trim()) return 200;
    const n = parseInt(limitRaw, 10);
    if (Number.isNaN(n)) return 200;
    return Math.min(Math.max(n, 1), 5000);
  }

  @Get('groups')
  listGroups(
    @Query('schoolId') schoolIdFilter: string | undefined,
    @Query('q') q: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const scoped = this.scopeSchool(req.user);
    const sid = schoolIdFilter?.trim();
    const opts = { q: q?.trim(), limit: this.parseSearchLimit(limitRaw) };
    if (req.user.role === UserRole.ADMIN && sid) {
      return this.schoolService.listGroups(sid, opts);
    }
    return this.schoolService.listGroups(scoped, opts);
  }

  @Get('groups/:id')
  getGroup(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() req: Request & { user: JwtUser }) {
    return this.schoolService.getGroup(id, this.scopeSchool(req.user));
  }

  @Post('groups')
  createGroup(@Body() dto: CreateGroupDto, @Req() req: Request & { user: JwtUser }) {
    return this.schoolService.createGroup(dto, this.scopeSchool(req.user));
  }

  @Patch('groups/:id')
  updateGroup(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateGroupDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.updateGroup(id, dto, this.scopeSchool(req.user));
  }

  @Delete('groups/:id')
  removeGroup(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() req: Request & { user: JwtUser }) {
    return this.schoolService.removeGroup(id, this.scopeSchool(req.user));
  }

  @Get('subjects')
  listSubjects(@Req() req: Request & { user: JwtUser }, @Query('schoolId') schoolIdFilter?: string) {
    const scoped = this.scopeSchool(req.user);
    const sid = schoolIdFilter?.trim();
    if (req.user.role === UserRole.ADMIN && sid) {
      return this.schoolService.listSubjects(sid);
    }
    return this.schoolService.listSubjects(scoped);
  }

  @Get('subjects/:id')
  getSubject(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.getSubject(id, this.scopeSchool(req.user));
  }

  @Post('subjects')
  createSubject(@Body() dto: CreateSubjectDto, @Req() req: Request & { user: JwtUser }) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo el administrador puede crear materias institucionales');
    }
    return this.schoolService.createSubject(dto, this.scopeSchool(req.user));
  }

  @Patch('subjects/:id')
  updateSubject(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSubjectDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo el administrador puede editar materias institucionales');
    }
    return this.schoolService.updateSubject(id, dto, this.scopeSchool(req.user));
  }

  @Delete('subjects/:id')
  removeSubject(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo el administrador puede eliminar materias institucionales');
    }
    return this.schoolService.removeSubject(id, this.scopeSchool(req.user));
  }

  @Get('students')
  listStudents(
    @Query('schoolId') schoolIdFilter: string | undefined,
    @Query('q') q: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const scoped = this.scopeSchool(req.user);
    const sid = schoolIdFilter?.trim();
    const opts = { q: q?.trim(), limit: this.parseSearchLimit(limitRaw) };
    if (req.user.role === UserRole.ADMIN && sid) {
      return this.schoolService.listStudents(sid, opts);
    }
    return this.schoolService.listStudents(scoped, opts);
  }

  @Get('students/next-matricula')
  previewNextStudentMatricula(
    @Query('schoolId') schoolIdFilter: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const scoped = this.scopeSchool(req.user);
    const sid = schoolIdFilter?.trim();
    if (req.user.role === UserRole.ADMIN && sid) {
      return this.schoolService.previewNextStudentMatricula(scoped, sid);
    }
    return this.schoolService.previewNextStudentMatricula(scoped);
  }

  @Get('students/:id')
  getStudent(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.getStudent(id, this.scopeSchool(req.user));
  }

  @Post('students')
  createStudent(@Body() dto: CreateStudentDto, @Req() req: Request & { user: JwtUser }) {
    return this.schoolService.createStudent(dto, this.scopeSchool(req.user));
  }

  @Patch('students/:id')
  updateStudent(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateStudentDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.updateStudent(id, dto, this.scopeSchool(req.user));
  }

  @Delete('students/:id')
  removeStudent(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.removeStudent(id, this.scopeSchool(req.user));
  }

  @Post('students/:id/lifecycle-transition')
  transitionStudentLifecycle(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: TransitionStudentLifecycleDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.transitionStudentLifecycle(
      id,
      dto,
      req.user.userId,
      this.scopeSchool(req.user)
    );
  }

  @Get('students/:id/lifecycle-history')
  listStudentLifecycleHistory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.listStudentLifecycleHistory(id, this.scopeSchool(req.user));
  }

  @Get('teachers')
  listTeachers(
    @Query('schoolId') schoolIdFilter: string | undefined,
    @Query('q') q: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const scoped = this.scopeSchool(req.user);
    const sid = schoolIdFilter?.trim();
    const opts = { q: q?.trim(), limit: this.parseSearchLimit(limitRaw) };
    if (req.user.role === UserRole.ADMIN && sid) {
      return this.schoolService.listTeachers(sid, opts);
    }
    return this.schoolService.listTeachers(scoped, opts);
  }

  @Get('teachers/:id')
  getTeacher(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.getTeacher(id, this.scopeSchool(req.user));
  }

  @Post('teachers')
  createTeacher(@Body() dto: CreateTeacherDto, @Req() req: Request & { user: JwtUser }) {
    return this.schoolService.createTeacher(dto, this.scopeSchool(req.user));
  }

  @Get('teacher-subjects')
  listTeacherSubjects(
    @Query('teacherId') teacherId: string | undefined,
    @Query('schoolId') schoolIdFilter: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const scoped = this.scopeSchool(req.user);
    const sid = schoolIdFilter?.trim();
    if (req.user.role === UserRole.ADMIN && sid) {
      return this.schoolService.listTeacherSubjects(teacherId, sid);
    }
    return this.schoolService.listTeacherSubjects(teacherId, scoped);
  }

  @Patch('teachers/:id')
  updateTeacher(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateTeacherDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.updateTeacher(id, dto, this.scopeSchool(req.user));
  }

  @Delete('teachers/:id')
  removeTeacher(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.removeTeacher(id, this.scopeSchool(req.user));
  }

  @Post('teachers/:id/lifecycle-transition')
  transitionTeacherLifecycle(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: TransitionTeacherLifecycleDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.transitionTeacherLifecycle(
      id,
      dto,
      req.user.userId,
      this.scopeSchool(req.user)
    );
  }

  @Get('teachers/:id/lifecycle-history')
  listTeacherLifecycleHistory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.listTeacherLifecycleHistory(id, this.scopeSchool(req.user));
  }

  @Get('lifecycle-events')
  listLifecycleEvents(
    @Query('entityType') entityTypeRaw: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Query('schoolId') schoolIdFilter: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const entityType =
      entityTypeRaw === 'student' || entityTypeRaw === 'teacher' || entityTypeRaw === 'all'
        ? entityTypeRaw
        : 'all';
    const scoped = this.scopeSchool(req.user);
    const sid = schoolIdFilter?.trim();
    const scopeForList =
      req.user.role === UserRole.ADMIN && sid ? sid : scoped;
    return this.schoolService.listLifecycleEvents(scopeForList ?? undefined, {
      entityType,
      from,
      to,
      limit: this.parseAuditLimit(limitRaw)
    });
  }

  @Get('lifecycle-events/export.xlsx')
  async exportLifecycleEventsXlsx(
    @Query('entityType') entityTypeRaw: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Query('schoolId') schoolIdFilter: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const entityType =
      entityTypeRaw === 'student' || entityTypeRaw === 'teacher' || entityTypeRaw === 'all'
        ? entityTypeRaw
        : 'all';
    const scoped = this.scopeSchool(req.user);
    const sid = schoolIdFilter?.trim();
    const scopeForList =
      req.user.role === UserRole.ADMIN && sid ? sid : scoped;
    const buffer = await this.schoolService.exportLifecycleEventsXlsx(scopeForList ?? undefined, {
      entityType,
      from,
      to,
      limit: this.parseAuditLimit(limitRaw)
    });
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="lifecycle-events.xlsx"'
    });
  }

  @Get('teacher-assignments')
  listAssignments(
    @Query('teacherId') teacherId: string | undefined,
    @Query('groupId') groupId: string | undefined,
    @Query('schoolId') schoolIdFilter: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const scoped = this.scopeSchool(req.user);
    const sid = schoolIdFilter?.trim();
    if (req.user.role === UserRole.ADMIN && sid) {
      return this.schoolService.listTeacherAssignments(teacherId, groupId, sid);
    }
    return this.schoolService.listTeacherAssignments(teacherId, groupId, scoped);
  }

  @Post('teacher-assignments')
  assignTeacherGroup(@Body() dto: AssignTeacherGroupDto, @Req() req: Request & { user: JwtUser }) {
    return this.schoolService.assignTeacherGroup(dto, this.scopeSchool(req.user));
  }

  @Delete('teacher-assignments/:id')
  removeAssignment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.removeTeacherAssignment(id, this.scopeSchool(req.user));
  }

  @Get('parents')
  listParents(
    @Query('schoolId') schoolIdFilter: string | undefined,
    @Query('q') q: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const scoped = this.scopeSchool(req.user);
    const sid = schoolIdFilter?.trim();
    const opts = { q: q?.trim(), limit: this.parseSearchLimit(limitRaw) };
    if (req.user.role === UserRole.ADMIN && sid) {
      return this.schoolService.listParents(sid, opts);
    }
    return this.schoolService.listParents(scoped, opts);
  }

  @Get('parents/:id')
  getParent(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.getParent(id, this.scopeSchool(req.user));
  }

  @Post('parents')
  createParent(@Body() dto: CreateParentDto, @Req() req: Request & { user: JwtUser }) {
    return this.schoolService.createParent(dto, this.scopeSchool(req.user));
  }

  @Patch('parents/:id')
  updateParent(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateParentDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.updateParent(id, dto, this.scopeSchool(req.user));
  }

  @Delete('parents/:id')
  removeParent(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.removeParent(id, this.scopeSchool(req.user));
  }

  /** Alta de vehículo para un padre/tutor (misma institución que el usuario). */
  @Post('parents/:parentId/vehicles')
  async createParentVehicle(
    @Param('parentId', new ParseUUIDPipe({ version: '4' })) parentId: string,
    @Body() dto: CreateVehicleDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    await this.schoolService.getParent(parentId, this.scopeSchool(req.user));
    return this.vehiclesService.staffCreateVehicleForParent(parentId, dto);
  }

  @Patch('parents/:parentId/vehicles/:vehicleId')
  async updateParentVehicle(
    @Param('parentId', new ParseUUIDPipe({ version: '4' })) parentId: string,
    @Param('vehicleId', new ParseUUIDPipe({ version: '4' })) vehicleId: string,
    @Body() dto: UpdateVehicleDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    await this.schoolService.getParent(parentId, this.scopeSchool(req.user));
    return this.vehiclesService.staffUpdateVehicleForParent(parentId, vehicleId, dto);
  }

  @Delete('parents/:parentId/vehicles/:vehicleId')
  async removeParentVehicle(
    @Param('parentId', new ParseUUIDPipe({ version: '4' })) parentId: string,
    @Param('vehicleId', new ParseUUIDPipe({ version: '4' })) vehicleId: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    await this.schoolService.getParent(parentId, this.scopeSchool(req.user));
    return this.vehiclesService.staffDeleteVehicleForParent(parentId, vehicleId);
  }

  @Get('student-parent-links')
  listStudentParentLinks(
    @Query('parentId') parentId: string | undefined,
    @Query('studentId') studentId: string | undefined,
    @Query('schoolId') schoolIdFilter: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const scoped = this.scopeSchool(req.user);
    const sid = schoolIdFilter?.trim();
    if (req.user.role === UserRole.ADMIN && sid) {
      return this.schoolService.listStudentParentLinks(parentId, studentId, sid);
    }
    return this.schoolService.listStudentParentLinks(parentId, studentId, scoped);
  }

  @Post('student-parent-links')
  linkParentStudent(@Body() dto: LinkParentStudentDto, @Req() req: Request & { user: JwtUser }) {
    return this.schoolService.linkParentStudent(dto, this.scopeSchool(req.user), req.user.userId);
  }

  @Patch('student-parent-links/:id')
  updateStudentParentLink(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateStudentParentLinkDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.updateStudentParentLink(id, dto, this.scopeSchool(req.user));
  }

  @Delete('student-parent-links/:id')
  unlinkStudentParent(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.unlinkStudentParent(id, this.scopeSchool(req.user), req.user.userId);
  }

  @Post('import/groups/xlsx')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' }
      }
    }
  })
  @UseInterceptors(FileInterceptor('file'))
  importGroupsXlsx(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dryRun') dryRun: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    if (!file?.buffer) throw new BadRequestException('Envía archivo Excel (.xlsx) en el campo "file"');
    return this.schoolService.importGroupsXlsx(file.buffer, dryRun === 'true', this.scopeSchool(req.user));
  }

  @Post('import/students/xlsx')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' }
      }
    }
  })
  @UseInterceptors(FileInterceptor('file'))
  importStudentsXlsx(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dryRun') dryRun: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    if (!file?.buffer) throw new BadRequestException('Envía archivo Excel (.xlsx) en el campo "file"');
    return this.schoolService.importStudentsXlsx(file.buffer, dryRun === 'true', this.scopeSchool(req.user));
  }

  @Post('import/teachers/xlsx')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' }
      }
    }
  })
  @UseInterceptors(FileInterceptor('file'))
  importTeachersXlsx(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dryRun') dryRun: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    if (!file?.buffer) throw new BadRequestException('Envía archivo Excel (.xlsx) en el campo "file"');
    return this.schoolService.importTeachersXlsx(file.buffer, dryRun === 'true', this.scopeSchool(req.user));
  }

  @Post('import/teacher-assignments/xlsx')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' }
      }
    }
  })
  @UseInterceptors(FileInterceptor('file'))
  importTeacherAssignmentsXlsx(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dryRun') dryRun: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    if (!file?.buffer) throw new BadRequestException('Envía archivo Excel (.xlsx) en el campo "file"');
    return this.schoolService.importTeacherAssignmentsXlsx(file.buffer, dryRun === 'true', this.scopeSchool(req.user));
  }

  @Post('import/students-to-groups/xlsx')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' }
      }
    }
  })
  @UseInterceptors(FileInterceptor('file'))
  importStudentsToGroupsXlsx(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dryRun') dryRun: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    if (!file?.buffer) throw new BadRequestException('Envía archivo Excel (.xlsx) en el campo "file"');
    return this.schoolService.importStudentsToGroupsFromXlsx(
      file.buffer,
      dryRun === 'true',
      this.scopeSchool(req.user)
    );
  }

  @Post('import/:kind')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' }
      }
    }
  })
  @UseInterceptors(FileInterceptor('file'))
  importAny(
    @Param('kind') kind: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dryRun') dryRun: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    if (!file?.buffer) throw new BadRequestException('Envía archivo .xlsx en el campo "file"');
    return this.schoolService.importAny(
      kind,
      file.buffer,
      dryRun === 'true',
      this.scopeSchool(req.user)
    );
  }

  @Get('import/templates/groups.xlsx')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  async templateGroupsXlsx(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string
  ) {
    const buffer = await this.schoolService.buildTemplateGroupsXlsx(this.resolveSchoolIdForTemplate(req.user, schoolId));
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="plantilla-grupos.xlsx"'
    });
  }

  @Get('import/templates/students.xlsx')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  async templateStudentsXlsx(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string
  ) {
    const buffer = await this.schoolService.buildTemplateStudentsXlsx(
      this.resolveSchoolIdForTemplate(req.user, schoolId)
    );
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="plantilla-alumnos.xlsx"'
    });
  }

  @Get('import/templates/teachers.xlsx')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  async templateTeachersXlsx(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string
  ) {
    const buffer = await this.schoolService.buildTemplateTeachersXlsx(this.resolveSchoolIdForTemplate(req.user, schoolId));
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="plantilla-docentes.xlsx"'
    });
  }

  @Get('import/templates/teacher-assignments.xlsx')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  async templateTeacherAssignmentsXlsx(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string
  ) {
    const buffer = await this.schoolService.buildTemplateTeacherAssignmentsXlsx(
      this.resolveSchoolIdForTemplate(req.user, schoolId)
    );
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="plantilla-asignaciones-docentes.xlsx"'
    });
  }

  @Get('import/templates/students-to-groups.xlsx')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  async templateStudentsToGroupsXlsx(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string
  ) {
    const buffer = await this.schoolService.buildStudentsToGroupsTemplateXlsx(
      this.resolveSchoolIdForTemplate(req.user, schoolId)
    );
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="plantilla-asignacion-grupos.xlsx"'
    });
  }

  @Get('import/history')
  importHistory(@Query('limit') limit: string | undefined, @Req() req: Request & { user: JwtUser }) {
    const parsed = Number.parseInt(limit ?? '20', 10);
    const safeLimit = Number.isNaN(parsed) ? 20 : parsed;
    return this.schoolService.getImportHistory(safeLimit, this.scopeSchool(req.user));
  }
}

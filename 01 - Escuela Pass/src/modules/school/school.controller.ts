import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
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
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { SchoolService } from './school.service';

type JwtUser = { userId: string; email: string; role: UserRole; schoolId?: string | null };

@Controller('school')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  private scopeSchool(user: JwtUser): string | undefined {
    return user.role === UserRole.ADMIN ? undefined : user.schoolId ?? undefined;
  }

  @Get('groups')
  listGroups(
    @Query('schoolId') schoolIdFilter: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const scoped = this.scopeSchool(req.user);
    const sid = schoolIdFilter?.trim();
    if (req.user.role === UserRole.ADMIN && sid) {
      return this.schoolService.listGroups(sid);
    }
    return this.schoolService.listGroups(scoped);
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
  listSubjects(@Req() req: Request & { user: JwtUser }) {
    return this.schoolService.listSubjects(this.scopeSchool(req.user));
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
    return this.schoolService.createSubject(dto, this.scopeSchool(req.user));
  }

  @Patch('subjects/:id')
  updateSubject(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSubjectDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.updateSubject(id, dto, this.scopeSchool(req.user));
  }

  @Delete('subjects/:id')
  removeSubject(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.removeSubject(id, this.scopeSchool(req.user));
  }

  @Get('students')
  listStudents(
    @Query('schoolId') schoolIdFilter: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const scoped = this.scopeSchool(req.user);
    const sid = schoolIdFilter?.trim();
    if (req.user.role === UserRole.ADMIN && sid) {
      return this.schoolService.listStudents(sid);
    }
    return this.schoolService.listStudents(scoped);
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

  @Get('teachers')
  listTeachers(
    @Query('schoolId') schoolIdFilter: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const scoped = this.scopeSchool(req.user);
    const sid = schoolIdFilter?.trim();
    if (req.user.role === UserRole.ADMIN && sid) {
      return this.schoolService.listTeachers(sid);
    }
    return this.schoolService.listTeachers(scoped);
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

  @Patch('teachers/:id')
  updateTeacher(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateTeacherDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.updateTeacher(id, dto, this.scopeSchool(req.user));
  }

  @Get('teacher-assignments')
  listAssignments(
    @Query('teacherId') teacherId: string | undefined,
    @Query('groupId') groupId: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.listTeacherAssignments(teacherId, groupId, this.scopeSchool(req.user));
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
    @Req() req: Request & { user: JwtUser }
  ) {
    const scoped = this.scopeSchool(req.user);
    const sid = schoolIdFilter?.trim();
    if (req.user.role === UserRole.ADMIN && sid) {
      return this.schoolService.listParents(sid);
    }
    return this.schoolService.listParents(scoped);
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
    return this.schoolService.linkParentStudent(dto, this.scopeSchool(req.user));
  }

  @Delete('student-parent-links/:id')
  unlinkStudentParent(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolService.unlinkStudentParent(id, this.scopeSchool(req.user));
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
    if (!file?.buffer) throw new BadRequestException('Envía archivo .xlsx o .csv en el campo "file"');
    return this.schoolService.importAny(
      kind,
      file.buffer,
      file.originalname ?? '',
      dryRun === 'true',
      this.scopeSchool(req.user)
    );
  }

  @Get('import/templates/groups.xlsx')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  @Header('Content-Disposition', 'attachment; filename="plantilla-grupos.xlsx"')
  async templateGroupsXlsx() {
    return this.schoolService.buildTemplateGroupsXlsx();
  }

  @Get('import/templates/students.xlsx')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  @Header('Content-Disposition', 'attachment; filename="plantilla-alumnos.xlsx"')
  async templateStudentsXlsx() {
    return this.schoolService.buildTemplateStudentsXlsx();
  }

  @Get('import/templates/teachers.xlsx')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  @Header('Content-Disposition', 'attachment; filename="plantilla-docentes.xlsx"')
  async templateTeachersXlsx() {
    return this.schoolService.buildTemplateTeachersXlsx();
  }

  @Get('import/templates/teacher-assignments.xlsx')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  @Header('Content-Disposition', 'attachment; filename="plantilla-asignaciones-docentes.xlsx"')
  async templateTeacherAssignmentsXlsx() {
    return this.schoolService.buildTemplateTeacherAssignmentsXlsx();
  }

  @Get('import/templates/students-to-groups.xlsx')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  @Header('Content-Disposition', 'attachment; filename="plantilla-asignacion-grupos.xlsx"')
  templateStudentsToGroupsXlsx() {
    return this.schoolService.buildStudentsToGroupsTemplateXlsx();
  }

  @Get('import/templates/groups.csv')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="plantilla-grupos.csv"')
  templateGroupsCsv() {
    return this.schoolService.buildTemplateGroupsCsv();
  }

  @Get('import/templates/students.csv')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="plantilla-alumnos.csv"')
  templateStudentsCsv() {
    return this.schoolService.buildTemplateStudentsCsv();
  }

  @Get('import/templates/teachers.csv')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="plantilla-docentes.csv"')
  templateTeachersCsv() {
    return this.schoolService.buildTemplateTeachersCsv();
  }

  @Get('import/templates/teacher-assignments.csv')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="plantilla-asignaciones-docentes.csv"')
  templateTeacherAssignmentsCsv() {
    return this.schoolService.buildTemplateTeacherAssignmentsCsv();
  }

  @Get('import/templates/students-to-groups.csv')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="plantilla-asignacion-grupos.csv"')
  templateStudentsToGroupsCsv() {
    return this.schoolService.buildStudentsToGroupsTemplateCsv();
  }

  @Get('import/history')
  importHistory(@Query('limit') limit: string | undefined, @Req() req: Request & { user: JwtUser }) {
    const parsed = Number.parseInt(limit ?? '20', 10);
    const safeLimit = Number.isNaN(parsed) ? 20 : parsed;
    return this.schoolService.getImportHistory(safeLimit, this.scopeSchool(req.user));
  }
}

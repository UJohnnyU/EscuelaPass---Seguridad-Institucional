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
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AssignTeacherGroupDto } from './dto/assign-teacher-group.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { SchoolService } from './school.service';

@Controller('school')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  @Get('groups')
  listGroups() {
    return this.schoolService.listGroups();
  }

  @Get('groups/:id')
  getGroup(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.schoolService.getGroup(id);
  }

  @Post('groups')
  createGroup(@Body() dto: CreateGroupDto) {
    return this.schoolService.createGroup(dto);
  }

  @Patch('groups/:id')
  updateGroup(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateGroupDto) {
    return this.schoolService.updateGroup(id, dto);
  }

  @Delete('groups/:id')
  removeGroup(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.schoolService.removeGroup(id);
  }

  @Get('subjects')
  listSubjects() {
    return this.schoolService.listSubjects();
  }

  @Get('subjects/:id')
  getSubject(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.schoolService.getSubject(id);
  }

  @Post('subjects')
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.schoolService.createSubject(dto);
  }

  @Patch('subjects/:id')
  updateSubject(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateSubjectDto) {
    return this.schoolService.updateSubject(id, dto);
  }

  @Delete('subjects/:id')
  removeSubject(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.schoolService.removeSubject(id);
  }

  @Get('students')
  listStudents() {
    return this.schoolService.listStudents();
  }

  @Get('students/:id')
  getStudent(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.schoolService.getStudent(id);
  }

  @Post('students')
  createStudent(@Body() dto: CreateStudentDto) {
    return this.schoolService.createStudent(dto);
  }

  @Patch('students/:id')
  updateStudent(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateStudentDto) {
    return this.schoolService.updateStudent(id, dto);
  }

  @Get('teachers')
  listTeachers() {
    return this.schoolService.listTeachers();
  }

  @Get('teachers/:id')
  getTeacher(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.schoolService.getTeacher(id);
  }

  @Post('teachers')
  createTeacher(@Body() dto: CreateTeacherDto) {
    return this.schoolService.createTeacher(dto);
  }

  @Patch('teachers/:id')
  updateTeacher(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateTeacherDto) {
    return this.schoolService.updateTeacher(id, dto);
  }

  @Get('teacher-assignments')
  listAssignments(
    @Query('teacherId') teacherId: string | undefined,
    @Query('groupId') groupId: string | undefined
  ) {
    return this.schoolService.listTeacherAssignments(teacherId, groupId);
  }

  @Post('teacher-assignments')
  assignTeacherGroup(@Body() dto: AssignTeacherGroupDto) {
    return this.schoolService.assignTeacherGroup(dto);
  }

  @Delete('teacher-assignments/:id')
  removeAssignment(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.schoolService.removeTeacherAssignment(id);
  }

  @Post('import/groups/csv')
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
  importGroupsCsv(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dryRun') dryRun: string | undefined
  ) {
    if (!file?.buffer) throw new BadRequestException('Envía archivo CSV en el campo "file"');
    return this.schoolService.importGroupsCsv(file.buffer.toString('utf8'), dryRun === 'true');
  }

  @Post('import/students/csv')
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
  importStudentsCsv(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dryRun') dryRun: string | undefined
  ) {
    if (!file?.buffer) throw new BadRequestException('Envía archivo CSV en el campo "file"');
    return this.schoolService.importStudentsCsv(file.buffer.toString('utf8'), dryRun === 'true');
  }

  @Post('import/teachers/csv')
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
  importTeachersCsv(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dryRun') dryRun: string | undefined
  ) {
    if (!file?.buffer) throw new BadRequestException('Envía archivo CSV en el campo "file"');
    return this.schoolService.importTeachersCsv(file.buffer.toString('utf8'), dryRun === 'true');
  }

  @Post('import/teacher-assignments/csv')
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
  importTeacherAssignmentsCsv(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dryRun') dryRun: string | undefined
  ) {
    if (!file?.buffer) throw new BadRequestException('Envía archivo CSV en el campo "file"');
    return this.schoolService.importTeacherAssignmentsCsv(file.buffer.toString('utf8'), dryRun === 'true');
  }

  @Get('import/templates/groups.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  templateGroupsCsv() {
    return this.schoolService.getTemplateGroupsCsv();
  }

  @Get('import/templates/students.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  templateStudentsCsv() {
    return this.schoolService.getTemplateStudentsCsv();
  }

  @Get('import/templates/teachers.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  templateTeachersCsv() {
    return this.schoolService.getTemplateTeachersCsv();
  }

  @Get('import/templates/teacher-assignments.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  templateTeacherAssignmentsCsv() {
    return this.schoolService.getTemplateTeacherAssignmentsCsv();
  }

  @Get('import/history')
  importHistory(@Query('limit') limit: string | undefined) {
    const parsed = Number.parseInt(limit ?? '20', 10);
    const safeLimit = Number.isNaN(parsed) ? 20 : parsed;
    return this.schoolService.getImportHistory(safeLimit);
  }
}

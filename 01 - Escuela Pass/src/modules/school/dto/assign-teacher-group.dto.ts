import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AssignTeacherGroupDto {
  @IsUUID()
  teacherId!: string;

  @IsUUID()
  groupId!: string;

  @IsUUID()
  @IsOptional()
  subjectId?: string | null;

  @IsBoolean()
  @IsOptional()
  isMainTeacher?: boolean;

  @IsBoolean()
  @IsOptional()
  canAuthorizeDepartures?: boolean;

  /** Obligatorio para ADMIN de plataforma si no se puede inferir la escuela. */
  @IsUUID()
  @IsOptional()
  schoolId?: string;
}

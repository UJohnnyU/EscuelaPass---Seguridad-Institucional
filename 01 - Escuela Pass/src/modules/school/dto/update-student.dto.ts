import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { StudentLifecycleStatus } from '../../../database/entities/student.entity';

export class UpdateStudentDto {
  @IsUUID()
  @IsOptional()
  groupId?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  matricula?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  fullName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsBoolean()
  @IsOptional()
  canLeaveAlone?: boolean;

  @IsBoolean()
  @IsOptional()
  canAccessCampus?: boolean;

  @IsEnum(StudentLifecycleStatus)
  @IsOptional()
  lifecycleStatus?: StudentLifecycleStatus;
}

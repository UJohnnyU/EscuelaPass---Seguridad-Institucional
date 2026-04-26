import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TeacherLifecycleStatus } from '../../../database/entities/teacher.entity';

export class UpdateTeacherDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  employeeNumber?: string;

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
  canAccessCampus?: boolean;

  @IsEnum(TeacherLifecycleStatus)
  @IsOptional()
  lifecycleStatus?: TeacherLifecycleStatus;
}

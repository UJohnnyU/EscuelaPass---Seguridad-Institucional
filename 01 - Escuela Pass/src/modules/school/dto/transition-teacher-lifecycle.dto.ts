import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TeacherLifecycleStatus } from '../../../database/entities/teacher.entity';

export class TransitionTeacherLifecycleDto {
  @IsEnum(TeacherLifecycleStatus)
  toStatus!: TeacherLifecycleStatus;

  @IsString()
  @MaxLength(240)
  reason!: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}

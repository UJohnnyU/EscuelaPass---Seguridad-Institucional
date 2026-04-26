import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { StudentLifecycleStatus } from '../../../database/entities/student.entity';

export class TransitionStudentLifecycleDto {
  @IsEnum(StudentLifecycleStatus)
  toStatus!: StudentLifecycleStatus;

  @IsString()
  @MaxLength(240)
  reason!: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}

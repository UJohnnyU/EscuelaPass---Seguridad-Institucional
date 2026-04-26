import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateClassSessionDto {
  @IsOptional()
  @IsUUID('4')
  schoolId?: string;

  @IsUUID('4')
  academicPeriodId!: string;

  @IsUUID('4')
  groupId!: string;

  @IsUUID('4')
  subjectId!: string;

  @IsUUID('4')
  teacherId!: string;

  /** 0 = domingo … 6 = sábado */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  endTime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  room?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

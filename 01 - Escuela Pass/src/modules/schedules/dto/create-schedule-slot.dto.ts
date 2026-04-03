import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateScheduleSlotDto {
  @IsUUID('4')
  groupId!: string;

  /** 0 = domingo … 6 = sábado */
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  endTime!: string;

  @IsOptional()
  @IsUUID('4')
  subjectId?: string;

  @IsOptional()
  @IsUUID('4')
  teacherId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  room?: string;
}

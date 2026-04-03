import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateMeetingDto {
  @IsUUID('4')
  teacherId!: string;

  @IsUUID('4')
  studentId!: string;

  @IsDateString()
  meetingDatetime!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  topic?: string;
}

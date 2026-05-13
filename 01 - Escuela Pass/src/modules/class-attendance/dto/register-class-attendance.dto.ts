import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AttendanceStatus } from '../../../database/entities/attendance-record.entity';

export class RegisterClassAttendanceDto {
  @IsUUID('4')
  studentId!: string;

  @IsUUID('4')
  classSessionId!: string;

  @IsOptional()
  @IsDateString()
  attendanceDate?: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsBoolean()
  isJustified?: boolean;

  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

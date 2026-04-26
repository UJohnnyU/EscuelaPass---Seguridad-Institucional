import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AttendanceStatus } from '../../../database/entities/attendance-record.entity';

export class RegisterAttendanceDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsUUID('4')
  classSessionId?: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsDateString()
  attendanceDate?: string;

  @IsOptional()
  @IsBoolean()
  isJustified?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

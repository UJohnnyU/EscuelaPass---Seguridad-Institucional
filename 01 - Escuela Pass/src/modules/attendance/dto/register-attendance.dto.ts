import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AttendanceStatus } from '../../../database/entities/attendance-record.entity';

export class RegisterAttendanceDto {
  @IsUUID()
  studentId!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsDateString()
  attendanceDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

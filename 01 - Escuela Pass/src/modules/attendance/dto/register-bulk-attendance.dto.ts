import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested
} from 'class-validator';
import { AttendanceStatus } from '../../../database/entities/attendance-record.entity';

export class BulkAttendanceEntryDto {
  @IsUUID('4')
  studentId!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsBoolean()
  isJustified?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RegisterBulkAttendanceDto {
  @IsUUID('4')
  classSessionId!: string;

  @IsOptional()
  @IsDateString()
  attendanceDate?: string;

  @ValidateNested({ each: true })
  @Type(() => BulkAttendanceEntryDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(150)
  entries!: BulkAttendanceEntryDto[];
}

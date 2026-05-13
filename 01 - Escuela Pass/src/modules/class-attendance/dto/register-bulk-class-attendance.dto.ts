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

export class BulkClassAttendanceEntryDto {
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

export class RegisterBulkClassAttendanceDto {
  @IsUUID('4')
  classSessionId!: string;

  @IsOptional()
  @IsDateString()
  attendanceDate?: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ValidateNested({ each: true })
  @Type(() => BulkClassAttendanceEntryDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(150)
  entries!: BulkClassAttendanceEntryDto[];
}

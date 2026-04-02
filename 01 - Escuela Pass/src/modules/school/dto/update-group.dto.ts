import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ShiftType } from '../../../database/entities/shift-type.enum';

export class UpdateGroupDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  grade?: string;

  @IsEnum(ShiftType)
  @IsOptional()
  shift?: ShiftType;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  schoolYear?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  classroom?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsBoolean()
  @IsOptional()
  status?: boolean;
}

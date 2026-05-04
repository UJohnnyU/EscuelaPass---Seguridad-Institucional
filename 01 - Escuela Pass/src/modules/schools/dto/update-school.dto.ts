import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';
import { SchoolShiftWindowsDto } from './school-shift-windows.dto';

export class UpdateSchoolDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(999.99)
  maxGradeScale?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(999.99)
  passingGrade?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  minFailedSubjectsToRepeat?: number;

  /** Solo ADMIN (PATCH /schools). Si se envía, deben figurar las tres jornadas. */
  @IsOptional()
  @ValidateNested()
  @Type(() => SchoolShiftWindowsDto)
  shiftWindows?: SchoolShiftWindowsDto;
}

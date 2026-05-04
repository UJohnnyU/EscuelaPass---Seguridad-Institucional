import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { SchoolShiftWindowsDto } from './school-shift-windows.dto';

export class CreateSchoolDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(/^[A-Z0-9\-_]+$/, {
    message: 'code solo permite mayúsculas, números, guion y guion bajo'
  })
  code!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(999.99)
  maxGradeScale!: number;

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

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  /** Horario de clases por jornada (obligatorio al crear la escuela). */
  @ValidateNested()
  @Type(() => SchoolShiftWindowsDto)
  shiftWindows!: SchoolShiftWindowsDto;
}

import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

export class CreateAcademicPeriodDto {
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  schoolYear!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  orderIndex!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  weight!: number;
}

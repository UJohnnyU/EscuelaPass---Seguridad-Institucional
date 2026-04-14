import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';

export class BatchGradeEntryDto {
  @IsUUID()
  studentId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class BatchRegisterGradesDto {
  @IsUUID()
  groupId!: string;

  @IsString()
  @MaxLength(100)
  subject!: string;

  @IsString()
  @MaxLength(50)
  period!: string;

  @IsString()
  @MaxLength(120)
  assessmentName!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxScore!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BatchGradeEntryDto)
  entries!: BatchGradeEntryDto[];
}

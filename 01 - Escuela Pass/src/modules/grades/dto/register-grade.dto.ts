import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class RegisterGradeDto {
  @IsUUID()
  studentId!: string;

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
  @Min(0)
  score!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxScore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsDateString()
  gradedAt?: string;
}
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from 'class-validator';

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  period?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxScore?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

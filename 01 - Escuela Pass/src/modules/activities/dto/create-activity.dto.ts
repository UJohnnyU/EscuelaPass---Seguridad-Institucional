import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min
} from 'class-validator';

export class CreateActivityDto {
  @IsUUID()
  groupId!: string;

  @IsUUID()
  subjectId!: string;

  @IsString()
  @MaxLength(150)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @MaxLength(50)
  period!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxScore?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

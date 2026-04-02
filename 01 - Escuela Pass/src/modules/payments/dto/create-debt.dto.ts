import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateDebtDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  conceptId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

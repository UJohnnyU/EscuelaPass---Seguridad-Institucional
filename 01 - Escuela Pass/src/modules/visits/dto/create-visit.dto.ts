import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateVisitDto {
  @IsUUID('4')
  studentId!: string;

  @IsDateString()
  visitDatetime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

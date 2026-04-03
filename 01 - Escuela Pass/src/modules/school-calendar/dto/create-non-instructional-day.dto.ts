import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateNonInstructionalDayDto {
  @IsDateString()
  exceptionDate!: string;

  /** Si se omite, aplica a toda la escuela. */
  @IsOptional()
  @IsUUID('4')
  groupId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

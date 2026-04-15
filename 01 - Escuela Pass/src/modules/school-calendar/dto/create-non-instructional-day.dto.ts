import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateNonInstructionalDayDto {
  @IsDateString()
  exceptionDate!: string;

  /** Si se omite, aplica a toda la escuela (requiere `schoolId` si hay varias escuelas y cuenta ADMIN). */
  @IsOptional()
  @IsUUID('4')
  groupId?: string;

  /** Solo cuenta ADMIN: escuela para día sin clases global (sin `groupId`). */
  @IsOptional()
  @IsUUID('4')
  schoolId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

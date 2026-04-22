import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(30)
  code!: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  educationLevel?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  gradeScope?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  area?: string;

  @IsString()
  @IsOptional()
  description?: string;

  /** Obligatorio para ADMIN de plataforma sin escuela en el token. */
  @IsUUID()
  @IsOptional()
  schoolId?: string;
}

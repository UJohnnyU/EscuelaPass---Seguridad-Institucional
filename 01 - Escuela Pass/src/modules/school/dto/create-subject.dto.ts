import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  /** Obligatorio para ADMIN de plataforma sin escuela en el token. */
  @IsUUID()
  @IsOptional()
  schoolId?: string;
}

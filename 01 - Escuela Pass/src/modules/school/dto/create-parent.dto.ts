import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateParentDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MaxLength(255)
  fullName!: string;

  @IsBoolean()
  @IsOptional()
  canAccessCampus?: boolean;

  /** Obligatorio para usuarios ADMIN de plataforma sin escuela en el token. */
  @IsUUID()
  @IsOptional()
  schoolId?: string;

  @IsBoolean()
  @IsOptional()
  isPrimaryContact?: boolean;
}

import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength
} from 'class-validator';

export class CreateTeacherDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MaxLength(255)
  fullName!: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @MaxLength(50)
  employeeNumber!: string;

  @IsBoolean()
  @IsOptional()
  canAccessCampus?: boolean;

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(30)
  @IsUUID('4', { each: true })
  @IsOptional()
  subjectIds?: string[];

  /** Obligatorio para ADMIN de plataforma sin escuela en el token. */
  @IsUUID()
  @IsOptional()
  schoolId?: string;
}

import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
  @MaxLength(50)
  employeeNumber!: string;

  @IsBoolean()
  @IsOptional()
  canAccessCampus?: boolean;
}

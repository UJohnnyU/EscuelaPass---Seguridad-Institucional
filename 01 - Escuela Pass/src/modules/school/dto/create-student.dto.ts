import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateStudentDto {
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
  matricula!: string;

  @IsUUID()
  @IsOptional()
  groupId?: string;

  @IsBoolean()
  @IsOptional()
  canAccessCampus?: boolean;

  @IsBoolean()
  @IsOptional()
  canLeaveAlone?: boolean;
}

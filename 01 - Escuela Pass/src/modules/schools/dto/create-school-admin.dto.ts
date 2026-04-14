import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSchoolAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  fullName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

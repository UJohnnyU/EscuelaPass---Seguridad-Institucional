import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTeacherDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  employeeNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  fullName?: string;

  @IsBoolean()
  @IsOptional()
  canAccessCampus?: boolean;
}

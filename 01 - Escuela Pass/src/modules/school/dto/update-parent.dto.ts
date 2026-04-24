import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateParentDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  fullName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsBoolean()
  @IsOptional()
  canAccessCampus?: boolean;

  @IsBoolean()
  @IsOptional()
  isPrimaryContact?: boolean;
}

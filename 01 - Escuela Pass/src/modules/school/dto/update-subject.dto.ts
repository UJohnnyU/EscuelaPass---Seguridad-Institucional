import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSubjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  code?: string;

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
}

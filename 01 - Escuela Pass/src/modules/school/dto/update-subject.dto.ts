import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSubjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

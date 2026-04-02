import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

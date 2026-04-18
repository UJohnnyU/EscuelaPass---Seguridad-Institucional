import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelExternalVisitDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

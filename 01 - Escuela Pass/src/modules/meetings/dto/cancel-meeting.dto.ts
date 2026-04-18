import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelMeetingDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

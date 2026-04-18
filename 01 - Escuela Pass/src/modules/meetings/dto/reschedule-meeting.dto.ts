import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class RescheduleMeetingDto {
  @IsDateString()
  startAt!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  durationMinutes?: number;
}

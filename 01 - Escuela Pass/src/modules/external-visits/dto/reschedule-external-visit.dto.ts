import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class RescheduleExternalVisitDto {
  @IsDateString()
  visitDatetime!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  durationMinutes?: number;
}

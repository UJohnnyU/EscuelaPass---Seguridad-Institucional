import { IsNumber, IsString, Max, Min } from 'class-validator';

export class ApplyArrangementDto {
  @IsNumber()
  @Min(0.01)
  @Max(100)
  discountPercent!: number;

  @IsString()
  reason!: string;
}

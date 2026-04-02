import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class UpdateCircuitGpsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  parentGpsLatitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  parentGpsLongitude!: number;
}

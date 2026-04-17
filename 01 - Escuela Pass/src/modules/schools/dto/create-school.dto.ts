import { Type } from 'class-transformer';
import { IsNumber, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateSchoolDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(/^[A-Z0-9\-_]+$/, {
    message: 'code solo permite mayúsculas, números, guion y guion bajo'
  })
  code!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(999.99)
  maxGradeScale!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}
